// Wireshark keyboard shortcuts reference. Windows/Linux keys with the macOS
// equivalent where it differs (⌘ for Ctrl). Reference only — no copy needed.

import { esc } from '../utils.js';

const GROUPS = [
  { title: 'Capture', rows: [
    ['Ctrl + E', 'Start / stop capture'],
    ['Ctrl + R', 'Restart capture'],
    ['Ctrl + K', 'Capture options dialog'],
    ['Ctrl + I', 'Capture interfaces']
  ]},
  { title: 'Files', rows: [
    ['Ctrl + O', 'Open capture file'],
    ['Ctrl + S', 'Save'],
    ['Ctrl + W', 'Close file'],
    ['Ctrl + Shift + X', 'Export packet bytes']
  ]},
  { title: 'Display filter', rows: [
    ['Ctrl + /', 'Jump to the display-filter bar'],
    ['Enter', 'Apply the filter'],
    ['Ctrl + Shift + F', 'Clear the display filter'],
    ['Tab', 'Auto-complete a field name in the filter bar']
  ]},
  { title: 'Navigation', rows: [
    ['Ctrl + G', 'Go to packet number'],
    ['Ctrl + . / Ctrl + ,', 'Next / previous packet'],
    ['Ctrl + Down / Up', 'Next / previous packet in conversation'],
    ['Ctrl + End / Home', 'Last / first packet']
  ]},
  { title: 'Analysis', rows: [
    ['Ctrl + M', 'Mark / unmark packet'],
    ['Ctrl + Alt + M', 'Mark all displayed packets'],
    ['Ctrl + T', 'Set / clear time reference on a packet'],
    ['Ctrl + Shift + O', 'Follow → TCP stream (from a selected packet)'],
    ['Ctrl + Alt + Shift + T', 'Apply selected field as a column'],
    ['Right-click → Apply as Filter', 'Build a filter from the selected field']
  ]},
  { title: 'View', rows: [
    ['Ctrl + + / Ctrl + -', 'Zoom font in / out'],
    ['Ctrl + =', 'Reset zoom'],
    ['Ctrl + Shift + → / ←', 'Expand / collapse detail subtree'],
    ['Right arrow / Left arrow', 'Expand / collapse a detail node']
  ]}
];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Wireshark keyboard shortcuts</h2>
    <p class="hint" style="margin-bottom:10px">Windows / Linux keys shown. On macOS use <strong>⌘</strong> wherever <strong>Ctrl</strong> appears.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      ${GROUPS.map(g => `<div>
        <h3 style="font-size:13px;margin:0 0 6px;color:var(--muted)">${esc(g.title)}</h3>
        <table class="tbl">
          <tbody>${g.rows.map(r => `<tr>
            <td class="mono" style="white-space:nowrap;font-weight:600">${esc(r[0])}</td>
            <td>${esc(r[1])}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`).join('')}
    </div>`;
}
