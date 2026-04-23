// Scientific calculator. Safe expression evaluator using the Function constructor
// with a restricted symbol surface (no globals reachable from the sandbox scope).

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Calculator</h2>
    <div style="max-width:380px">
      <input type="text" id="calcExpr" class="search-input" style="width:100%;font-family:'SF Mono',Consolas,monospace;font-size:15px;padding:10px" placeholder="e.g. sin(pi/4)*sqrt(2)">
      <div id="calcOut" style="text-align:right;font-family:'SF Mono',Consolas,monospace;font-size:20px;font-weight:600;color:var(--code);padding:14px 4px;min-height:48px"></div>
      <div id="calcKeys" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px"></div>
      <div style="margin-top:10px;font-size:11px;color:var(--text-3);line-height:1.6">
        Supported: + − × ÷ % , parentheses, pi, e, sin, cos, tan, asin, acos, atan, atan2, log (base e), log10, log2, sqrt, cbrt, pow, exp, abs, floor, ceil, round, min, max, factorial, sinh, cosh, tanh.
      </div>
    </div>`;

  const keys = [
    ['7','8','9','÷','C'],
    ['4','5','6','×','('],
    ['1','2','3','−',')'],
    ['0','.','π','+','='],
    ['sin','cos','tan','√','^'],
    ['log','ln','e','!','%']
  ];
  const keyEl = root.querySelector('#calcKeys');
  keyEl.innerHTML = keys.flat().map(k =>
    `<button class="btn" data-k="${k}" style="padding:10px 0">${k}</button>`).join('');

  const expr = root.querySelector('#calcExpr');
  const out = root.querySelector('#calcOut');

  function press(k) {
    if (k === 'C') { expr.value = ''; out.textContent = ''; return; }
    if (k === '=') { evalExpr(); return; }
    const map = { '÷': '/', '×': '*', '−': '-', 'π': 'pi', '√': 'sqrt(', 'ln': 'log(', '!': '!' };
    expr.value += map[k] !== undefined ? map[k] : k;
    expr.focus();
    evalExpr(true);
  }

  keyEl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-k]');
    if (btn) press(btn.dataset.k);
  });
  expr.addEventListener('input', () => evalExpr(true));
  expr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); evalExpr(); } });

  function evalExpr(preview = false) {
    const raw = expr.value.trim();
    if (!raw) { out.textContent = ''; return; }
    try {
      out.style.color = '';
      out.textContent = safeEval(raw);
    } catch (err) {
      out.style.color = 'var(--danger)';
      out.textContent = preview ? '' : err.message;
    }
  }
}

function safeEval(raw) {
  // replace UI symbols
  let src = raw.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
  // factorial: convert n! to fact(n)
  src = src.replace(/(\d+(?:\.\d+)?|\))!/g, (_, a) => 'fact(' + a + ')');
  // caret as exponent
  src = src.replace(/\^/g, '**');
  // whitelist of allowed identifiers
  if (!/^[\d\s+\-*/%().,a-zA-Z_]+$/.test(src)) throw new Error('Invalid characters');
  const allowed = /\b(pi|e|sin|cos|tan|asin|acos|atan|atan2|log|log10|log2|sqrt|cbrt|pow|exp|abs|floor|ceil|round|min|max|fact|sinh|cosh|tanh)\b/g;
  const stripped = src.replace(/\b(pi|e)\b/g, '').replace(allowed, '');
  if (/[a-zA-Z_]/.test(stripped)) throw new Error('Unknown symbol');

  const env = {
    pi: Math.PI, e: Math.E,
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    log: Math.log, log10: Math.log10, log2: Math.log2,
    sqrt: Math.sqrt, cbrt: Math.cbrt, pow: Math.pow, exp: Math.exp,
    abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
    min: Math.min, max: Math.max,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    fact: n => { if (n < 0 || !Number.isFinite(n)) return NaN; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  };
  const keys = Object.keys(env);
  const vals = keys.map(k => env[k]);
  const fn = new Function(...keys, 'return (' + src + ')');
  const v = fn(...vals);
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
  return String(+v.toPrecision(12));
}
