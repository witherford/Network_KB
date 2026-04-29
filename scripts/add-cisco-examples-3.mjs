// Third batch: Cisco C9800 WLC AP-operational change commands.
// All target the `wlc` platform, "AP Management" section (or "Tags &
// Profiles" for tag-assignment commands). Each entry comes with an
// example output from the supplied run-book.
//
// The earlier two example scripts already covered the read-only show
// commands referenced in this batch — they're idempotent so re-running
// them is a no-op. Here we only add the operational change commands
// that weren't in the database yet.
//
// Run: node scripts/add-cisco-examples-3.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const ENTRIES = [
  // ---------- Rename / location / reset ----------
  {
    cmd: 'ap name AP-TEMP-01 name AP-LON-01',
    desc: 'Rename a joined AP. The AP will rejoin the controller under its new name; client sessions on its radios will drop briefly during the rejoin.',
    example: 'AP will rejoin controller with new name.',
    section: 'AP Management', type: 'config', flagged: true
  },
  {
    cmd: 'ap name AP-LON-01 location "London HQ – 3rd Floor – East Wing"',
    desc: 'Set a free-text location string on an AP. Used by RRM neighbour grouping and shown in WLC reports / Cisco DNA Center.',
    example: 'Location string updated successfully.',
    section: 'AP Management', type: 'config'
  },
  {
    cmd: 'ap name AP-LON-01 reset',
    desc: 'Reboot a single AP via the controller. The AP CAPWAP tunnel drops, the AP reboots, then rejoins under the same tags.',
    example: 'AP reset command issued successfully.',
    section: 'AP Management', type: 'config', flagged: true
  },

  // ---------- Channel & power overrides ----------
  {
    cmd: 'ap name AP-LON-01 dot11 24ghz channel 6',
    desc: 'Override the RRM-assigned 2.4 GHz channel on a single AP. RRM stops adjusting this radio until the override is cleared.',
    example: 'RRM overridden.',
    section: 'RRM', type: 'config'
  },
  {
    cmd: 'ap name AP-LON-01 dot11 5ghz channel 36',
    desc: 'Override the RRM-assigned 5 GHz channel on a single AP. RRM stops adjusting this radio until the override is cleared.',
    example: 'RRM overridden.',
    section: 'RRM', type: 'config'
  },
  {
    cmd: 'ap name AP-LON-01 dot11 24ghz txpower 3',
    desc: 'Override the 2.4 GHz transmit-power level (1 = max, 8 = min). Disables RRM TPC for this radio.',
    example: 'Transmit power updated.',
    section: 'RRM', type: 'config'
  },
  {
    cmd: 'ap name AP-LON-01 dot11 5ghz txpower 4',
    desc: 'Override the 5 GHz transmit-power level (1 = max, 8 = min). Disables RRM TPC for this radio.',
    example: 'Transmit power updated.',
    section: 'RRM', type: 'config'
  },

  // ---------- AP mode changes ----------
  {
    cmd: 'ap name AP-LON-01 mode local',
    desc: 'Switch an AP to Local mode (default — centrally-switched data plane via the WLC). The AP reboots and rejoins.',
    example: 'AP will reboot and rejoin controller.',
    section: 'AP Management', type: 'config', flagged: true
  },
  {
    cmd: 'ap name AP-LON-01 mode flexconnect',
    desc: 'Switch an AP to FlexConnect mode (locally-switched at the AP — survives WAN outages to the WLC). The AP reboots and rejoins.',
    example: 'AP will reboot and rejoin controller.',
    section: 'AP Management', type: 'config', flagged: true
  },
  {
    cmd: 'ap name AP-LON-01 mode monitor',
    desc: 'Switch an AP to Monitor mode (no client serving — full-time spectrum / wIPS scan). The AP reboots and rejoins.',
    example: 'AP will reboot and rejoin controller.',
    section: 'AP Management', type: 'config', flagged: true
  },

  // ---------- Tag assignment ----------
  {
    cmd: 'ap name AP-LON-01 tag site LONDON-SITE',
    desc: 'Assign a site tag to an AP. Site tags carry AP-join profile, flex profile, and RRM grouping.',
    example: 'Site tag assignment successful.',
    section: 'Tags & Profiles', type: 'config'
  },
  {
    cmd: 'ap name AP-LON-01 tag policy CORP-POLICY',
    desc: 'Assign a policy tag to an AP. Policy tags map WLAN profiles → policy profiles for this AP.',
    example: 'Policy tag assignment successful.',
    section: 'Tags & Profiles', type: 'config'
  },
  {
    cmd: 'ap name AP-LON-01 tag rf HIGH-DENSITY',
    desc: 'Assign an RF tag to an AP. RF tags hold per-band RF profiles (DCA / TPC / channel widths / data-rate sets).',
    example: 'RF tag assignment successful.',
    section: 'Tags & Profiles', type: 'config'
  },

  // ---------- LED control ----------
  {
    cmd: 'ap name AP-LON-01 led disable',
    desc: 'Turn off an AP\'s status LEDs (cosmetic — useful in customer-facing offices and dark-mode hospitality deployments).',
    example: 'LED state updated successfully.',
    section: 'AP Management', type: 'config'
  }
];

const wlc = data.platforms.wlc;
if (!wlc) throw new Error('wlc platform missing');

let updated = 0, addedNew = 0;
for (const e of ENTRIES) {
  // Search for an existing matching cmd anywhere in this platform.
  let found = null;
  for (const [secName, cmds] of Object.entries(wlc.sections || {})) {
    for (const c of cmds) {
      if (c.cmd === e.cmd) { found = { secName, c }; break; }
    }
    if (found) break;
  }
  if (found) {
    if (!found.c.example) { found.c.example = e.example; updated++; }
    if (!found.c.desc || found.c.desc.trim() === '') found.c.desc = e.desc;
    continue;
  }
  // Add new.
  wlc.sections[e.section] ||= [];
  wlc.sections[e.section].push({
    cmd: e.cmd,
    desc: e.desc,
    type: e.type || 'config',
    flagged: e.flagged || false,
    example: e.example
  });
  addedNew++;
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`Existing commands updated:`, updated);
console.log(`New commands added:`, addedNew);
