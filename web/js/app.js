// Точка входа: маршрутизация, список тактик, справочник.
import { CATEGORIES, newTactic, plural } from './model.js';
import { drawBoard, drawThumb } from './render.js';
import { PLAYBOOK, findPlay } from './playbook.js';
import { decodeTactic, duplicate, loadTactics, parseImport, requestPersistence, saveTactics } from './storage.js';
import { openEditor } from './editor.js';
import { StepPlayer } from './player.js';
import { safeFileName, shareJsonFile, shareTacticLink } from './share.js';
import { confirmDialog, esc, form, h, icon, infoDialog, sheet, toast } from './ui.js';

const app = document.getElementById('app');
let tactics = loadTactics();
let current = null; // { destroy() } активного экрана
let libTab = 'mine';
let query = '';

function persist() {
  if (!saveTactics(tactics)) toast('Не удалось сохранить: память браузера переполнена');
}

function upsert(t) {
  const i = tactics.findIndex((x) => x.id === t.id);
  if (i >= 0) tactics[i] = t; else tactics.unshift(t);
  persist();
}

// Сколько экранов открыто поверх списка внутри приложения — чтобы «Назад» не уводил с сайта.
let depth = 0;
const go = (hash) => { depth++; location.hash = hash; };
function back() {
  if (depth > 0) { depth--; history.back(); } else location.replace('#/');
}

// ---------- Маршруты ----------

async function route() {
  current?.destroy?.();
  current = null;
  const hash = location.hash.slice(1);
  if (!hash || hash === '/') depth = 0;

  if (hash.startsWith('t=')) return importFromLink(hash.slice(2));

  const [, kind, id] = hash.match(/^\/(t|p)\/(.+)$/) || [];
  if (kind === 't') {
    const t = tactics.find((x) => x.id === id);
    if (!t) return go('/');
    current = openEditor(app, {
      tactic: t,
      onBack: back,
      onSave: (nt) => upsert(nt),
    });
    return;
  }
  if (kind === 'p') {
    const entry = findPlay(id);
    if (!entry) return go('/');
    current = showPlay(entry);
    return;
  }
  showLibrary();
}

async function importFromLink(code) {
  try {
    const t = await decodeTactic(code);
    const existing = tactics.find((x) => x.id === t.id);
    const copy = existing ? duplicate(t) : { ...t, updatedAt: Date.now() };
    upsert(copy);
    history.replaceState(null, '', `${location.pathname}#/t/${copy.id}`);
    toast(`Тактика «${copy.name}» добавлена`);
    route();
  } catch {
    history.replaceState(null, '', `${location.pathname}#/`);
    toast('Ссылка повреждена — не удалось открыть тактику');
    route();
  }
}

// ---------- Библиотека ----------

function showLibrary() {
  const el = h(`<div class="screen library">
    <header class="bar">
      <div class="logo">${icon('ball')}</div>
      <div class="bar-title static"><span>Тактический планшет</span></div>
      <button class="icon-btn" data-act="menu" aria-label="Меню">${icon('more')}</button>
    </header>
    <div class="tabs">
      <button data-tab="mine">Мои тактики</button>
      <button data-tab="book">Готовые комбинации</button>
    </div>
    <div class="lib-body"></div>
    <button class="fab" data-act="new">${icon('plus')}<span>Новая тактика</span></button>
  </div>`);
  app.replaceChildren(el);
  const body = el.querySelector('.lib-body');

  function render() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === libTab));
    el.querySelector('.fab').hidden = libTab !== 'mine';
    body.innerHTML = '';
    if (libTab === 'mine') renderMine(body, render); else renderBook(body);
    body.querySelectorAll('canvas.thumb').forEach((c) => {
      const src = c._src;
      if (src) drawThumb(c, src.court, src.frame);
    });
  }

  el.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { libTab = tab.dataset.tab; render(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'new') newTacticDialog();
    if (b.dataset.act === 'menu') libraryMenu(render);
  });
  render();
}

