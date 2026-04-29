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

function deriveBadge(platformKey) {
  const map = {
    netscaler: 'badge-ns', palo_alto: 'badge-pa', openssl: 'badge-ssl',
    cisco_ios: 'badge-sw', wlc: 'badge-wlc', linux: 'badge-lnx',
    windows: 'badge-win', aws: 'badge-aws', wireshark: 'badge-wsk',
    vmware: 'badge-vm', asa: 'badge-asa', sdx: 'badge-sdx'
  };
  return map[platformKey] || 'badge-sw';
}
