#!/usr/bin/env node
// Scheduled AI runner. Reads data/settings.enc.json, decrypts via
// $SETTINGS_PASSWORD (GitHub Actions secret), fans out AI calls per watchlist
// vendor × content type with rotating-key failover, and writes refreshed
// data/software.json / data/guides.json / data/cves.json.

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'data');

// Dynamic imports of the shared API modules — they live under js/api and the
// script-relative path must be file:// to work on Windows.
const API_DIR = pathToFileURL(path.join(ROOT, 'js', 'api')).href;

const ENDPOINTS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai:     'https://api.openai.com/v1/chat/completions',
  groq:       'https://api.groq.com/openai/v1/chat/completions',
  anthropic:  'https://api.anthropic.com/v1/messages'
};

const KINDS = [
  { key: 'software', file: 'data/software.json', promptKey: 'software' },
  { key: 'guides',   file: 'data/guides.json',   promptKey: 'guides' },
  { key: 'cves',     file: 'data/cves.json',     promptKey: 'cves' },
  { key: 'commands', file: 'data/commands.json', promptKey: 'commands' }
];

const FALLBACK_PROMPTS = {
  commands: 'For vendor {{vendor}} product {{product}}, return JSON array of CLI commands. Each item: {cmd, desc, type (show|config|troubleshooting), section}. Aim for 20+ commands covering System, Interfaces, Routing, Troubleshooting.',
  software: 'For vendor {{vendor}} product {{product}}, return JSON object: {latest, recommended, eol: [], notes}.',
  guides:   'For topic {{topic}} (vendor {{vendor}}), return JSON object: {title, topic, steps: [{n, action, expected, commands: []}]}.',
  cves:     'For vendor {{vendor}} product {{product}}, return JSON array of recent CVEs (last 90 days): [{id, cvss, severity, summary, references: []}].'
};

main().catch(err => { console.error(err); process.exit(1); });