function card(t, subtitle, footer, previewFrame, onOpen, onMenu) {
  const c = h(`<div class="card" role="button" tabindex="0">
    <canvas class="thumb"></canvas>
    <div class="card-text">
      <div class="card-title">${esc(t.name)}</div>
      <div class="card-sub">${esc(subtitle)}</div>
      <div class="card-foot">${esc(footer)}</div>
    </div>
    ${onMenu ? `<button class="icon-btn card-menu" aria-label="Действия">${icon('more')}</button>` : ''}
  </div>`);
  c.querySelector('canvas')._src = { court: t.court, frame: previewFrame };
  c.addEventListener('click', (e) => {
    if (e.target.closest('.card-menu')) onMenu();
    else onOpen();
  });
  return c;
}

function renderMine(body, rerender) {
  if (!tactics.length) {
    body.append(h(`<div class="empty">
      ${icon('ball', 'huge')}
      <h2>Пока нет тактик</h2>
      <p>Создайте первую схему или возьмите за основу готовую комбинацию.</p>
      <div class="row">
        <button class="btn filled" data-act="new">Создать</button>
        <button class="btn outline" data-goto-book>${icon('book')} Справочник</button>
      </div>
    </div>`));
    body.querySelector('[data-goto-book]').addEventListener('click', () => { libTab = 'book'; rerender(); });
    return;
  }
  if (tactics.length > 4) {
    const s = h(`<label class="search">${icon('search')}<input type="search" placeholder="Поиск по названию или категории" value="${esc(query)}"></label>`);
    const input = s.querySelector('input');
    input.addEventListener('input', () => { query = input.value; drawList(); });
    body.append(s);
  }
  const list = h('<div class="cards"></div>');
  body.append(list);
  const fmt = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function drawList() {
    list.innerHTML = '';
    const q = query.trim().toLowerCase();
    const items = tactics
      .filter((t) => !q || t.name.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    for (const t of items) {
      const steps = t.variants.reduce((s, v) => s + v.frames.length, 0);
      const sub = [t.category, plural(t.variants.length, 'вариант', 'варианта', 'вариантов'), plural(steps, 'шаг', 'шага', 'шагов')]
        .filter(Boolean).join(' · ');
      const c = card(t, sub, fmt.format(new Date(t.updatedAt)), t.variants[0].frames[0],
        () => go(`/t/${t.id}`), () => tacticMenu(t, rerender));
      list.append(c);
      drawThumb(c.querySelector('canvas'), t.court, t.variants[0].frames[0]);
    }
    if (!items.length) list.append(h('<p class="muted center">Ничего не найдено</p>'));
  }
  drawList();
}

function tacticMenu(t, rerender) {
  sheet(t.name, [
    { icon: 'edit', label: 'Переименовать', action: () => form('Переименовать', [
      { name: 'name', label: 'Название', value: t.name, required: true },
    ], { onSubmit: (v) => { if (v.name.trim()) { upsert({ ...t, name: v.name.trim(), updatedAt: Date.now() }); rerender(); } } }) },
    { icon: 'copy', label: 'Дублировать', action: () => { upsert(duplicate(t, `${t.name} (копия)`)); rerender(); } },
    { icon: 'link', label: 'Отправить ссылкой', action: () => shareTacticLink(t) },
    { icon: 'download', label: 'Сохранить файлом (.json)', action: () => shareJsonFile(t, `${safeFileName(t.name)}.json`) },
    'divider',
    { icon: 'trash', label: 'Удалить', danger: true, action: () => confirmDialog(`Удалить «${t.name}»?`, 'Тактика и все её варианты будут удалены.', 'Удалить', () => {
      tactics = tactics.filter((x) => x.id !== t.id);
      persist();
      rerender();
    }) },
  ]);
}

function renderBook(body) {
  body.append(h('<p class="muted intro">Классические комбинации с анимацией и объяснениями. Откройте, посмотрите и скопируйте к себе, чтобы изменить.</p>'));
  const list = h('<div class="cards"></div>');
  body.append(list);
  for (const e of PLAYBOOK) {
    const t = e.tactic;
    const f = t.variants[0].frames;
    const c = card(t, e.summary, `${t.category} · ${plural(t.variants.length, 'вариант', 'варианта', 'вариантов')}`,
      f[Math.min(1, f.length - 1)], () => go(`/p/${t.id}`), null);
    list.append(c);
  }
}

function newTacticDialog() {
  form('Новая тактика', [
    { name: 'name', label: 'Название', placeholder: 'Например, «Атака против зоны 2-3»', required: true },
    { name: 'category', label: 'Категория', type: 'chips', options: CATEGORIES, value: 'Нападение', toggle: true },
    { name: 'court', label: 'Площадка', type: 'chips', options: [['half', 'Половина'], ['full', 'Вся']], value: 'half' },
    { name: 'setup', label: 'Расстановка', type: 'chips', options: [['55', '5 на 5'], ['50', '5 нападающих'], ['00', 'Пусто']], value: '55' },
  ], {
    submit: 'Создать',
    onSubmit: (v) => {
      const t = newTactic({
        name: v.name.trim() || 'Новая тактика', category: v.category, court: v.court,
        home: Number(v.setup[0]), away: Number(v.setup[1]),
      });
      upsert(t);
      go(`/t/${t.id}`);
    },
  });
}

function libraryMenu(rerender) {
  sheet('Меню', [
    { icon: 'upload', label: 'Импорт из файла (.json)', action: () => importFile(rerender) },
    { icon: 'download', label: 'Резервная копия всех тактик', disabled: !tactics.length, action: () => {
      const d = new Date().toISOString().slice(0, 10);
      shareJsonFile({ version: 1, tactics }, `tactics-backup-${d}.json`);
    } },
    'divider',
    { icon: 'help', label: 'Как установить на телефон', action: installHelp },
    { icon: 'help', label: 'Управление', action: controlsHelp },
  ]);
}

function importFile(rerender) {
  const input = h('<input type="file" accept=".json,application/json" hidden>');
  document.body.append(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    try {
      const list = parseImport(await file.text());
      for (const t of list) upsert(tactics.some((x) => x.id === t.id) ? duplicate(t) : t);
      toast(`Импортировано: ${plural(list.length, 'тактика', 'тактики', 'тактик')}`);
      libTab = 'mine';
      rerender();
    } catch (e) {
      toast(`Не удалось импортировать: ${e.message}`);
    }
  });
  input.click();
}

