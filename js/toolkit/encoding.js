// Encoding / hash / JWT decoder / Cisco type-7 helpers — all client-side.

import { copyToClipboard, toast } from '../utils.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Encoding, hashing & decoders</h2>
    <div class="form-row">
      <label>Input</label>
      <textarea id="encIn" placeholder="Paste text, JWT, or Cisco type-7 hash here…"></textarea>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
      <button class="btn sm" data-act="b64enc">Base64 encode</button>
      <button class="btn sm" data-act="b64dec">Base64 decode</button>
      <button class="btn sm" data-act="b64url">Base64URL encode</button>
      <button class="btn sm" data-act="urlenc">URL encode</button>
      <button class="btn sm" data-act="urldec">URL decode</button>
      <button class="btn sm" data-act="hexenc">Hex encode</button>
      <button class="btn sm" data-act="hexdec">Hex decode</button>
      <button class="btn sm" data-act="jwt">Decode JWT</button>
      <button class="btn sm" data-act="cisco7dec">Cisco type-7 decode</button>
      <button class="btn sm" data-act="cisco7enc">Cisco type-7 encode</button>
      <button class="btn sm" data-act="md5">MD5</button>
      <button class="btn sm" data-act="sha1">SHA-1</button>
      <button class="btn sm" data-act="sha256">SHA-256</button>
      <button class="btn sm" data-act="sha512">SHA-512</button>
      <span class="spacer" style="flex:1"></span>
      <button class="btn sm ghost" id="encClear">Clear</button>
    </div>
    <div class="form-row">
      <label style="display:flex;align-items:center;justify-content:space-between">
        <span>Output</span>
        <button class="btn sm ghost" id="encCopy">Copy</button>
      </label>
      <pre class="script-out" id="encOut" style="min-height:120px"></pre>
    </div>
    <div class="hint" style="margin-top:6px">Cisco type-7 (the "service password-encryption" reversible obfuscation, NOT the "secret" PBKDF2 hash) is decoded fully. Type-5 (MD5) and type-8/9 are one-way and cannot be reversed here.</div>`;

  const $ = sel => root.querySelector(sel);
  const setOut = txt => { $('#encOut').textContent = txt; };

  const ACTS = {
    'b64enc':    s => safe(() => btoa(unescape(encodeURIComponent(s)))),
    'b64dec':    s => safe(() => decodeURIComponent(escape(atob(s.replace(/\s+/g,''))))),
    'b64url':    s => safe(() => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')),
    'urlenc':    s => encodeURIComponent(s),
    'urldec':    s => safe(() => decodeURIComponent(s)),
    'hexenc':    s => Array.from(new TextEncoder().encode(s)).map(b=>b.toString(16).padStart(2,'0')).join(''),
    'hexdec':    s => safe(() => new TextDecoder().decode(new Uint8Array(s.replace(/[^0-9a-f]/gi,'').match(/.{2}/g).map(b=>parseInt(b,16))))),
    'jwt':       s => decodeJwt(s),
    'cisco7dec': s => cisco7Decode(s),
    'cisco7enc': s => cisco7Encode(s),
    'md5':       async s => 'MD5: ' + (await hashWebCrypto(s, 'MD5')),
    'sha1':      async s => 'SHA-1: ' + (await hashWebCrypto(s, 'SHA-1')),
    'sha256':    async s => 'SHA-256: ' + (await hashWebCrypto(s, 'SHA-256')),
    'sha512':    async s => 'SHA-512: ' + (await hashWebCrypto(s, 'SHA-512')),
  };

  root.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const inp = $('#encIn').value;
    if (!inp.trim()) { toast('Input is empty', 'error'); return; }
    try {
      const r = await ACTS[act](inp);
      setOut(r);
    } catch (err) {
      setOut('Error: ' + err.message);
    }
  });

  $('#encClear').addEventListener('click', () => { $('#encIn').value = ''; setOut(''); });
  $('#encCopy').addEventListener('click', () => {
    const t = $('#encOut').textContent;
    if (!t) return;
    copyToClipboard(t).then(ok => toast(ok ? 'Output copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
}

function safe(fn) { try { return fn(); } catch (e) { return 'Error: ' + e.message; } }

async function hashWebCrypto(s, algo) {
  if (algo === 'MD5') return md5Hex(s);   // SubtleCrypto doesn't support MD5
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest(algo, buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function decodeJwt(s) {
  const parts = s.trim().split('.');
  if (parts.length < 2) return 'Not a JWT (need at least header.payload).';
  const dec = p => {
    p = p.replace(/-/g,'+').replace(/_/g,'/');
    while (p.length % 4) p += '=';
    return decodeURIComponent(escape(atob(p)));
  };
  let header, payload;
  try { header = JSON.parse(dec(parts[0])); } catch { return 'Header decode failed.'; }
  try { payload = JSON.parse(dec(parts[1])); } catch { return 'Payload decode failed.'; }
  const ts = k => payload[k] ? `${payload[k]}  (${new Date(payload[k]*1000).toISOString()})` : null;
  const enrich = { ...payload };
  for (const k of ['iat','exp','nbf','auth_time']) if (enrich[k]) enrich[k] = ts(k);
  let warn = '';
  if (payload.exp && Date.now()/1000 > payload.exp) warn = '\n!! TOKEN HAS EXPIRED';
  return [
    '— Header —',
    JSON.stringify(header, null, 2),
    '',
    '— Payload —',
    JSON.stringify(enrich, null, 2),
    '',
    '— Signature —',
    parts[2] ? parts[2] : '(none)',
    warn
  ].join('\n');
}

// Cisco type-7 reversible "encryption" used by service password-encryption.
// Algorithm: byte i XOR'd against KEY[(seed + i) % keylen], hex-encoded with
// a 2-digit decimal seed prefix. Key has been public for decades.
const C7_KEY = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';

function cisco7Decode(input) {
  const s = input.trim();
  const m = /^(\d{2})([0-9a-fA-F]+)$/.exec(s);
  if (!m) return 'Not a valid Cisco type-7 string (expected 2-digit seed + hex).';
  const seed = parseInt(m[1], 10);
  const hex  = m[2];
  if (hex.length % 2) return 'Hex portion has odd length.';
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i+2), 16);
    const k = C7_KEY.charCodeAt((seed + (i/2)) % C7_KEY.length);
    out += String.fromCharCode(b ^ k);
  }
  return 'Plain: ' + out;
}

function cisco7Encode(plain) {
  const seed = 2;  // arbitrary 0–15 normally; common starter
  let hex = '';
  for (let i = 0; i < plain.length; i++) {
    const k = C7_KEY.charCodeAt((seed + i) % C7_KEY.length);
    hex += (plain.charCodeAt(i) ^ k).toString(16).padStart(2, '0').toUpperCase();
  }
  return String(seed).padStart(2,'0') + hex;
}

// Tiny MD5 — adapted public-domain implementation.
function md5Hex(s) {
  function rh(n) { let s='',j; for(j=0;j<=3;j++) s+=((n>>(j*8+4))&0x0f).toString(16)+((n>>(j*8))&0x0f).toString(16); return s; }
  function ad(x,y) { const lsw=(x&0xFFFF)+(y&0xFFFF); const msw=(x>>16)+(y>>16)+(lsw>>16); return (msw<<16)|(lsw&0xFFFF); }
  function rol(n,c){return(n<<c)|(n>>>(32-c));}
  function cc(q,a,b,x,s,t){return ad(rol(ad(ad(a,q),ad(x,t)),s),b);}
  function ff(a,b,c,d,x,s,t){return cc((b&c)|((~b)&d),a,b,x,s,t);}
  function gg(a,b,c,d,x,s,t){return cc((b&d)|(c&(~d)),a,b,x,s,t);}
  function hh(a,b,c,d,x,s,t){return cc(b^c^d,a,b,x,s,t);}
  function ii(a,b,c,d,x,s,t){return cc(c^(b|(~d)),a,b,x,s,t);}
  function cb(s){const n=((s.length+8)>>6)+1, b=new Array(n*16).fill(0); for(let i=0;i<s.length;i++) b[i>>2]|=s.charCodeAt(i)<<((i%4)*8); b[s.length>>2]|=0x80<<((s.length%4)*8); b[n*16-2]=s.length*8; return b;}
  const x=cb(unescape(encodeURIComponent(s)));
  let a=1732584193, b=-271733879, c=-1732584194, d=271733878;
  for(let i=0;i<x.length;i+=16){
    const A=a,B=b,C=c,D=d;
    a=ff(a,b,c,d,x[i+ 0],7,-680876936); d=ff(d,a,b,c,x[i+ 1],12,-389564586); c=ff(c,d,a,b,x[i+ 2],17,606105819); b=ff(b,c,d,a,x[i+ 3],22,-1044525330);
    a=ff(a,b,c,d,x[i+ 4],7,-176418897); d=ff(d,a,b,c,x[i+ 5],12,1200080426); c=ff(c,d,a,b,x[i+ 6],17,-1473231341); b=ff(b,c,d,a,x[i+ 7],22,-45705983);
    a=ff(a,b,c,d,x[i+ 8],7,1770035416); d=ff(d,a,b,c,x[i+ 9],12,-1958414417); c=ff(c,d,a,b,x[i+10],17,-42063); b=ff(b,c,d,a,x[i+11],22,-1990404162);
    a=ff(a,b,c,d,x[i+12],7,1804603682); d=ff(d,a,b,c,x[i+13],12,-40341101); c=ff(c,d,a,b,x[i+14],17,-1502002290); b=ff(b,c,d,a,x[i+15],22,1236535329);
    a=gg(a,b,c,d,x[i+ 1],5,-165796510); d=gg(d,a,b,c,x[i+ 6],9,-1069501632); c=gg(c,d,a,b,x[i+11],14,643717713); b=gg(b,c,d,a,x[i+ 0],20,-373897302);
    a=gg(a,b,c,d,x[i+ 5],5,-701558691); d=gg(d,a,b,c,x[i+10],9,38016083); c=gg(c,d,a,b,x[i+15],14,-660478335); b=gg(b,c,d,a,x[i+ 4],20,-405537848);
    a=gg(a,b,c,d,x[i+ 9],5,568446438); d=gg(d,a,b,c,x[i+14],9,-1019803690); c=gg(c,d,a,b,x[i+ 3],14,-187363961); b=gg(b,c,d,a,x[i+ 8],20,1163531501);
    a=gg(a,b,c,d,x[i+13],5,-1444681467); d=gg(d,a,b,c,x[i+ 2],9,-51403784); c=gg(c,d,a,b,x[i+ 7],14,1735328473); b=gg(b,c,d,a,x[i+12],20,-1926607734);
    a=hh(a,b,c,d,x[i+ 5],4,-378558); d=hh(d,a,b,c,x[i+ 8],11,-2022574463); c=hh(c,d,a,b,x[i+11],16,1839030562); b=hh(b,c,d,a,x[i+14],23,-35309556);
    a=hh(a,b,c,d,x[i+ 1],4,-1530992060); d=hh(d,a,b,c,x[i+ 4],11,1272893353); c=hh(c,d,a,b,x[i+ 7],16,-155497632); b=hh(b,c,d,a,x[i+10],23,-1094730640);
    a=hh(a,b,c,d,x[i+13],4,681279174); d=hh(d,a,b,c,x[i+ 0],11,-358537222); c=hh(c,d,a,b,x[i+ 3],16,-722521979); b=hh(b,c,d,a,x[i+ 6],23,76029189);
    a=hh(a,b,c,d,x[i+ 9],4,-640364487); d=hh(d,a,b,c,x[i+12],11,-421815835); c=hh(c,d,a,b,x[i+15],16,530742520); b=hh(b,c,d,a,x[i+ 2],23,-995338651);
    a=ii(a,b,c,d,x[i+ 0],6,-198630844); d=ii(d,a,b,c,x[i+ 7],10,1126891415); c=ii(c,d,a,b,x[i+14],15,-1416354905); b=ii(b,c,d,a,x[i+ 5],21,-57434055);
    a=ii(a,b,c,d,x[i+12],6,1700485571); d=ii(d,a,b,c,x[i+ 3],10,-1894986606); c=ii(c,d,a,b,x[i+10],15,-1051523); b=ii(b,c,d,a,x[i+ 1],21,-2054922799);
    a=ii(a,b,c,d,x[i+ 8],6,1873313359); d=ii(d,a,b,c,x[i+15],10,-30611744); c=ii(c,d,a,b,x[i+ 6],15,-1560198380); b=ii(b,c,d,a,x[i+13],21,1309151649);
    a=ii(a,b,c,d,x[i+ 4],6,-145523070); d=ii(d,a,b,c,x[i+11],10,-1120210379); c=ii(c,d,a,b,x[i+ 2],15,718787259); b=ii(b,c,d,a,x[i+ 9],21,-343485551);
    a=ad(a,A); b=ad(b,B); c=ad(c,C); d=ad(d,D);
  }
  return rh(a)+rh(b)+rh(c)+rh(d);
}
