# Network KB — Project Guide for Claude

Static knowledge-base web app (HTML + ES modules) served by **GitHub Pages**.
No build step — pushing to `main` deploys automatically (~40 s via
`pages-build-deployment`). Admin edits commit through the GitHub Contents API.
A service worker (`sw.js`) caches the app shell.

Repo: `https://github.com/witherford/network_kb`

---

## Standing instructions (do these automatically — do not wait to be asked)

These apply to **every** task that changes code or data, unless the user
explicitly says otherwise.

### 1. Bump the version before every push to main
Run the version bump so the in-app "Check for updates" button has something to
detect (it compares `data/version.json` and the SW cache name, then calls
`purgeAndReload()`):

```
node scripts/bump-version.mjs            # patch  (1.4.1 → 1.4.2)
node scripts/bump-version.mjs minor      # 1.4.x → 1.5.0
node scripts/bump-version.mjs major      # 1.x.y → 2.0.0
node scripts/bump-version.mjs 1.6.0      # explicit
```

This atomically updates `data/version.json`, `js/version.js`
(`APP_VERSION` + `APP_BUILD`) and `sw.js` (`CACHE_VERSION = nkb-vN-YYYY-MM-DD`).
**Forgetting to bump means the update button finds nothing.**

### 2. Merge to main and deploy automatically
After finishing a change set, without being asked:
1. Commit on the working feature branch with a clear message.
2. Push the branch (`git push -u origin <branch>`).
3. Create a **draft PR** if one doesn't already exist.
4. Fast-forward merge the branch into `main` and push `main` — Pages then
   auto-deploys.

(The user's habitual phrasing "merge to main and push" maps to this exact
fast-forward + `git push origin main` flow.)

### 3. Quality sweep before committing
Run these every time and fix anything they surface — don't just report it:
- **Syntax / lint check** every touched module and the whole `js/` + `scripts/`
  tree: `node --check <file>` (there is no ESLint/package.json — `node --check`
  is the lint gate for this repo).
- **Validate JSON** under `data/` after any data change:
  `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"`.
- **Dead-code sweep** — remove unused functions, imports, variables, unreachable
  branches, and orphaned files introduced or exposed by the change.
- **Bug sweep** — re-read the diff for off-by-one, wrong selectors, broken
  template interpolation, and event-handler regressions before committing.

A quick one-liner for the syntax + JSON gate:

```
for f in $(find js scripts -name '*.js' -o -name '*.mjs'); do node --check "$f" || echo "FAIL $f"; done
for j in $(find data -name '*.json'); do node -e "JSON.parse(require('fs').readFileSync('$j','utf8'))" || echo "BAD $j"; done
```

---

## App structure

Pages: **commands** and **toolkit** only.

Toolkit groups:
- **Calculators** — subnet, vlsm, throughput, calculator
- **Cheat sheets** — cheatsheets, dscp
- **Password & Hash tools** — password, encoding
- **Scripts & builders** — ping, dns, OUI lookup, Cisco merger, TCL generator,
  jsonyaml, regex
- **Wireshark** — capture & display filters, display-filter library, CLI
  companion, keyboard shortcuts
- **WIFI tools** — standards, channels, signal, security (colour-coded; SVG
  diagrams)
- **Palo Alto** — Log filters (tabbed per log type) and Packet flow diagram
  (SVG + collapsible long-form sections)
- **Other** — world clock

### Key files
- `js/toolkit/pa-traffic-filters.js` — Palo Alto **Log filters**. Tabs per log
  type (Traffic / Threat / URL / WildFire / Auth / System / Config / Decryption
  / GP / Tunnel / User-ID). Each tab declares `fields` (`[key, label]` or
  `[key, label, optionsArray]` — a 3rd element renders a `<select>` dropdown of
  enumerable values instead of free text) and template `groups`. Enumerable
  value lists live in the `OPT` constant at the top of the file.
- `js/toolkit/pa-packet-flow.js` — PAN-OS packet flow diagram (inline SVG; do
  **not** hot-link third-party images — re-draw as SVG and credit a link).
- `js/toolkit/oui-shared.js` — CDP/LLDP parsers + interface normaliser shared by
  the Cisco merger.
- `js/toolkit/arp-mac-merge.js` — Cisco merger UI (ARP, MAC table, CDP, LLDP →
  merged results, with filter toggles).
- `data/commands.json` — command catalogue (Palo Alto heavily enriched; every
  command has desc + example). Re-runnable enrichment: `scripts/enrich-paloalto.mjs`.
- `js/app.js` — `wireVersionUI` drives the unified "Check for updates" button →
  `purgeAndReload()` wipes all Cache Storage, unregisters SWs, reloads with
  `?_v=…` to bypass HTTP cache.

---

## Git workflow

- Develop on the assigned feature branch; push; open a draft PR.
- Then fast-forward merge to `main` and push (see standing instruction #2).
- During `git rebase`, `--ours`/`--theirs` are inverted vs a merge — use
  `--theirs` to keep the rebased commit's changes.
- GitHub MCP tools are available for PR/issue/branch ops; no workflow-dispatch.
- CI is not configured, so `check_runs` is always empty.

## Gotchas
- After a push, hard-refresh the browser (Ctrl+Shift+R) to clear the in-memory
  SW cache until the new build's update button is itself loaded.
- Don't hot-link third-party images — re-draw as inline SVG and credit a link.
