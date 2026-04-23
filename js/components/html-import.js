// Shared "Import HTML" modal used on guides/software/cves pages. Reads one
// or more .html files and hands the parsed items to the caller's onImport()
// callback so each page can push them into its own pending draft.

import { esc, toast } from '../utils.js';
import { openModal } from './modal.js';

export function openHtmlImport({ kind, topicLabel, onImport }) {
  openModal((el, close) => {
    el.innerHTML = `
      <h3>Import HTML — ${esc(kind)}</h3>
      <p style="font-size:12px;color:var(--text-3);line-height:1.5;margin-bottom:8px">
        Upload one or more <code>.html</code> files. Each file becomes its own card on the
        <b>${esc(kind)}</b> page. Filename (or the document's &lt;title&gt;) becomes the card
        title. The full HTML is rendered in a sandboxed iframe so scripts, styles, Mermaid
        diagrams, copy buttons, etc. all keep working. Nothing in the imported page can
        reach the surrounding app.
      </p>
      ${topicLabel ? `
        <div class="form-row" style="margin-top:6px">
          <label>${esc(topicLabel)}</label>
          <input id="hiTopic" class="search-input" placeholder="(optional — groups related cards together)">
        </div>
      ` : ''}
      <div class="form-row" style="margin-top:8px">
        <label>Files</label>
        <input type="file" id="hiFile" accept=".html,.htm,text/html" multiple>
      </div>
      <div id="hiPreview" style="margin-top:10px;font-size:12px;color:var(--text-3)"></div>
      <div class="modal-footer">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="apply" disabled>Import</button>
      </div>`;
    let staged = [];
    const preview = el.querySelector('#hiPreview');
    const applyBtn = el.querySelector('[data-act=apply]');

    el.querySelector('#hiFile').addEventListener('change', async e => {
      staged = [];
      for (const f of e.target.files) {
        const text = await f.text();
        staged.push({ name: f.name, size: f.size, text });
      }
      preview.innerHTML = staged.map(f => `<div>• ${esc(f.name)} <span style="color:var(--text-3)">(${f.size} bytes)</span></div>`).join('');
      applyBtn.disabled = !staged.length;
      applyBtn.textContent = staged.length ? `Import ${staged.length} file${staged.length === 1 ? '' : 's'}` : 'Import';
    });
    el.querySelector('[data-act=cancel]').addEventListener('click', close);
    applyBtn.addEventListener('click', () => {
      if (!staged.length) return;
      const topic = el.querySelector('#hiTopic')?.value.trim() || '';
      const items = staged.map(f => ({
        title: extractTitle(f.text) || f.name.replace(/\.(html?|htm)$/i, ''),
        topic: topic || undefined,
        html: true,
        body: f.text,
        source: 'html-import',
        addedAt: new Date().toISOString()
      }));
      onImport(items);
      toast(`Imported ${items.length} ${kind} file${items.length === 1 ? '' : 's'} — review and Save`, 'success');
      close();
    });
  }, { wide: true });
}

// Render an HTML-item card inside a sandboxed iframe so script/style from the
// imported document can't touch the surrounding app. Uses srcdoc with entity
// escaping — no Blob URL plumbing, works synchronously on first paint.
export function renderHtmlCard({ title, body, deleteBtn = '', minHeight = '80vh' }) {
  const srcdoc = String(body).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<article class="section-card">
    <div class="section-title" style="display:flex;align-items:center;gap:8px">
      <span>${esc(title || 'Untitled')}</span>
      ${deleteBtn}
    </div>
    <iframe
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
      style="width:100%;min-height:${minHeight};border:0;background:#0b1020;display:block"
      srcdoc="${srcdoc}"></iframe>
  </article>`;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1].replace(/\s+/g, ' ').trim();
}
