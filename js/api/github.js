// Minimal GitHub REST wrapper. Uses a fine-grained PAT with `contents:write`
// on this repo only. All calls are browser-side — the PAT only lives in memory
// during an unlocked edit session.

const API = 'https://api.github.com';

function b64encUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decUtf8(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function headers(pat) {
  return {
    'Authorization': 'Bearer ' + pat,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

export function parseRepo(ownerRepo) {
  const [owner, repo] = String(ownerRepo || '').trim().split('/');
  if (!owner || !repo) throw new Error('Invalid owner/repo: ' + ownerRepo);
  return { owner, repo };
}

export async function validatePat({ pat, repo }) {
  const { owner, repo: r } = parseRepo(repo);
  const res = await fetch(`${API}/repos/${owner}/${r}`, { headers: headers(pat) });
  if (res.status === 401) throw new Error('Bad PAT (401 unauthorized)');
  if (res.status === 404) throw new Error('Repo not found or PAT lacks access');
  if (!res.ok) throw new Error(`Repo access failed: HTTP ${res.status}`);
  const data = await res.json();
  return { defaultBranch: data.default_branch, private: data.private };
}

export async function getFile({ pat, repo, path, ref }) {
  const { owner, repo: r } = parseRepo(repo);
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const res = await fetch(
    `${API}/repos/${owner}/${r}/contents/${encodePath(path)}${q}`,
    { headers: headers(pat) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getFile ${path}: HTTP ${res.status}`);
  const data = await res.json();
  return { sha: data.sha, content: b64decUtf8(data.content) };
}

export async function putFile({ pat, repo, path, content, message, sha, branch }) {
  const { owner, repo: r } = parseRepo(repo);
  const body = {
    message,
    content: b64encUtf8(content),
    ...(sha ? { sha } : {}),
    ...(branch ? { branch } : {})
  };
  const res = await fetch(`${API}/repos/${owner}/${r}/contents/${encodePath(path)}`, {
    method: 'PUT',
    headers: { ...headers(pat), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.status === 409) throw new Error('Conflict — someone else edited this file. Reload and retry.');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`putFile ${path}: HTTP ${res.status} ${j.message || ''}`);
  }
  return res.json();
}

// Atomic multi-file commit via the Git Data API: one commit, N files.
export async function commitBatch({ pat, repo, branch, message, changes }) {
  const { owner, repo: r } = parseRepo(repo);
  const h = headers(pat);
  const br = branch || (await validatePat({ pat, repo })).defaultBranch || 'main';

  const refRes = await fetch(`${API}/repos/${owner}/${r}/git/ref/heads/${br}`, { headers: h });
  if (!refRes.ok) throw new Error(`get ref: HTTP ${refRes.status}`);
  const { object: { sha: baseSha } } = await refRes.json();

  const commitRes = await fetch(`${API}/repos/${owner}/${r}/git/commits/${baseSha}`, { headers: h });
  const { tree: { sha: baseTree } } = await commitRes.json();

  const blobs = await Promise.all(changes.map(async c => {
    const res = await fetch(`${API}/repos/${owner}/${r}/git/blobs`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: c.content, encoding: 'utf-8' })
    });
    if (!res.ok) throw new Error(`blob ${c.path}: HTTP ${res.status}`);
    const { sha } = await res.json();
    return { path: c.path, mode: '100644', type: 'blob', sha };
  }));

  const treeRes = await fetch(`${API}/repos/${owner}/${r}/git/trees`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTree, tree: blobs })
  });
  if (!treeRes.ok) throw new Error(`tree: HTTP ${treeRes.status}`);
  const { sha: treeSha } = await treeRes.json();

  const cRes = await fetch(`${API}/repos/${owner}/${r}/git/commits`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: treeSha, parents: [baseSha] })
  });
  if (!cRes.ok) throw new Error(`commit: HTTP ${cRes.status}`);
  const { sha: newCommit } = await cRes.json();

  const upRes = await fetch(`${API}/repos/${owner}/${r}/git/refs/heads/${br}`, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit })
  });
  if (!upRes.ok) {
    const j = await upRes.json().catch(() => ({}));
    throw new Error(`ref update: HTTP ${upRes.status} ${j.message || ''}`);
  }
  return { commitSha: newCommit, branch: br };
}

function encodePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}
