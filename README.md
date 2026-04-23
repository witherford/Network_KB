# Network Knowledge Base

A self-hosted, single-repo network reference for command lookups, cheat sheets,
vendor software releases, troubleshooting guides, CVE feeds, and a toolkit of
network utilities.

Everything is static HTML + ES modules. Edits you make in the admin UI commit
back to the hosting repo via the GitHub Contents API, so the next page load in
any browser sees them.

## Features

- **Commands** — 2,500+ CLI commands across 15 platforms (NetScaler, Palo Alto,
  Cisco IOS/ASA, Linux, Wireshark, ESXi, Windows, AWS CLI, SDX, Nexus). Search,
  filter by platform or command type, favourites, recents, copy, and bulk CSV
  import/export.
- **Software releases** — Latest / recommended / EOL versions per vendor-product
  pair, populated by scheduled AI pulls.
- **Guides** — Step-by-step troubleshooting and configuration guides, also
  AI-populated.
- **CVEs** — Security advisories for tracked vendors/products with severity and
  NVD detail links.
- **Toolkit** — Subnet calculator (IPv4 + IPv6, supernet split), ping script
  builder (PowerShell / cmd / bash), DNS resolve script builder, AI-powered
  regex builder, scientific calculator, cheat sheets (TCP/UDP ports, IP
  protocols, multicast, IPv4/IPv6 specials, public allocations, admin
  distances, acronyms), world clock.
- **Settings** — Password-encrypted admin settings holding the GitHub PAT, a
  rotating ring of AI API keys, AI prompt templates, allowed source domains,
  vendor watchlist, cron schedule.

## Repo layout

```
index.html              app shell
css/                    main / components / themes
js/
  app.js                bootstrap + router
  state.js              central store + event bus
  prefs.js              per-viewer prefs (localStorage)
  utils.js              helpers (esc, hlText, copy, toast, debounce)
  dataloader.js         manifest + JSON fetchers
  crypto.js             PBKDF2 + AES-GCM (planned)
  api/                  github, ai, keyring (planned)
  auth/                 edit-mode + bootstrap wizard (planned)
  pages/                commands, software, guides, cves, toolkit, settings
  toolkit/              subnet, ping, dns, regex, calculator, cheatsheets, worldclock
  components/           modal, command-list, bulk-toolbar, csv
data/
  manifest.json         cache-bust timestamps
  commands.json         command database
  software.json
  guides.json
  cves.json
  cheatsheets/*.json    static cheat sheets
  settings.enc.json     encrypted admin settings
scripts/
  migrate-v12.mjs       one-shot v12 → commands.json migration
  ai-pull.mjs           scheduled AI runner (planned)
.github/workflows/
  ai-pull.yml           cron workflow (planned)
```

## Running locally

Module scripts require HTTP, not `file://`. Any static server works:

```bash
npx http-server . -p 5500 -c-1 --silent
# or
python -m http.server 5500
```

Open `http://localhost:5500`. The command database loads from
`data/commands.json`; per-viewer prefs (theme, font size, favourites, recent,
collapsed sections, clock zones) live in localStorage under `nkb.prefs.v1`.

## Deploying

1. Push the repo to GitHub.
2. In **Settings → Pages**, set source to `main` / root.
3. Wait for the first Pages build; the site is live at
   `https://<owner>.github.io/<repo>/`.
4. On first load the bootstrap wizard walks you through setting the admin
   password, the GitHub PAT, and the first AI key. It commits
   `data/settings.enc.json` and empty data stubs to the repo.

## Admin edit flow

1. Click **Edit** in the header → enter admin password.
2. The app decrypts `data/settings.enc.json` and activates edit UI across pages.
3. Make changes; each page shows a pending-changes banner.
4. Click **Save**. The app uses the decrypted PAT to commit the updated JSON
   via the GitHub Contents API with one descriptive commit per save (for
   multi-file changes, via the Git Data API for atomicity).
5. Click **Lock** (or wait for the 30-minute session timeout) to clear the key
   from memory.

The PAT needs `contents:write` on this repo only — a fine-grained token scoped
to the repo is ideal.

## CSV import / export (commands)

### Format

Header row (exact):

```
platform_key,platform_label,section,command,description,type
```

Example valid rows:

```csv
platform_key,platform_label,section,command,description,type
netscaler,NetScaler,System & Status,show ns info,Display system info,show
netscaler,NetScaler,System & Status,show ns runningconfig,Print running config,show
cisco_ios,Cisco IOS,Routing,show ip route,Print IPv4 routing table,show
cisco_ios,Cisco IOS,Interfaces,interface GigabitEthernet0/1,Enter interface config,config
```

### Field rules

| Field            | Required | Notes                                             |
|------------------|----------|---------------------------------------------------|
| `platform_key`   | yes      | Stable key (`netscaler`, `cisco_ios`, `asa`, ...) |
| `platform_label` | yes      | Display name. New if platform key doesn't exist   |
| `section`        | yes      | Created if it doesn't exist                       |
| `command`        | yes      | CLI command text                                  |
| `description`    | no       | Free text; embed commas by quoting the field      |
| `type`           | yes      | One of `show` / `config` / `troubleshooting`      |

### Common mistakes

```csv
# MISSING HEADER ROW — first row interpreted as data
netscaler,NetScaler,System & Status,show ns info,Display system info,show

# WRONG COLUMN ORDER — "show" and "System & Status" swapped
netscaler,NetScaler,show,show ns info,Display system info,System & Status

# UNQUOTED COMMA IN DESCRIPTION — splits into 7 fields
netscaler,NetScaler,System & Status,show ns info,Display system info, CPU and memory,show

# INVALID TYPE — must be show / config / troubleshooting
netscaler,NetScaler,System & Status,show ns info,Display system info,display
```

The import preview modal shows:

- **To add**: new rows the importer will insert
- **Duplicates**: exact matches on `platform_key + section + command` (skipped)
- **Errors**: rows failing validation, with line numbers

Round-trip is safe — exported CSV re-imports cleanly with 100% duplicate skip.

## Scheduled AI pulls

`scripts/ai-pull.mjs` runs from `.github/workflows/ai-pull.yml` on the schedule
configured in settings. It:

1. Reads `data/settings.enc.json` using the `SETTINGS_PASSWORD` Actions secret.
2. For each watchlist vendor × prompt type (software / guides / cves), rotates
   through enabled AI keys with cooldown on 429/5xx.
3. Validates JSON outputs against a schema and deduplicates against existing
   data.
4. Writes `data/software.json`, `data/guides.json`, `data/cves.json`,
   updates `data/manifest.json`, and commits with message
   `ai-pull: <counts>`.

When an admin changes the cron in the settings UI, Save also rewrites
`.github/workflows/ai-pull.yml` so the next scheduled run respects it.

## Migration from v12

```bash
node scripts/migrate-v12.mjs ../network_kb_v12.html data/commands.json
```

The script sandboxes an eval of the `RAW` literal, converts the legacy 3-tuple
command arrays to `{cmd, desc, type, flagged}` objects, and writes a v2 shape.

## Keyboard shortcuts

- `/` — focus the command search box
- `Esc` — close modal / clear search
- `Ctrl/Cmd + K` — open quick nav (planned)

## Privacy

- No analytics, no third-party scripts, no cookies.
- AI API keys live in `data/settings.enc.json` encrypted with PBKDF2-SHA256
  (600k iter) + AES-GCM. Plaintext is only ever in memory during an edit
  session. Keys never appear in the DOM or network traffic for unauthenticated
  viewers.
- Personal prefs (theme, favourites, clock zones) are in localStorage; they
  never commit to the repo.

## License

MIT.
