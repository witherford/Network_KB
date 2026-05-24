// Cisco IOS TCL script generator — free-AI-driven. Describe a task in plain
// English and get a working tclsh script. Always review and lab-test first.

import { copyToClipboard, toast } from '../utils.js';
import { freeAi, setBusy, stripFences, AI_CREDIT } from '../components/ai-free.js';

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:8px">Cisco TCL script generator</h2>
    <p class="hint" style="margin-bottom:10px">
      Describe what you want a Cisco IOS TCL script to do — in plain English. The free AI generates a working script using Cisco's <code>cli</code> and <code>tclsh</code> integration. Always review and test in a lab before running in production.
    </p>
    <div class="form-row">
      <label>What should the script do?</label>
      <textarea id="tclDesc" rows="4" placeholder="e.g. Loop through every interface, run 'show interfaces transceiver detail', flag any whose Tx power is below -7 dBm, and email the result via SMTP."></textarea>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <span style="font-size:12px">Quick examples:</span>
      <button class="btn sm ghost" data-ex="ex1">Reload schedule</button>
      <button class="btn sm ghost" data-ex="ex2">Save running-config to TFTP</button>
      <button class="btn sm ghost" data-ex="ex3">Loop ping a list of IPs</button>
      <button class="btn sm ghost" data-ex="ex4">Audit interfaces in down state</button>
      <button class="btn sm ghost" data-ex="ex5">Bulk-add VLANs from a list</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="tclGo">Generate via free AI</button>
      <button class="btn" id="tclCopy">Copy script</button>
      <button class="btn ghost" id="tclDl">Download .tcl</button>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="tclStatus"></span>
    </div>
    <pre class="script-out" id="tclOut" style="min-height:160px;max-height:520px;overflow:auto"></pre>
    <div id="tclNotes" style="margin-top:10px"></div>
    <div class="hint" style="margin-top:10px;font-size:11px">${esc(AI_CREDIT)}</div>`;

  const $ = sel => root.querySelector(sel);
  const SAMPLES = {
    ex1: 'Schedule a controlled reload at 02:00 local time, but only if no users are connected via VTY/SSH and the running-config has been saved to startup-config.',
    ex2: 'Copy the running-config to a TFTP server at 10.50.50.50 with a filename of <hostname>-<YYYYMMDD-HHMM>.cfg.',
    ex3: 'Take a list of IPs from a TCL list, ping each one 5 times, and print a summary table of which were reachable.',
    ex4: 'Walk every interface, print one line per interface that is administratively up but line-protocol down, including the description and last input/output counters.',
    ex5: 'Take a TCL list of VLAN IDs and names, create each VLAN if it does not exist, name it, and add it to a trunk on Gi1/0/24.'
  };
  root.querySelectorAll('button[data-ex]').forEach(b => b.addEventListener('click', () => { $('#tclDesc').value = SAMPLES[b.dataset.ex] || ''; }));

  $('#tclGo').addEventListener('click', async () => {
    const desc = $('#tclDesc').value.trim();
    if (!desc) { toast('Describe what the script should do', 'warn'); return; }
    $('#tclGo').disabled = true;
    setBusy($('#tclStatus'), true, 'Generating TCL…');
    try {
      const system = `You write Cisco IOS / IOS-XE TCL scripts that run inside the device's tclsh. Rules:
1. Output ONLY the TCL script. No prose, no Markdown, no code fences.
2. Begin with a brief comment header (# author/purpose/usage line).
3. Use the Cisco "cli" and "exec" interfaces correctly: e.g. "set rc [exec \\"show running-config\\"]".
4. Wrap risky commands (config changes, reloads) in checks where the user said to.
5. If the requested action requires features beyond plain TCL (SMTP, complex parsing) and there's no built-in, use the closest approximation Cisco IOS TCL supports and add a comment explaining the limitation.
6. Quote interface names and VLAN IDs correctly.
7. Use TCL variables for any value that should be configurable; declare them at the top.
8. End with a clear "puts" line indicating success.`;
      const raw = await freeAi({ prompt: desc, system });
      const script = stripFences(raw);
      $('#tclOut').textContent = script;
      $('#tclStatus').textContent = 'Done';
      $('#tclNotes').innerHTML = `
        <div class="hint" style="background:rgba(245,158,11,0.1);border-left:3px solid #f59e0b;padding:8px 10px;border-radius:4px;font-size:11px;line-height:1.5">
          <strong>Before running:</strong> Save the script as a <code>.tcl</code> file, copy it to flash, then run <code>tclsh flash:script.tcl</code> from privileged exec. Always test in a lab first — AI-generated TCL may use commands that don't exist in your IOS version.
        </div>`;
      setTimeout(() => { $('#tclStatus').textContent = ''; }, 2000);
    } catch (err) {
      toast('AI failed: ' + err.message, 'error', 6000);
      $('#tclStatus').textContent = 'Failed';
    } finally {
      setBusy($('#tclStatus'), false);
      $('#tclGo').disabled = false;
    }
  });
  $('#tclCopy').addEventListener('click', () => {
    const txt = $('#tclOut').textContent;
    if (!txt) { toast('Generate a script first', 'warn'); return; }
    copyToClipboard(txt).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  $('#tclDl').addEventListener('click', () => {
    const txt = $('#tclOut').textContent;
    if (!txt) { toast('Generate a script first', 'warn'); return; }
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cisco-script.tcl';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
