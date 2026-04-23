// Generic modal helpers. openModal(render) returns a close() handle.

const root = () => document.getElementById('modalRoot');

export function openModal(renderFn, { wide = false, onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal' + (wide ? ' wide' : '');
  overlay.appendChild(modal);
  root().appendChild(overlay);

  function close() {
    overlay.remove();
    if (onClose) onClose();
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', escHandler);
  function escHandler(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } }

  renderFn(modal, close);
  return close;
}

export function confirmModal(message, { danger = false, okLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
  return new Promise(resolve => {
    openModal((el, close) => {
      el.innerHTML = `
        <h3>Confirm</h3>
        <p style="font-size:13px;line-height:1.5;color:var(--text-2)">${message}</p>
        <div class="modal-footer">
          <button class="btn" data-act="cancel">${cancelLabel}</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${okLabel}</button>
        </div>`;
      el.querySelector('[data-act=cancel]').addEventListener('click', () => { close(); resolve(false); });
      el.querySelector('[data-act=ok]').addEventListener('click', () => { close(); resolve(true); });
    });
  });
}

export function promptModal(title, { placeholder = '', initial = '', password = false } = {}) {
  return new Promise(resolve => {
    openModal((el, close) => {
      el.innerHTML = `
        <h3>${title}</h3>
        <div class="form-row">
          <input type="${password ? 'password' : 'text'}" id="pmInput" placeholder="${placeholder}" value="${initial}">
        </div>
        <div class="modal-footer">
          <button class="btn" data-act="cancel">Cancel</button>
          <button class="btn primary" data-act="ok">OK</button>
        </div>`;
      const input = el.querySelector('#pmInput');
      input.focus();
      input.select();
      function submit() { close(); resolve(input.value); }
      el.querySelector('[data-act=ok]').addEventListener('click', submit);
      el.querySelector('[data-act=cancel]').addEventListener('click', () => { close(); resolve(null); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') { close(); resolve(null); }
      });
    });
  });
}