async function main() {
  const password = process.env.SETTINGS_PASSWORD;
  if (!password) die('SETTINGS_PASSWORD secret is missing');

  const env = JSON.parse(await fs.readFile(path.join(DATA, 'settings.enc.json'), 'utf8'));
  if (!env || env.v !== 1) die('settings.enc.json is not initialised');
  const settings = await decrypt(env, password);

  const vendors = (settings.watchlist?.vendors || []).filter(v => v.vendor);
  if (!vendors.length) { console.log('No watchlist vendors; nothing to do.'); return; }

  const keyring = buildKeyring(settings.aiProviders || []);
  if (!keyring.length) die('No enabled AI providers');

  const manifest = await readJson(path.join(DATA, 'manifest.json'), {});

  // Real-API pass first — sources data for software.json and cves.json from
  // vendor APIs (Cisco, NVD, MSRC, Palo Alto, Citrix). Anything the APIs
  // don't cover falls through to the AI pass below.
  const apiResults = await runRealApis(settings);

  for (const kind of KINDS) {
    const absPath = path.join(ROOT, kind.file);
    const template = settings.prompts?.[kind.promptKey] || FALLBACK_PROMPTS[kind.promptKey];
    if (!template) { console.log(`[${kind.key}] no prompt template, skipping`); continue; }

    if (kind.key === 'commands') {
      await refreshCommands(absPath, template, vendors, keyring, settings.domains || []);
    } else {
      const existing = await readJson(absPath, { version: 1, items: [] });
      existing.items ||= [];

      // Merge real-API results for software / cves.
      if (apiResults[kind.key]?.items?.length) {
        for (const it of apiResults[kind.key].items) {
          mergeItem(existing.items, it, kind.key);
        }
        const src = apiResults[kind.key].sources || {};
        const tally = Object.entries(src).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).join(', ');
        console.log(`[${kind.key}] real APIs → ${tally || 'nothing'}`);
      }

      for (const v of vendors) {
        const products = v.products?.length ? v.products : [''];
        for (const product of products) {
          // Skip AI for pairs already satisfied by a real API.
          if (apiResults[kind.key]?.handled?.has(`${v.vendor}|${product}`)) {
            console.log(`[${kind.key}] ${v.vendor}/${product}: skipped (real-API)`);
            continue;
          }
          const filled = fillTemplate(template, {
            vendor: v.vendor, product, topic: product || v.vendor, domains: (settings.domains || []).join(', ')
          });
          if (!filled) continue;
          try {
            const items = await callAI(filled, keyring);
            for (const raw of (Array.isArray(items) ? items : (items?.items || [items]))) {
              if (!raw || typeof raw !== 'object') continue;
              const tagged = { ...raw, vendor: raw.vendor || v.vendor, product: raw.product || product };
              mergeItem(existing.items, tagged, kind.key);
            }
            console.log(`[${kind.key}] ${v.vendor}/${product}: OK`);
          } catch (err) {
            console.error(`[${kind.key}] ${v.vendor}/${product}: ${err.message}`);
          }
        }
      }

      existing.updatedAt = new Date().toISOString();
      await fs.writeFile(absPath, JSON.stringify(existing, null, 2) + '\n');
    }
    manifest[kind.key] = new Date().toISOString();
  }

  await fs.writeFile(path.join(DATA, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Done.');
}

/* ---------- real vendor APIs ---------- */
async function runRealApis(settings) {
  const out = { software: null, cves: null };
  try {
    const vendorsMod = await import(API_DIR + '/vendors.js');
    try {
      out.software = await vendorsMod.fetchSoftware(settings, { env: 'node' });
    } catch (err) { console.error('[software] real-API error:', err.message); }
    try {
      out.cves = await vendorsMod.fetchCves(settings, { env: 'node' });
    } catch (err) { console.error('[cves] real-API error:', err.message); }
  } catch (err) {
    console.error('Failed to load vendor API modules:', err.message);
  }
  return out;
}

/* ---------- decrypt ---------- */
async function decrypt(env, password) {
  const salt = Buffer.from(env.kdf.salt, 'base64');
  const iv = Buffer.from(env.enc.iv, 'base64');
  const ct = Buffer.from(env.enc.ct, 'base64');
  const key = crypto.pbkdf2Sync(password, salt, env.kdf.iter || 600_000, 32, 'sha256');
  const tag = ct.subarray(ct.length - 16);
  const body = ct.subarray(0, ct.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(body), decipher.final()]);
  return JSON.parse(pt.toString('utf8'));
}

/* ---------- keyring ---------- */
function buildKeyring(providers) {
  return providers
    .filter(p => p.enabled !== false && p.key)
    .map(p => ({ ...p, failures: 0, cooldownUntil: 0 }));
}

function pickKey(keyring) {
  const now = Date.now();
  let best = null;
  for (const k of keyring) if (k.cooldownUntil <= now && (best == null || k.failures < best.failures)) best = k;
  return best;
}

/* ---------- AI call ---------- */
async function callAI(prompt, keyring) {
  const tried = new Set();
  while (true) {
    const k = pickKey(keyring);
    if (!k || tried.has(k.id)) throw new Error('All AI keys exhausted');
    tried.add(k.id);
    try {
      const text = await callProvider(k, prompt);
      k.failures = 0; k.cooldownUntil = 0;
      return extractJson(text);
    } catch (err) {
      if (err.retriable) {
        k.failures++;
        k.cooldownUntil = Date.now() + Math.min(30 * 60_000, 30_000 * 2 ** (k.failures - 1));
        continue;
      }
      throw err;
    }
  }
}

