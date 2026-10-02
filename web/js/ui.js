// Мелкие UI-помощники: элементы, иконки, нижние листы, диалоги, тосты.

const P = (d) => `<path d="${d}"/>`;
const S = (inner) => `<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;

export const ICONS = {
  back: P('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'),
  undo: P('M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z'),
  redo: P('M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z'),
  more: P('M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z'),
  play: P('M8 5v14l11-7z'),
  pause: P('M6 19h4V5H6v14zm8-14v14h4V5h-4z'),
  prev: P('M6 6h2v12H6zm3.5 6l8.5 6V6z'),
  next: P('M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z'),
  plus: P('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'),
  trash: P('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'),
  hand: P('M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z'),
  eraser: P('M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z'),
  person: P('M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'),
  ball: `<circle cx="12" cy="12" r="9" fill="currentColor"/>` + S('<circle cx="12" cy="12" r="9" stroke="#1b1b1b" stroke-width="1.6"/><path d="M3 12h18M12 3v18M6 5.5c3 3 3 10 0 13M18 5.5c-3 3-3 10 0 13" stroke="#1b1b1b" stroke-width="1.6"/>'),
  curve: S('<path d="M3 18C8 3 14 22 21 6"/>'),
  straight: S('<path d="M4 19L20 5"/>'),
  edit: P('M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'),
  close: P('M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'),
  share: P('M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z'),
  image: P('M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'),
  present: P('M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'),
  copy: P('M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z'),
  download: P('M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'),
  upload: P('M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z'),
  book: P('M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z'),
  search: P('M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'),
  note: P('M3 10h11v2H3zm0-4h11v2H3zm0 8h7v2H3zm17.59-2.07l.71-.71a1 1 0 0 0 0-1.41l-.71-.71a1 1 0 0 0-1.41 0l-.71.71zm-2.83.71L12 18.4V21h2.6l5.76-5.76z'),
  court: S('<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 12h18"/><circle cx="12" cy="12" r="3"/>'),
  sweep: P('M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z'),
  help: P('M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.54 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z'),
  video: P('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z'),
  link: P('M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z'),
  // стили линий
  move: S('<path d="M3 12h14"/>') + '<path d="M22 12l-6-4.5v9z"/>',
  dribble: S('<path d="M2 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0"/>') + '<path d="M22 12l-6-4.5v9z"/>',
  pass: S('<path d="M3 12h3M9 12h3M15 12h1.5" />') + '<path d="M22 12l-6-4.5v9z"/>',
  screen: S('<path d="M3 12h17M20 6v12"/>'),
};

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function vibrate(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* iOS не поддерживает */ }
}

// ---------- Тост ----------

let toastTimer;
export function toast(text, ms = 2200) {
  let el = document.getElementById('toast');
  if (!el) { el = h('<div id="toast" class="toast" role="status"></div>'); document.body.append(el); }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Слой поверх экрана ----------

export function openOverlay(content, opts) { return overlay(content, opts); }

function overlay(content, { onClose, kind = 'sheet' } = {}) {
  const root = h(`<div class="overlay ${kind}"><div class="scrim"></div></div>`);
  root.append(content);
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('open'));
  // Аппаратная/жестовая кнопка «Назад» закрывает лист, а не уходит с экрана.
  history.pushState({ overlay: true }, '');
  let closed = false;
  const onPop = () => finish(false);
  window.addEventListener('popstate', onPop);
  function finish(fromUi) {
    if (closed) return Promise.resolve();
    closed = true;
    window.removeEventListener('popstate', onPop);
    root.classList.remove('open');
    setTimeout(() => root.remove(), 200);
    onClose?.();
    if (!fromUi) return Promise.resolve();
    // убираем свою запись из истории и ждём, пока браузер это сделает
    return new Promise((resolve) => {
      const done = () => { window.removeEventListener('popstate', done); resolve(); };
      window.addEventListener('popstate', done);
      setTimeout(done, 400);
      history.back();
    });
  }
  const close = () => finish(true);
  root.querySelector('.scrim').addEventListener('click', close);
  return close;
}

/**
 * Нижний лист с действиями. items: [{icon, label, action, danger, disabled, active}] | 'divider'
 */
export function sheet(title, items) {
  const box = h(`<div class="sheet-box">
    <div class="grip"></div>
    ${title ? `<div class="sheet-title">${esc(title)}</div>` : ''}
    <div class="sheet-items"></div>
  </div>`);
  const list = box.querySelector('.sheet-items');
  const close = overlay(box);
  for (const it of items) {
    if (it === 'divider') { list.append(h('<div class="divider"></div>')); continue; }
    const b = h(`<button class="sheet-item ${it.danger ? 'danger' : ''} ${it.active ? 'active' : ''}" ${it.disabled ? 'disabled' : ''}>
      ${it.icon ? icon(it.icon) : '<span class="ic"></span>'}<span>${esc(it.label)}</span></button>`);
    b.addEventListener('click', () => {
      if (it.immediate) { close(); it.action?.(); } else close().then(() => it.action?.());
    });
    list.append(b);
  }
  return close;
}

/** Форма-диалог. fields: [{name, label, value, type: 'text'|'textarea'|'chips', options, placeholder, max}] */
export function form(title, fields, { submit = 'Готово', onSubmit, extraHtml = '' } = {}) {
  const box = h(`<form class="dialog-box" autocomplete="off">
    <div class="dialog-title">${esc(title)}</div>
    <div class="dialog-body"></div>
    ${extraHtml}
    <div class="dialog-actions">
      <button type="button" class="btn text" data-cancel>Отмена</button>
      <button type="submit" class="btn filled">${esc(submit)}</button>
    </div>
  </form>`);
  const body = box.querySelector('.dialog-body');
  const values = {};
  for (const f of fields) {
    values[f.name] = f.value ?? '';
    if (f.type === 'chips') {
      const wrap = h(`<div class="field"><div class="field-label">${esc(f.label)}</div><div class="chips wrap"></div></div>`);
      const chips = wrap.querySelector('.chips');
      const draw = () => {
        chips.innerHTML = '';
        for (const opt of f.options) {
          const [val, label] = Array.isArray(opt) ? opt : [opt, opt];
          const c = h(`<button type="button" class="chip ${values[f.name] === val ? 'on' : ''}">${esc(label)}</button>`);
          c.addEventListener('click', () => {
            values[f.name] = values[f.name] === val && f.toggle ? '' : val;
            draw();
          });
          chips.append(c);
        }
      };
      draw();
      body.append(wrap);
    } else {
      const tag = f.type === 'textarea'
        ? `<textarea name="${f.name}" rows="3" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`
        : `<input name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" ${f.max ? `maxlength="${f.max}"` : ''} ${f.required ? 'required' : ''} enterkeyhint="done">`;
      body.append(h(`<label class="field"><span class="field-label">${esc(f.label)}</span>${tag}</label>`));
    }
  }
  const close = overlay(box, { kind: 'dialog' });
  box.querySelector('[data-cancel]').addEventListener('click', close);
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    box.querySelectorAll('input, textarea').forEach((i) => { values[i.name] = i.value; });
    close().then(() => onSubmit?.(values));
  });
  const first = box.querySelector('input, textarea');
  if (first && fields[0]?.autofocus !== false) setTimeout(() => { first.focus(); first.select?.(); }, 250);
  return { box, close };
}

