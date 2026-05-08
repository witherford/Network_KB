// CSV parser/formatter for the commands dataset.
// Header: platform_key,platform_label,section,command,description,type

const HEADER = ['platform_key', 'platform_label', 'section', 'command', 'description', 'type', 'example'];
const VALID_TYPES = new Set(['show', 'config', 'troubleshooting']);

export function parseCsv(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++;
      } else { field += c; i++; }
    } else {
      if (c === '"') { inQuotes = true; i++; }
      else if (c === ',') { row.push(field); field = ''; i++; }
      else if (c === '\r') { i++; }
      else if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; i++; }
      else { field += c; i++; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

export function validateCsv(text, existing) {
  const rows = parseCsv(text);
  if (!rows.length) return { header: null, add: [], dupes: [], errors: [{ line: 0, msg: 'Empty file' }] };

  const [header, ...body] = rows;
  const errors = [];
  const normHeader = header.map(h => h.trim().toLowerCase());
  // Accept either:
  //   legacy 6-col: platform_key,platform_label,section,command,description,type
  //   v1.3.9+ 7-col: …,example
  const LEGACY_HEADER = HEADER.slice(0, 6);
  const isLegacy = normHeader.join(',') === LEGACY_HEADER.join(',');
  const isCurrent = normHeader.join(',') === HEADER.join(',');
  if (!isLegacy && !isCurrent) {
    errors.push({ line: 1, msg: `Header must be: ${HEADER.join(',')} (the trailing "example" column is optional for backward compatibility)` });
    return { header, add: [], dupes: [], errors };
  }

  const existingKeys = buildExistingKeys(existing);
  const add = [];
  const dupes = [];
  body.forEach((r, idx) => {
    const line = idx + 2;
    if (r.length < 6) { errors.push({ line, msg: `Expected at least 6 fields, got ${r.length}` }); return; }
    const [platform_key, platform_label, section, command, description, type, example] = r.map(s => (s ?? '').trim());
    if (!platform_key) { errors.push({ line, msg: 'Missing platform_key' }); return; }
    if (!platform_label) { errors.push({ line, msg: 'Missing platform_label' }); return; }
    if (!section) { errors.push({ line, msg: 'Missing section' }); return; }
    if (!command) { errors.push({ line, msg: 'Missing command' }); return; }
    if (!VALID_TYPES.has(type)) { errors.push({ line, msg: `Invalid type "${type}" (must be show/config/troubleshooting)` }); return; }
    const key = `${platform_key}|${section}|${command}`;
    if (existingKeys.has(key)) { dupes.push({ line, platform_key, section, command }); return; }
    const row = { platform_key, platform_label, section, command, description, type, flagged: false };
    if (example) row.example = example;
    add.push(row);
  });
  return { header, add, dupes, errors };
}

function buildExistingKeys(data) {
  const keys = new Set();
  if (!data?.platforms) return keys;
  for (const [pk, p] of Object.entries(data.platforms)) {
    for (const [sect, items] of Object.entries(p.sections || {})) {
      for (const it of items) {
        keys.add(`${pk}|${sect}|${it.cmd}`);
      }
    }
  }
  return keys;
}

export function exportCsv(data) {
  const out = [HEADER.join(',')];
  if (!data?.platforms) return out.join('\n') + '\n';
  for (const [pk, p] of Object.entries(data.platforms)) {
    for (const [sect, items] of Object.entries(p.sections || {})) {
      for (const it of items) {
        out.push([
          pk, p.label || pk, sect,
          it.cmd, it.desc || '', it.type || 'show',
          it.example || ''
        ].map(csvField).join(','));
      }
    }
  }
  return out.join('\n') + '\n';
}

function csvField(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Merge validated additions into a data object (mutates a clone; caller passes a fresh one).
export function mergeAdditions(data, additions) {
  const next = structuredClone(data) || { version: 2, platforms: {} };
  next.platforms ||= {};
  for (const a of additions) {
    const pk = a.platform_key;
    if (!next.platforms[pk]) {
      next.platforms[pk] = { label: a.platform_label, badge: deriveBadge(pk), short: pk.slice(0, 3).toUpperCase(), sections: {} };
    }
    const plat = next.platforms[pk];
    plat.sections[a.section] ||= [];
    const row = { cmd: a.command, desc: a.description, type: a.type, flagged: a.flagged };
    if (a.example) row.example = a.example;
    plat.sections[a.section].push(row);
  }
  return next;
}

/**
 * Parse the loose `Command: … / Description: … / Example: …` block format
 * users tend to paste in chat. Each Command: line starts a new block.
 * Description and Example bodies span until the next marker. The format
 * carries no platform/section, so the caller supplies those at import time.
 *
 * Returns: [{ command, description, example }, …]
 */
export function parseTextBlocks(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let cur = null;
  let mode = 'none';
  // Match an optional leading "•/-/*" bullet so pasted bullet-lists work.
  const leader = /^\s*(?:[-*•]\s*)?/;
  const cmdRe  = new RegExp(leader.source + 'Command:\\s*(.*)$', 'i');
  const descRe = new RegExp(leader.source + 'Description:\\s*(.*)$', 'i');
  const exRe   = new RegExp(leader.source + 'Example(?:[^:\\n]*):\\s*(.*)$', 'i');

  const flush = () => {
    if (!cur) return;
    cur.command     = (cur.command || '').trim();
    cur.description = (cur.description || '').trim();
    cur.example     = (cur.example || '').trim();
    if (cur.command) blocks.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if ((m = line.match(cmdRe))) {
      flush();
      cur = { command: m[1] || '', description: '', example: '' };
      mode = 'command';
      continue;
    }
    if (!cur) continue; // junk before first Command: marker — ignore
    if ((m = line.match(descRe))) { cur.description = m[1] || ''; mode = 'description'; continue; }
    if ((m = line.match(exRe)))   { cur.example     = m[1] || ''; mode = 'example';     continue; }
    // Continuation line — append to the current field.
    if (mode === 'command' && line.trim()) {
      // Multi-line Command: blocks are unusual; only continue if the next
      // line isn't blank and we don't yet have a Description/Example marker.
      cur.command += (cur.command ? ' ' : '') + line.trim();
    } else if (mode === 'description') {
      cur.description += (cur.description ? '\n' : '') + line;
    } else if (mode === 'example') {
      cur.example += (cur.example ? '\n' : '') + line;
    }
  }
  flush();
  return blocks;
}

/**
 * Validate parsed text-block entries against an existing dataset. Mirrors the
 * shape of validateCsv but with a fixed platform_key/platform_label/section
 * (the text format itself carries none of those).
 */
export function validateTextBlocks(blocks, { platformKey, platformLabel, section }, existing) {
  const errors = [];
  if (!platformKey)   errors.push({ line: 0, msg: 'Platform required' });
  if (!platformLabel) errors.push({ line: 0, msg: 'Platform label required' });
  if (!section)       errors.push({ line: 0, msg: 'Section required' });
  if (errors.length) return { add: [], dupes: [], update: [], errors };

  const existingKeys = buildExistingKeys(existing);
  // Build a lookup of existing rows so we can detect description/example
  // updates (vs. straight duplicates).
  const existingByKey = new Map();
  if (existing?.platforms?.[platformKey]?.sections) {
    for (const [sect, items] of Object.entries(existing.platforms[platformKey].sections)) {
      for (const it of items) {
        existingByKey.set(`${platformKey}|${sect}|${it.cmd}`, { sect, it });
      }
    }
  }

  const add = [];
  const dupes = [];
  const update = [];
  blocks.forEach((b, i) => {
    if (!b.command) { errors.push({ line: i + 1, msg: 'Block has no command' }); return; }
    const key = `${platformKey}|${section}|${b.command}`;
    const row = {
      platform_key: platformKey,
      platform_label: platformLabel,
      section,
      command: b.command,
      description: b.description,
      type: 'show',
      flagged: false
    };
    if (b.example) row.example = b.example;

    if (existingKeys.has(key)) {
      const cur = existingByKey.get(key);
      const descChanged = (cur?.it.desc || '') !== (b.description || '');
      const exChanged   = (cur?.it.example || '') !== (b.example || '');
      if (descChanged || exChanged) update.push({ ...row, _existing: cur });
      else dupes.push({ command: b.command });
    } else {
      add.push(row);
    }
  });
  return { add, dupes, update, errors };
}

/**
 * Apply text-block updates (in-place description/example changes) to a data
 * clone. Caller passes a fresh clone (e.g. via mergeAdditions or structuredClone).
 */
export function applyTextBlockUpdates(data, updates) {
  const next = data || { version: 2, platforms: {} };
  for (const u of updates) {
    const plat = next.platforms?.[u.platform_key];
    if (!plat) continue;
    const list = plat.sections?.[u.section];
    if (!list) continue;
    const idx = list.findIndex(it => it.cmd === u.command);
    if (idx < 0) continue;
    const row = { ...list[idx], desc: u.description };
    if (u.example) row.example = u.example;
    else delete row.example;
    list[idx] = row;
  }
  return next;
}

function deriveBadge(platformKey) {
  const map = {
    netscaler: 'badge-ns', palo_alto: 'badge-pa', openssl: 'badge-ssl',
    cisco_ios: 'badge-sw', wlc: 'badge-wlc', linux: 'badge-lnx',
    windows: 'badge-win', aws: 'badge-aws', wireshark: 'badge-wsk',
    vmware: 'badge-vm', asa: 'badge-asa', sdx: 'badge-sdx'
  };
  return map[platformKey] || 'badge-sw';
}
