// Wireshark command-line companion — tshark / dumpcap / editcap / mergecap /
// capinfos recipes with copy buttons. Distinct from the filter builder: this
// covers capturing, splitting, slicing and analysing pcap files from the CLI.

import { esc, copyToClipboard, toast } from '../utils.js';

const GROUPS = [
  { title: 'Capture (dumpcap / tshark)', rows: [
    ['Capture to file', 'dumpcap -i eth0 -w capture.pcapng', 'dumpcap is the lightest capturer; lower drop risk than tshark.'],
    ['Ring buffer, 100 MB x 10 files', 'dumpcap -i eth0 -b filesize:100000 -b files:10 -w ring.pcapng', 'Rolling capture that never fills the disk.'],
    ['Capture with a BPF filter', "tshark -i eth0 -f 'tcp port 443 and host 10.0.0.5' -w https.pcapng", '-f = capture (BPF) filter, applied during capture.'],
    ['Capture N packets then stop', 'tshark -i eth0 -c 1000 -w sample.pcapng', '-c stops after a packet count.'],
    ['Auto-stop after 60 seconds', 'tshark -i eth0 -a duration:60 -w 60s.pcapng', '-a duration: autostop condition.'],
    ['List interfaces', 'tshark -D', 'Shows interface numbers/names for -i.']
  ]},
  { title: 'Read & filter existing pcap (tshark)', rows: [
    ['Apply a display filter', "tshark -r capture.pcapng -Y 'http.response.code >= 400'", '-Y = display (read) filter.'],
    ['Count matching packets', "tshark -r capture.pcapng -Y 'tcp.analysis.retransmission' | wc -l", 'Quick problem tally.'],
    ['Print selected fields (CSV)', "tshark -r capture.pcapng -T fields -E separator=, -e ip.src -e ip.dst -e tcp.port", 'Great for piping into a spreadsheet.'],
    ['Follow a TCP stream', 'tshark -r capture.pcapng -q -z follow,tcp,ascii,3', 'Stream index 3, ASCII.'],
    ['Top talkers (conversations)', 'tshark -r capture.pcapng -q -z conv,ip', 'IP conversation statistics.'],
    ['Protocol hierarchy', 'tshark -r capture.pcapng -q -z io,phs', 'What protocols are in the capture.'],
    ['HTTP requests summary', "tshark -r capture.pcapng -q -z http,tree", 'Per-status / per-method breakdown.']
  ]},
  { title: 'Slice & merge (editcap / mergecap)', rows: [
    ['Split into 50,000-packet files', 'editcap -c 50000 big.pcapng split.pcapng', 'Makes split_00000_*.pcapng chunks.'],
    ['Split by time (per 3600 s)', 'editcap -i 3600 big.pcapng hourly.pcapng', 'One file per hour.'],
    ['Cut a time range', "editcap -A '2026-05-24 09:00:00' -B '2026-05-24 09:05:00' in.pcapng out.pcapng", 'Keep only packets in a window.'],
    ['Remove duplicate packets', 'editcap -d in.pcapng dedup.pcapng', 'Drops adjacent dupes (SPAN mirror noise).'],
    ['Truncate to first 96 bytes', 'editcap -s 96 in.pcapng headers.pcapng', 'Strip payload, keep headers (privacy / size).'],
    ['Merge captures (chronological)', 'mergecap -w merged.pcapng a.pcapng b.pcapng', 'Interleaves by timestamp.'],
    ['Anonymise IPs/MACs', 'tracewrangler  # GUI: scrub addresses before sharing', 'No native CLI; TraceWrangler is the usual tool.']
  ]},
  { title: 'Inspect & convert', rows: [
    ['File summary / stats', 'capinfos capture.pcapng', 'Packet count, duration, data rate, drops.'],
    ['Just the packet count', 'capinfos -c capture.pcapng', ''],
    ['Convert pcapng → legacy pcap', 'editcap -F libpcap new.pcapng old.pcap', 'For tools that only read classic pcap.'],
    ['Decrypt TLS with key log', 'tshark -r tls.pcapng -o tls.keylog_file:sslkeys.log -Y http2', 'Needs SSLKEYLOGFILE captured from the client.']
  ]}
];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Wireshark CLI companion (tshark / editcap)</h2>
    <p class="hint" style="margin-bottom:10px">Copy-ready recipes for the command-line side of Wireshark. Replace interface names, files and filters as needed. For building the <code>-f</code> / <code>-Y</code> filter strings, use <strong>Capture &amp; display filters</strong>.</p>
    <div id="cliBody">${GROUPS.map(g => `
      <h3 style="font-size:13px;margin:16px 0 6px;color:var(--muted)">${esc(g.title)}</h3>
      <table class="tbl">
        <thead><tr><th style="width:210px">Task</th><th>Command</th><th>Notes</th><th style="width:36px"></th></tr></thead>
        <tbody>${g.rows.map(r => `<tr>
          <td style="font-weight:600">${esc(r[0])}</td>
          <td class="mono"><code>${esc(r[1])}</code></td>
          <td class="hint" style="font-size:11.5px">${esc(r[2])}</td>
          <td><button class="btn sm ghost" data-copy="${esc(r[1])}" title="Copy command">⧉</button></td>
        </tr>`).join('')}</tbody>
      </table>`).join('')}</div>`;

  root.querySelector('#cliBody').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    const orig = btn.textContent;
    btn.textContent = ok ? '✓' : '✗';
    if (!ok) toast('Copy failed', 'error');
    setTimeout(() => { btn.textContent = orig; }, 900);
  });
}
