// Shared "Fetch now" helper for AI-populated pages. Runs the configured prompt
// for each watchlist vendor, parses JSON results, merges into pending state.

import { state, emit } from '../state.js';
import { loadPool } from '../api/keyring.js';
import { chat, extractJson } from '../api/ai.js';
import { toast } from '../utils.js';

export async function fetchForKind(kind, { promptKey, fill, schemaGuard } = {}) {
  if (!state.editMode || !state.settings) throw new Error('Unlock edit mode first');
  const s = state.settings;
  const vendors = (s.watchlist?.vendors || []).filter(v => v.vendor);
  if (!vendors.length) throw new Error('No watchlist vendors configured');

  const template = s.prompts?.[promptKey || kind];
  if (!template) throw new Error('Prompt missing for ' + kind);

  loadPool(s.aiProviders);

  const merged = structuredClone(state.data[kind] || { version: 1, items: [] });
  merged.items ||= [];

  let added = 0, skipped = 0, errors = 0;
  for (const v of vendors) {
    const products = v.products?.length ? v.products : [''];
    for (const product of products) {
      const filled = (fill || defaultFill)(template, {
        vendor: v.vendor,
        product,
        // Alias so guides-style prompts that use {{topic}} still resolve.
        // Falls through to product, then to vendor, so single-vendor watchlist
        // entries (no products) still produce a meaningful prompt.
        topic: product || v.vendor,
        domains: (s.domains || []).join(', ')
      });
      try {
        const { text } = await chat({
          messages: [
            { role: 'system', content: 'You return JSON only. No prose, no markdown fences.' },
            { role: 'user', content: filled }
          ],
          json: true,
          maxTokens: 2000
        });
        const parsed = extractJson(text);
        if (!parsed) throw new Error('AI returned non-JSON');
        let items;
        if (Array.isArray(parsed)) items = parsed;
        else if (Array.isArray(parsed.items)) items = parsed.items;
        else if (Array.isArray(parsed.data)) items = parsed.data;
        else items = [parsed];
        for (const raw of items) {
          const item = normalize(raw, kind);
          const tagged = { ...item, vendor: item.vendor || v.vendor, product: item.product || product };
          const substantive = hasSubstance(tagged, kind);
          if (!substantive || (schemaGuard && !schemaGuard(tagged))) {
            skipped++;
            // Log so "skipped N" in the toast has a traceable cause.
            console.warn(`[ai-fetch] skipped ${kind} item`, { reason: !substantive ? 'no substance' : 'schema guard failed', raw, normalized: tagged });
            continue;
          }
          mergeItem(merged.items, tagged, kind);
          added++;
        }
      } catch (err) {
        errors++;
        toast(`${v.vendor}${product ? '/' + product : ''}: ${err.message}`, 'warn', 5000);
      }
    }
  }

  merged.updatedAt = new Date().toISOString();
  state.pending[kind] = merged;
  emit('pending:changed');
  const bits = [`+${added}`];
  if (skipped) bits.push(`${skipped} skipped`);
  if (errors) bits.push(`${errors} errors`);
  toast(`Fetched ${kind}: ${bits.join(', ')} — review and Save`, added ? 'success' : 'warn', 6000);
}

// Map common synonyms the AI might return into the fields the renderer expects.
function normalize(raw, kind) {
  if (!raw || typeof raw !== 'object') return {};
  const it = { ...raw };
  if (kind === 'guides') {
    it.title ||= raw.name || raw.heading || raw.topic || '';
    it.topic ||= raw.category || raw.section || '';
    it.steps ||= raw.procedure || raw.instructions || raw.steps_list || [];
    // Some models return a free-text guide instead of structured steps. The
    // renderer already falls back to `body`, so accept any of these aliases.
    it.body ||= raw.body || raw.content || raw.text || raw.markdown || raw.guide || '';
    if (Array.isArray(it.steps)) {
      it.steps = it.steps.map((s, i) => typeof s === 'string'
        ? { n: i + 1, action: s }
        : { n: s.n || s.step || i + 1, action: s.action || s.description || s.text || '', expected: s.expected || s.result || '', commands: s.commands || s.command_examples || [] });
    }
  } else if (kind === 'software') {
    it.latest ||= raw.current || raw.version || raw.latestVersion || '';
    it.recommended ||= raw.stable || raw.recommended_version || raw.lts || '';
    it.eol = raw.eol || raw.end_of_life || raw.endOfLife || [];
    it.notes ||= raw.note || raw.comments || raw.remarks || '';
  } else if (kind === 'cves') {
    it.id ||= raw.cve || raw.cveId || raw.identifier || '';
    it.cvss ||= raw.score || raw.cvssScore || '';
    it.severity = (raw.severity || raw.level || '').toLowerCase();
    it.summary ||= raw.description || raw.summary || '';
  }
  return it;
}

// Skip items that carry no real payload — e.g. AI returned {} meaning "no data"
// but our tag step still added {vendor, product}. Those would litter the UI.
function hasSubstance(it, kind) {
  if (kind === 'cves') return !!(it.id || (it.summary && it.summary.length > 8));
  if (kind === 'software') return !!(it.latest || it.recommended || (Array.isArray(it.eol) ? it.eol.length : it.eol) || it.notes);
  if (kind === 'guides') return !!(it.title || it.body || (Array.isArray(it.steps) && it.steps.length));
  if (kind === 'commands') return !!it.cmd;
  return true;
}

function defaultFill(template, vars) {
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
  if (kind === 'guides') return it.title || (it.topic || '');
  return JSON.stringify(it);
}