async function callProvider(p, prompt) {
  const url = ENDPOINTS[p.provider];
  if (!url) throw new Error('Unknown provider: ' + p.provider);
  let res, body;
  if (p.provider === 'anthropic') {
    body = {
      model: p.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
      system: 'You return JSON only. No prose, no markdown fences.'
    };
    res = await fetch(url, {
      method: 'POST',
      headers: { 'x-api-key': p.key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } else {
    body = {
      model: p.model,
      messages: [
        { role: 'system', content: 'You return JSON only. No prose, no markdown fences.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2000
    };
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + p.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  if (!res.ok) {
    const e = new Error(`${p.provider} HTTP ${res.status}`);
    e.retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    throw e;
  }
  const j = await res.json();
  if (p.provider === 'anthropic') return j.content?.[0]?.text || '';
  return j.choices?.[0]?.message?.content || '';
}

/* ---------- utilities ---------- */
function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const m = text.match(/[\[\{][\s\S]*[\]\}]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error('AI returned non-JSON');
}

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

function mergeItem(list, item, kind) {
  const id = identityKey(item, kind);
  const i = list.findIndex(x => identityKey(x, kind) === id);
  if (i >= 0) list[i] = { ...list[i], ...item };
  else list.push(item);
}

function identityKey(it, kind) {
  if (kind === 'cves') return it.id || (it.summary || '').slice(0, 60);
  if (kind === 'software') return `${it.vendor}|${it.product}`;
  if (kind === 'guides') return it.title || it.topic || '';
  return JSON.stringify(it);
}

async function readJson(p, fallback) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return fallback; }
}

function die(msg) { console.error(msg); process.exit(1); }

/* ---------- commands (nested shape) ---------- */
async function refreshCommands(absPath, template, vendors, keyring, domains) {
  const existing = await readJson(absPath, { version: 2, platforms: {} });
  existing.platforms ||= {};
  for (const v of vendors) {
    const products = v.products?.length ? v.products : [''];
    for (const product of products) {
      const filled = fillTemplate(template, { vendor: v.vendor, product, topic: product || v.vendor, domains: domains.join(', ') });
      try {
        const parsed = await callAI(filled, keyring);
        const items = Array.isArray(parsed) ? parsed
          : Array.isArray(parsed?.items) ? parsed.items
          : Array.isArray(parsed?.commands) ? parsed.commands
          : [parsed];
        const pkey = findOrCreatePlatform(existing, v.vendor, product);
        let added = 0;
        for (const raw of items) {
          if (!raw || typeof raw !== 'object') continue;
          const cmd = raw.cmd || raw.command || raw.cli || raw.syntax || '';
          if (!cmd) continue;
          const desc = raw.desc || raw.description || raw.purpose || '';
          const rawType = (raw.type || raw.category || 'show').toLowerCase();
          const type = ['show','config','troubleshooting'].includes(rawType) ? rawType
            : /conf|set/.test(rawType) ? 'config'
            : /trouble|debug|diag/.test(rawType) ? 'troubleshooting'
            : 'show';
          const section = raw.section || raw.group || product || 'General';
          existing.platforms[pkey].sections[section] ||= [];
          if (existing.platforms[pkey].sections[section].some(x => x.cmd === cmd)) continue;
          existing.platforms[pkey].sections[section].push({ cmd, desc, type, flagged: false });
          added++;
        }
        console.log(`[commands] ${v.vendor}/${product}: +${added}`);
      } catch (err) {
        console.error(`[commands] ${v.vendor}/${product}: ${err.message}`);
      }
    }
  }
  existing.updatedAt = new Date().toISOString();
  await fs.writeFile(absPath, JSON.stringify(existing, null, 2) + '\n');
}

function findOrCreatePlatform(data, vendor, product) {
  const vLow = vendor.toLowerCase();
  const pLow = (product || '').toLowerCase();
  for (const [k, p] of Object.entries(data.platforms)) {
    const lbl = (p.label || '').toLowerCase();
    const kLow = k.toLowerCase();
    if (pLow && ((lbl.includes(vLow) && lbl.includes(pLow)) || kLow.includes(pLow))) return k;
    if (!pLow && (lbl.includes(vLow) || kLow.includes(vLow))) return k;
  }
  const slug = String(product ? `${vendor}-${product}` : vendor).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  data.platforms[slug] ||= {
    label: product ? `${vendor} ${product}` : vendor,
    badge: 'badge-sw',
    short: (product || vendor).slice(0, 6),
    sections: {}
  };
  return slug;
}