function installHelp() {
  infoDialog('Установка на телефон', `
    <p><b>iPhone (Safari):</b> нажмите «Поделиться» <span class="kbd">⬆︎</span> внизу экрана → «На экран „Домой“» → «Добавить».</p>
    <p><b>Android (Chrome):</b> меню <span class="kbd">⋮</span> → «Добавить на главный экран» / «Установить приложение».</p>
    <p>После этого приложение открывается с иконки во весь экран и работает без интернета. Тактики хранятся на самом телефоне — для переноса используйте «Отправить ссылкой» или резервную копию.</p>`);
}

function controlsHelp() {
  infoDialog('Управление', `
    <p><b>Двигать</b> — перетаскивайте игроков и мяч. Мяч, брошенный на игрока, «прилипает» к нему.</p>
    <p><b>Удержание пальца</b> на игроке — номер, мяч, удаление. На пустом месте — добавить игрока прямо туда. Тап по линии — сменить тип или удалить.</p>
    <p><b>Бег / Ведение / Пас / Заслон</b> — проведите пальцем от игрока. Пас, отпущенный на партнёре, привязывается к нему.</p>
    <p><b>+ Шаг</b> — следующий этап: игроки встают в концы стрелок, мяч переходит к адресату паса.</p>
    <p><b>▶</b> — анимация всех шагов, <b>⏮ ⏭</b> — по одному шагу. <b>Показ</b> — крупная площадка без лишних кнопок для объяснения игрокам.</p>`);
}

