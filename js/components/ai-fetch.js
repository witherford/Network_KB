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

  for (const v of vendors) {
    const products = v.products?.length ? v.products : [''];
    for (const product of products) {
      const filled = (fill || defaultFill)(template, { vendor: v.vendor, product, domains: (s.domains || []).join(', ') });
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
        const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
        for (const item of items) {
          const tagged = { ...item, vendor: item.vendor || v.vendor, product: item.product || product };
          if (schemaGuard && !schemaGuard(tagged)) continue;
          mergeItem(merged.items, tagged, kind);
        }
      } catch (err) {
        toast(`${v.vendor}${product ? '/' + product : ''}: ${err.message}`, 'warn', 5000);
      }
    }
  }

  merged.updatedAt = new Date().toISOString();
  state.pending[kind] = merged;
  emit('pending:changed');
  toast(`Fetched ${kind} — review and Save`, 'success');
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