export function confirmDialog(title, text, okText, onOk) {
  const box = h(`<div class="dialog-box">
    <div class="dialog-title">${esc(title)}</div>
    <div class="dialog-text">${esc(text)}</div>
    <div class="dialog-actions">
      <button class="btn text" data-cancel>Отмена</button>
      <button class="btn filled danger" data-ok>${esc(okText)}</button>
    </div></div>`);
  const close = overlay(box, { kind: 'dialog' });
  box.querySelector('[data-cancel]').addEventListener('click', close);
  box.querySelector('[data-ok]').addEventListener('click', () => { close().then(onOk); });
}

export function infoDialog(title, html) {
  const box = h(`<div class="dialog-box">
    <div class="dialog-title">${esc(title)}</div>
    <div class="dialog-text">${html}</div>
    <div class="dialog-actions"><button class="btn filled" data-ok>Понятно</button></div></div>`);
  const close = overlay(box, { kind: 'dialog' });
  box.querySelector('[data-ok]').addEventListener('click', close);
}

/** Окно с прогрессом и кнопкой «Отмена». */
export function progressDialog(title, onCancel) {
  const box = h(`<div class="dialog-box">
    <div class="dialog-title">${esc(title)}</div>
    <div class="progress"><div class="progress-bar"></div></div>
    <p class="muted small">Не сворачивайте приложение до окончания записи.</p>
    <div class="dialog-actions"><button class="btn text" data-cancel>Отмена</button></div></div>`);
  let cancelled = false;
  const close = overlay(box, { kind: 'dialog', onClose: () => { if (!done) { cancelled = true; onCancel?.(); } } });
  let done = false;
  box.querySelector('[data-cancel]').addEventListener('click', close);
  return {
    set(p) { box.querySelector('.progress-bar').style.width = `${Math.round(p * 100)}%`; },
    finish() { done = true; return close(); },
    get cancelled() { return cancelled; },
  };
}
