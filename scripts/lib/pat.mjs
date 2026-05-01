// PAT (GitHub Personal Access Token) loader for push helpers.
//
// Convention: the PAT lives ONE LEVEL UP from the repository root,
// i.e. in the OneDrive parent folder that contains both this clone
// and any other related working trees:
//
//   <parent-folder>/
//     .ghe.pat               ← the token, NOT under git control
//     Network_KB/            ← this repo
//     ...
//
// Keeping the file outside the repo guarantees it can never be
// committed or pushed by accident. Keeping it under OneDrive means
// it stays backed up and is available to any Windows user account
// that has OneDrive synced to this folder.
//
// Resolution order (first hit wins):
//   1.  process.env.NKB_PAT          — token directly in the env var
//   2.  process.env.NKB_PAT_FILE     — explicit override path
//   3.  <repoRoot>/../.ghe.pat       — default convention (this file)
//   4.  ~/.ghe.pat                   — legacy fallback (pre-relocation)
//
// Usage in a push helper:
//
//   import { readPAT } from './lib/pat.mjs';
//   const PAT = readPAT();   // throws with a clear error if not found

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));     // .../Network_KB/scripts/lib
const REPO_ROOT = resolve(HERE, '..', '..');              // .../Network_KB
const PARENT_DIR = resolve(REPO_ROOT, '..');              // .../Network knowledge base

/**
 * Read the GitHub PAT, returning a trimmed string. Throws a helpful
 * error listing every checked location when nothing is found.
 */
export function readPAT() {
  // 1. Token directly in env var.
  if (process.env.NKB_PAT && process.env.NKB_PAT.trim()) {
    return process.env.NKB_PAT.trim();
  }

  const tried = [];

  // 2. Explicit file override.
  if (process.env.NKB_PAT_FILE) {
    const p = process.env.NKB_PAT_FILE;
    tried.push(`${p}  (NKB_PAT_FILE)`);
    if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  }

  // 3. Convention: <repoRoot>/../.ghe.pat
  const conventionPath = join(PARENT_DIR, '.ghe.pat');
  tried.push(conventionPath);
  if (existsSync(conventionPath)) return readFileSync(conventionPath, 'utf8').trim();

  // 4. Legacy fallback: ~/.ghe.pat
  const legacyPath = join(homedir(), '.ghe.pat');
  tried.push(`${legacyPath}  (legacy)`);
  if (existsSync(legacyPath)) return readFileSync(legacyPath, 'utf8').trim();

  throw new Error(
    'PAT not found. Set $NKB_PAT, set $NKB_PAT_FILE, or place the token at one of:\n  ' +
    tried.join('\n  ')
  );
}

/** The conventional PAT path (used in error messages and docs). */
export const CONVENTION_PAT_PATH = join(PARENT_DIR, '.ghe.pat');