// ---------- Просмотр готовой комбинации ----------

function showPlay(entry) {
  const t = entry.tactic;
  let vi = 0;
  const el = h(`<div class="screen play">
    <header class="bar">
      <button class="icon-btn" data-act="back" aria-label="Назад">${icon('back')}</button>
      <div class="bar-title static"><span>${esc(t.name)}</span><small>${esc(t.category)}</small></div>
      <button class="icon-btn" data-act="copy" aria-label="Скопировать к себе">${icon('copy')}</button>
    </header>
    <div class="play-layout">
      <div class="board-wrap"><canvas class="board"></canvas></div>
      <div class="play-side">
        <div class="variants chips scroll"></div>
        <div class="stepbar">
          <button class="icon-btn" data-act="prev">${icon('prev')}</button>
          <button class="play-btn" data-act="play">${icon('play')}</button>
          <button class="icon-btn" data-act="next">${icon('next')}</button>
          <span class="step-label"></span>
        </div>
        <div class="step-note"></div>
        <section class="explain">
          <h3>Суть</h3>
          <p>${esc(t.description)}</p>
          <h3>Ключевые моменты</h3>
          <ul>${entry.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
          <button class="btn filled wide" data-act="copy">${icon('copy')} Скопировать к себе и изменить</button>
        </section>
      </div>
    </div>
  </div>`);
  app.replaceChildren(el);
  const canvas = el.querySelector('canvas');
  const wrap = el.querySelector('.board-wrap');
  const ctx = canvas.getContext('2d');
  const frames = () => t.variants[vi].frames;
  const player = new StepPlayer(() => { paint(); update(); });

  function paint() {
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, hh = wrap.clientHeight;
    if (!w || !hh) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${hh}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fs = frames();
    const i = Math.min(player.index, fs.length - 1);
    drawBoard(ctx, { x: 0, y: 0, w, h: hh }, t.court, fs[i], { next: fs[i + 1], progress: player.progress });
  }
  function update() {
    const fs = frames();
    const i = Math.min(player.index, fs.length - 1);
    el.querySelector('.step-label').textContent = `Шаг ${i + 1} из ${fs.length}`;
    el.querySelector('.step-note').textContent = fs[i].note;
    el.querySelector('[data-act="play"]').innerHTML = icon(player.playing ? 'pause' : 'play');
    el.querySelector('[data-act="prev"]').disabled = i === 0;
    el.querySelector('[data-act="next"]').disabled = i >= fs.length - 1;
  }
  function renderVariants() {
    const v = el.querySelector('.variants');
    v.hidden = t.variants.length < 2;
    v.innerHTML = '';
    t.variants.forEach((x, i) => {
      const c = h(`<button class="chip ${i === vi ? 'on' : ''}">${esc(x.name)}</button>`);
      c.addEventListener('click', () => { vi = i; player.goTo(0); renderVariants(); });
      v.append(c);
    });
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const n = frames().length;
    switch (b.dataset.act) {
      case 'back': player.stop(); back(); break;
      case 'copy': {
        player.stop();
        const copy = duplicate(t);
        upsert(copy);
        toast('Скопировано в «Мои тактики»');
        location.replace(`#/t/${copy.id}`);
        break;
      }
      case 'prev': player.prev(); break;
      case 'next': player.next(n); break;
      case 'play': player.toggle(n); break;
      default: break;
    }
  });
  canvas.addEventListener('click', () => player.toggle(frames().length));
  const ro = new ResizeObserver(paint);
  ro.observe(wrap);
  renderVariants();
  update();
  return { destroy() { player.stop(); ro.disconnect(); } };
}

// ---------- Запуск ----------

window.addEventListener('hashchange', route);
requestPersistence();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
