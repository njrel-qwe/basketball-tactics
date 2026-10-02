// Экран редактора тактики.
import { Geometry, Poly, dist, pt, sub, add } from './geometry.js';
import {
  BALL_OFFSET, BALL_R, CATEGORIES, HOME_SPOTS, MOVEMENT, TOKEN_R,
  advance, ballPosition, clone, guardSpot, hitToken, newId, startingFrame, token,
} from './model.js';
import { BALL_ID, drawBoard } from './render.js';
import { StepPlayer } from './player.js';
import { renderSheet, renderStep, shareOrDownload } from './exporter.js';
import { safeFileName, shareJsonFile, shareTacticLink } from './share.js';
import { confirmDialog, esc, form, h, icon, sheet, toast, vibrate } from './ui.js';

const TOOLS = [
  { id: 'select', label: 'Двигать', icon: 'hand', hint: 'Перетаскивайте игроков и мяч. Удержите палец на игроке или на пустом месте — откроется меню.' },
  { id: 'move', label: 'Бег', icon: 'move', hint: 'Проведите пальцем от игрока туда, куда он побежит.' },
  { id: 'dribble', label: 'Ведение', icon: 'dribble', hint: 'Проведите от игрока с мячом — путь ведения.' },
  { id: 'pass', label: 'Пас', icon: 'pass', hint: 'Проведите от игрока к партнёру — передача.' },
  { id: 'screen', label: 'Заслон', icon: 'screen', hint: 'Проведите от игрока к месту, где он поставит заслон.' },
  { id: 'eraser', label: 'Ластик', icon: 'eraser', hint: 'Коснитесь линии или игрока (или проведите по ним), чтобы удалить.' },
];
const LINE_NAMES = { move: 'Бег', dribble: 'Ведение', pass: 'Передача', screen: 'Заслон' };

export function openEditor(root, { tactic: initial, onBack, onSave }) {
  // ---------- Состояние ----------
  let tactic = clone(initial);
  let vi = 0;
  let tool = 'select';
  let straight = false;
  let draft = null;
  let highlight = null;
  let presenting = false;
  const undoStack = [];
  const redoStack = [];
  const player = new StepPlayer(() => { draw(); updateStepbar(); });

  const variant = () => tactic.variants[Math.min(vi, tactic.variants.length - 1)];
  const frames = () => variant().frames;
  const fi = () => Math.min(player.index, frames().length - 1);
  const frame = () => frames()[fi()];

  // ---------- Разметка ----------
  const el = h(`<div class="screen editor">
    <header class="bar">
      <button class="icon-btn" data-act="back" aria-label="Назад">${icon('back')}</button>
      <button class="bar-title" data-act="info"><span class="t-name"></span><small class="t-cat"></small></button>
      <button class="icon-btn" data-act="undo" aria-label="Отменить">${icon('undo')}</button>
      <button class="icon-btn" data-act="redo" aria-label="Повторить">${icon('redo')}</button>
      <button class="icon-btn" data-act="more" aria-label="Ещё">${icon('more')}</button>
    </header>
    <div class="board-wrap">
      <canvas class="board"></canvas>
      <div class="hint"></div>
      <div class="present-ui">
        <button class="icon-btn present-close" data-act="present-exit" aria-label="Закрыть показ">${icon('close')}</button>
        <div class="present-note"></div>
        <div class="present-ctrl">
          <button class="icon-btn big" data-act="prev">${icon('prev')}</button>
          <button class="play-btn" data-act="play">${icon('play')}</button>
          <button class="icon-btn big" data-act="next">${icon('next')}</button>
          <span class="step-label"></span>
        </div>
      </div>
    </div>
    <div class="side">
      <div class="variants chips scroll"></div>
      <button class="note-row" data-act="note"></button>
      <div class="stepbar">
        <button class="icon-btn" data-act="prev" aria-label="Предыдущий шаг">${icon('prev')}</button>
        <button class="step-label pill" data-act="steps"></button>
        <button class="play-btn" data-act="play" aria-label="Воспроизвести">${icon('play')}</button>
        <button class="icon-btn" data-act="next" aria-label="Следующий шаг">${icon('next')}</button>
        <button class="speed pill" data-act="speed">1×</button>
        <span class="grow"></span>
        <button class="add-step" data-act="add-step">${icon('plus')}<span>Шаг</span></button>
      </div>
      <div class="dock tools"></div>
      <div class="dock actions">
        <button data-act="add-home"><span class="ic-wrap home">${icon('person')}</span><span>Свой</span></button>
        <button data-act="add-away"><span class="ic-wrap away">${icon('person')}</span><span>Соперник</span></button>
        <button data-act="ball"><span class="ic-wrap ball">${icon('ball')}</span><span class="ball-label">Мяч</span></button>
        <button data-act="straight"><span class="ic-wrap">${icon('curve')}</span><span class="straight-label">Кривые</span></button>
        <button data-act="present"><span class="ic-wrap">${icon('present')}</span><span>Показ</span></button>
      </div>
    </div>
  </div>`);
  root.replaceChildren(el);

  const canvas = el.querySelector('canvas.board');
  const ctx = canvas.getContext('2d');
  const wrap = el.querySelector('.board-wrap');
  const toolsEl = el.querySelector('.tools');
  for (const t of TOOLS) {
    const b = h(`<button data-tool="${t.id}"><span class="ic-wrap">${icon(t.icon)}</span><span>${t.label}</span></button>`);
    toolsEl.append(b);
  }

  // ---------- История и сохранение ----------
  let saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    tactic.updatedAt = Date.now();
    onSave(clone(tactic));
  }
  const snapshot = () => ({ t: JSON.stringify(tactic), vi, fi: fi() });
  function checkpoint() {
    undoStack.push(snapshot());
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
  }
  function restore(s) {
    tactic = JSON.parse(s.t);
    vi = Math.min(s.vi, tactic.variants.length - 1);
    player.goTo(Math.min(s.fi, frames().length - 1));
    scheduleSave();
    refresh();
  }
  function undo() { const s = undoStack.pop(); if (!s) return; redoStack.push(snapshot()); restore(s); }
  function redo() { const s = redoStack.pop(); if (!s) return; undoStack.push(snapshot()); restore(s); }

  /** Изменение с записью в историю; mutate меняет tactic на месте. */
  function commit(mutate) {
    player.stop();
    checkpoint();
    mutate();
    scheduleSave();
    refresh();
  }
  const framesFromCurrent = () => frames().slice(fi());

  // ---------- Операции ----------
  function addPlayer(team, at = null) {
    const f = frame();
    const prefix = team === 'home' ? '' : 'X';
    let n = 1;
    while (f.tokens.some((t) => t.team === team && t.label === `${prefix}${n}`)) n++;
    let spot = at;
    if (!spot) {
      if (team === 'home') {
        spot = HOME_SPOTS.find((s) => !f.tokens.some((t) => dist(t, s) < 1)) || pt(7.5, 11);
      } else {
        const target = f.tokens.find((t) => t.team === 'home' && t.label === `${n}`);
        spot = target ? guardSpot(target) : guardSpot(HOME_SPOTS[(n - 1) % HOME_SPOTS.length]);
        if (f.tokens.some((t) => dist(t, spot) < 0.8)) spot = pt(7.5, 11.5);
      }
    }
    const tok = token(newId(), team, `${prefix}${n}`, spot);
    commit(() => framesFromCurrent().forEach((fr) => fr.tokens.push({ ...tok })));
    flash(tok.id);
  }

  function toggleBall() {
    const has = !!frame().ball;
    commit(() => framesFromCurrent().forEach((fr) => {
      if (has) {
        fr.ball = null;
        fr.lines = fr.lines.filter((l) => l.type !== 'pass');
      } else {
        const owner = fr.tokens.find((t) => t.team === 'home' && t.label === '1') || fr.tokens.find((t) => t.team === 'home');
        fr.ball = owner ? { owner: owner.id } : { owner: null, x: 7.5, y: 9 };
      }
    }));
  }

  function giveBall(id) {
    commit(() => {
      frame().ball = { owner: id };
    });
  }

  function placeBall(p) {
    commit(() => { frame().ball = { owner: null, x: p.x, y: p.y }; });
  }

  function removeToken(id) {
    for (const fr of framesFromCurrent()) {
      const tok = fr.tokens.find((t) => t.id === id);
      if (fr.ball?.owner === id && tok) fr.ball = { owner: null, x: tok.x + BALL_OFFSET.x, y: tok.y + BALL_OFFSET.y };
      fr.tokens = fr.tokens.filter((t) => t.id !== id);
      fr.lines = fr.lines.filter((l) => l.from !== id && l.to !== id);
    }
  }

  function setLabel(id, label) {
    const clean = label.trim().slice(0, 3);
    if (!clean) return;
    commit(() => tactic.variants.forEach((v) => v.frames.forEach((f) => f.tokens.forEach((t) => {
      if (t.id === id) t.label = clean;
    }))));
  }

  function addLine(line) {
    commit(() => {
      const f = frame();
      f.lines = f.lines.filter((old) => !(line.from && old.from === line.from && (
        (MOVEMENT.has(line.type) && MOVEMENT.has(old.type)) || (line.type === 'pass' && old.type === 'pass'))));
      f.lines.push(line);
    });
  }

  function addStep() {
    const nf = advance(frame());
    const at = fi() + 1;
    commit(() => variant().frames.splice(at, 0, nf));
    player.goTo(at);
    refresh();
  }

  function deleteStep() {
    if (frames().length <= 1) return;
    const at = fi();
    commit(() => variant().frames.splice(at, 1));
    player.goTo(Math.min(at, frames().length - 1));
    refresh();
  }

  function addVariant(copyCurrent) {
    const n = tactic.variants.length;
    const letter = n < 26 ? String.fromCharCode(65 + n) : `${n + 1}`;
    const base = copyCurrent ? clone(frames()) : [{ ...clone(frames()[0]), lines: [], note: '' }];
    commit(() => tactic.variants.push({ id: newId(), name: `Вариант ${letter}`, frames: base }));
    vi = tactic.variants.length - 1;
    player.goTo(0);
    refresh();
  }

  // ---------- Касания доски ----------
  let geom = null;
  let pointer = null; // {id, x, y, start, dragging, longFired, timer}
  let dragTarget = null;
  let dragOffset = pt(0, 0);
  let eraseCheckpointed = false;

  const hitBall = (p) => {
    const bp = ballPosition(frame().ball, frame().tokens);
    return bp && dist(bp, p) <= BALL_R + 0.35;
  };
  const hitLine = (p, max = 0.5) => {
    let best = null, bd = max;
    for (const l of frame().lines) {
      const d = Poly.distanceTo(l.points, p);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  };
  const courtPoint = (e) => {
    const r = canvas.getBoundingClientRect();
    return geom.toCourt(e.clientX - r.left, e.clientY - r.top);
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (pointer || presenting || !geom) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* синтетические события */ }
    const start = courtPoint(e);
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, start, dragging: false, longFired: false };
    if (tool === 'select') {
      pointer.timer = setTimeout(() => {
        if (!pointer || pointer.dragging) return;
        pointer.longFired = true;
        vibrate(20);
        onLongPress(start);
      }, 480);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const moved = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
    if (!pointer.dragging && !pointer.longFired && moved > 6) {
      pointer.dragging = true;
      clearTimeout(pointer.timer);
      onDragStart(pointer.start);
    }
    if (pointer.dragging) {
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of events.length ? events : [e]) onDrag(courtPoint(ce));
    }
  });

  const endPointer = (e, cancelled) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    clearTimeout(pointer.timer);
    const p = pointer;
    pointer = null;
    if (p.longFired) return;
    if (p.dragging) onDragEnd(cancelled);
    else if (!cancelled) onTap(p.start);
  };
  canvas.addEventListener('pointerup', (e) => endPointer(e, false));
  canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function onDragStart(p) {
    player.stop();
    const f = frame();
    if (tool === 'select') {
      dragTarget = hitBall(p) ? BALL_ID : hitToken(f, p)?.id || null;
      highlight = dragTarget;
      if (dragTarget) {
        checkpoint();
        const pos = dragTarget === BALL_ID ? ballPosition(f.ball, f.tokens) : f.tokens.find((t) => t.id === dragTarget);
        dragOffset = sub(pt(pos.x, pos.y), p);
      }
    } else if (tool === 'eraser') {
      eraseCheckpointed = false;
      eraseAt(p);
    } else {
      const from = hitToken(f, p, TOKEN_R + 0.6);
      draft = { id: newId(), type: tool, points: [from ? pt(from.x, from.y) : p], from: from?.id || null, to: null };
      highlight = from?.id || null;
    }
    draw();
  }

  function onDrag(p) {
    const f = frame();
    if (tool === 'select') {
      if (!dragTarget) return;
      const target = geom.clamp(add(p, dragOffset));
      if (dragTarget === BALL_ID) {
        f.ball = { owner: null, x: target.x, y: target.y };
      } else {
        const tok = f.tokens.find((t) => t.id === dragTarget);
        if (!tok) return;
        const dx = target.x - tok.x, dy = target.y - tok.y;
        tok.x = target.x; tok.y = target.y;
        // линии игрока переезжают вместе с ним
        for (const l of f.lines) if (l.from === tok.id) l.points = l.points.map((q) => pt(q.x + dx, q.y + dy));
      }
    } else if (tool === 'eraser') {
      eraseAt(p);
    } else if (draft) {
      const cp = geom.clamp(p);
      if (straight) draft.points = [draft.points[0], cp];
      else if (dist(draft.points[draft.points.length - 1], cp) >= 0.12) draft.points.push(cp);
    }
    draw();
  }

  function onDragEnd(cancelled) {
    const f = frame();
    if (tool === 'select') {
      if (dragTarget === BALL_ID) {
        const bp = ballPosition(f.ball, f.tokens);
        const owner = bp && hitToken(f, bp, TOKEN_R + 0.6);
        if (owner) f.ball = { owner: owner.id };
      }
      if (dragTarget) scheduleSave();
      dragTarget = null;
      highlight = null;
    } else if (tool === 'eraser') {
      if (eraseCheckpointed) scheduleSave();
    } else {
      const d = draft;
      draft = null;
      highlight = null;
      if (d && !cancelled && Poly.length(d.points) >= 0.6) {
        let pts = straight ? d.points : Poly.simplify(d.points, 0.05);
        if (pts.length < 2) pts = [d.points[0], d.points[d.points.length - 1]];
        const end = pts[pts.length - 1];
        let target = hitToken(f, end, TOKEN_R + 0.5, d.from);
        if (d.type === 'pass') {
          // пас в точку, куда игрок прибежит по своей стрелке
          const runEnd = f.lines
            .filter((l) => MOVEMENT.has(l.type) && l.from && l.from !== d.from)
            .map((l) => ({ l, p: l.points[l.points.length - 1] }))
            .filter((x) => dist(x.p, end) <= TOKEN_R + 0.5)
            .sort((a, b) => dist(a.p, end) - dist(b.p, end))[0];
          if (runEnd && (!target || dist(runEnd.p, end) < dist(target, end))) {
            target = { id: runEnd.l.from, x: runEnd.p.x, y: runEnd.p.y };
          }
        }
        if (d.type === 'pass' && target) {
          // конец передачи «прилипает» к адресату
          pts[pts.length - 1] = pt(target.x, target.y);
        }
        addLine({ ...d, points: pts, to: d.type === 'pass' ? target?.id || null : null });
        return;
      }
    }
    refresh();
  }

  function onTap(p) {
    player.stop();
    const f = frame();
    if (tool === 'eraser') {
      eraseCheckpointed = false;
      eraseAt(p);
      if (eraseCheckpointed) scheduleSave();
      refresh();
      return;
    }
    if (tool !== 'select') {
      if (!hitToken(f, p)) showHint(TOOLS.find((t) => t.id === tool).hint);
      return;
    }
    const tok = hitToken(f, p);
    if (tok) { flash(tok.id); return; }
    const line = hitLine(p);
    if (line) lineMenu(line);
  }

  function eraseAt(p) {
    const f = frame();
    const tok = hitToken(f, p, TOKEN_R + 0.15);
    const line = tok ? null : hitLine(p, 0.45);
    if (!tok && !line) return;
    if (!eraseCheckpointed) { checkpoint(); eraseCheckpointed = true; }
    vibrate(8);
    if (tok) removeToken(tok.id);
    else f.lines = f.lines.filter((l) => l.id !== line.id);
    draw();
  }

  function onLongPress(p) {
    const f = frame();
    const tok = hitToken(f, p);
    if (tok) return tokenMenu(tok);
    const line = hitLine(p);
    if (line) return lineMenu(line);
    sheet('Добавить сюда', [
      { icon: 'person', label: 'Своего игрока', action: () => addPlayer('home', geom.clamp(p)) },
      { icon: 'person', label: 'Соперника', action: () => addPlayer('away', geom.clamp(p)) },
      { icon: 'ball', label: f.ball ? 'Переложить мяч сюда' : 'Мяч', action: () => placeBall(geom.clamp(p)) },
    ]);
  }

  function tokenMenu(tok) {
    const f = frame();
    highlight = tok.id;
    draw();
    const items = [
      { icon: 'edit', label: 'Изменить номер / метку', action: () => labelDialog(tok) },
    ];
    if (f.ball?.owner !== tok.id) items.push({ icon: 'ball', label: 'Отдать мяч этому игроку', action: () => giveBall(tok.id) });
    const ml = f.lines.filter((l) => l.from === tok.id);
    if (ml.length) items.push({ icon: 'sweep', label: 'Стереть его линии на этом шаге', action: () => commit(() => { frame().lines = frame().lines.filter((l) => l.from !== tok.id); }) });
    items.push({ icon: 'trash', label: 'Удалить игрока', danger: true, action: () => commit(() => removeToken(tok.id)) });
    sheet(`${tok.team === 'home' ? 'Игрок' : 'Соперник'} ${tok.label}`, items);
    setTimeout(() => { highlight = null; draw(); }, 600);
  }

  function lineMenu(line) {
    const items = ['move', 'dribble', 'pass', 'screen'].map((type) => ({
      icon: type, label: LINE_NAMES[type], active: line.type === type,
      action: () => commit(() => {
        const l = frame().lines.find((x) => x.id === line.id);
        if (l) l.type = type;
      }),
    }));
    items.push('divider', {
      icon: 'trash', label: 'Удалить линию', danger: true,
      action: () => commit(() => { frame().lines = frame().lines.filter((l) => l.id !== line.id); }),
    });
    sheet('Линия', items);
  }

  function labelDialog(tok) {
    form('Номер или метка игрока', [
      { name: 'label', label: 'До 3 символов: 7, C, PG…', value: tok.label, max: 3, required: true },
    ], { onSubmit: (v) => setLabel(tok.id, v.label) });
  }

  function flash(id) {
    highlight = id;
    draw();
    setTimeout(() => { if (highlight === id) { highlight = null; draw(); } }, 500);
  }

  // ---------- Подсказки ----------
  const hintEl = el.querySelector('.hint');
  let hintTimer;
  function showHint(text) {
    hintEl.textContent = text;
    hintEl.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.remove('show'), 2800);
  }

  // ---------- Отрисовка ----------
  let rafPending = false;
  function draw() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      paint();
    });
  }

  function paint() {
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, hgt = wrap.clientHeight;
    if (!w || !hgt) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hgt * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hgt * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hgt}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const fs = frames();
    const i = fi();
    const pad = presenting ? 0 : 4;
    geom = drawBoard(ctx, { x: pad, y: pad, w: w - 2 * pad, h: hgt - 2 * pad }, tactic.court, fs[i], {
      next: fs[i + 1], progress: player.progress, draft, highlight,
    });
  }

  const ro = new ResizeObserver(() => paint());
  ro.observe(wrap);

  // ---------- Панели ----------
  function updateStepbar() {
    const n = frames().length;
    el.querySelectorAll('.step-label').forEach((s) => { s.textContent = `Шаг ${fi() + 1}/${n}`; });
    el.querySelectorAll('[data-act="play"]').forEach((b) => {
      b.innerHTML = icon(player.playing ? 'pause' : 'play');
      b.disabled = n < 2;
    });
    el.querySelectorAll('[data-act="prev"]').forEach((b) => { b.disabled = fi() === 0 && !player.animating; });
    el.querySelectorAll('[data-act="next"]').forEach((b) => { b.disabled = fi() >= n - 1; });
    el.querySelector('.present-note').textContent = frame().note || '';
    const note = el.querySelector('.note-row');
    note.innerHTML = `${icon('note')}<span>${frame().note ? esc(frame().note) : '<i>Комментарий к шагу…</i>'}</span>`;
  }

  function refresh() {
    el.querySelector('.t-name').textContent = tactic.name;
    el.querySelector('.t-cat').textContent = tactic.category || 'Нажмите, чтобы изменить';
    el.querySelector('[data-act="undo"]').disabled = !undoStack.length;
    el.querySelector('[data-act="redo"]').disabled = !redoStack.length;
    el.querySelector('.speed').textContent = player.speed === 2 ? '2×' : player.speed === 0.5 ? '½×' : '1×';

    const vEl = el.querySelector('.variants');
    vEl.innerHTML = '';
    tactic.variants.forEach((v, i) => {
      const c = h(`<button class="chip ${i === vi ? 'on' : ''}">${esc(v.name)}${i === vi ? icon('edit', 'xs') : ''}</button>`);
      c.addEventListener('click', () => (i === vi ? variantMenu(i) : selectVariant(i)));
      vEl.append(c);
    });
    const addV = h(`<button class="chip ghost">${icon('plus', 'xs')}Вариант</button>`);
    addV.addEventListener('click', () => sheet('Новый вариант', [
      { icon: 'copy', label: 'Копия текущего варианта', action: () => addVariant(true) },
      { icon: 'court', label: 'С начальной расстановки', action: () => addVariant(false) },
    ]));
    vEl.append(addV);

    toolsEl.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    el.querySelector('.ball-label').textContent = frame().ball ? 'Убрать мяч' : 'Мяч';
    el.querySelector('[data-act="straight"] .ic-wrap').innerHTML = icon(straight ? 'straight' : 'curve');
    el.querySelector('.straight-label').textContent = straight ? 'Прямые' : 'Кривые';
    updateStepbar();
    draw();
  }

  function selectVariant(i) {
    player.stop();
    vi = i;
    player.goTo(0);
    refresh();
  }

  function variantMenu(i) {
    sheet(tactic.variants[i].name, [
      { icon: 'edit', label: 'Переименовать', action: () => form('Название варианта', [
        { name: 'name', label: 'Название', value: tactic.variants[i].name, required: true },
      ], { onSubmit: (v) => v.name.trim() && commit(() => { tactic.variants[i].name = v.name.trim(); }) }) },
      { icon: 'copy', label: 'Дублировать', action: () => addVariant(true) },
      {
        icon: 'trash', label: 'Удалить вариант', danger: true, disabled: tactic.variants.length <= 1,
        action: () => confirmDialog(`Удалить «${tactic.variants[i].name}»?`, 'Все шаги этого варианта будут удалены.', 'Удалить', () => {
          commit(() => tactic.variants.splice(i, 1));
          vi = Math.max(0, Math.min(vi > i ? vi - 1 : vi, tactic.variants.length - 1));
          player.goTo(0);
          refresh();
        }),
      },
    ]);
  }

  function stepsMenu() {
    sheet('Шаги', frames().map((f, i) => ({
      label: `${i + 1}. ${f.note || `Шаг ${i + 1}`}`, active: i === fi(), action: () => player.goTo(i),
    })));
  }

  function infoDialog() {
    form('Тактика', [
      { name: 'name', label: 'Название', value: tactic.name, placeholder: 'Например, «Пик-н-ролл»', required: true },
      { name: 'category', label: 'Категория', type: 'chips', options: CATEGORIES, value: tactic.category, toggle: true },
      { name: 'description', label: 'Описание', type: 'textarea', value: tactic.description, placeholder: 'Необязательно' },
    ], {
      onSubmit: (v) => commit(() => {
        tactic.name = v.name.trim() || tactic.name;
        tactic.category = v.category;
        tactic.description = v.description.trim();
      }),
    });
  }

  function clearMenu() {
    sheet('Очистить', [
      { icon: 'sweep', label: 'Стереть линии на этом шаге', action: () => commit(() => { frame().lines = []; }) },
      { icon: 'trash', label: 'Очистить всю схему (пустая площадка)', danger: true, action: () => { commit(() => { variant().frames = [{ tokens: [], lines: [], ball: null, note: '' }]; }); player.goTo(0); refresh(); } },
      { icon: 'court', label: 'Заново: 5 на 5', action: () => { commit(() => { variant().frames = [startingFrame(5, 5)]; }); player.goTo(0); refresh(); } },
      { icon: 'court', label: 'Заново: только нападение', action: () => { commit(() => { variant().frames = [startingFrame(5, 0)]; }); player.goTo(0); refresh(); } },
    ]);
  }

  async function exportImage(all) {
    try {
      const c = all ? renderSheet(tactic, variant()) : renderStep(tactic, variant(), fi());
      const r = await shareOrDownload(c, tactic);
      if (r === 'downloaded') toast('Картинка сохранена в загрузки');
    } catch (e) {
      toast(`Не удалось: ${e.message}`);
    }
  }

  function moreMenu() {
    sheet(null, [
      { icon: 'edit', label: 'Название и описание', action: infoDialog },
      { icon: 'court', label: tactic.court === 'half' ? 'Показать всю площадку' : 'Показать половину площадки', action: () => commit(() => { tactic.court = tactic.court === 'half' ? 'full' : 'half'; }) },
      { icon: 'sweep', label: 'Очистить…', action: clearMenu },
      { icon: 'trash', label: `Удалить шаг ${fi() + 1}`, disabled: frames().length <= 1, action: () => confirmDialog(`Удалить шаг ${fi() + 1}?`, 'Игроки и линии этого шага пропадут.', 'Удалить', deleteStep) },
      'divider',
      { icon: 'image', label: 'Картинка: этот шаг', action: () => exportImage(false) },
      { icon: 'image', label: 'Картинка: все шаги на одном листе', action: () => exportImage(true) },
      { icon: 'link', label: 'Отправить ссылкой', action: () => shareTacticLink(tactic) },
      { icon: 'download', label: 'Сохранить файлом (.json)', action: () => shareJsonFile(tactic, `${safeFileName(tactic.name)}.json`) },
    ]);
  }

  function setPresenting(on) {
    presenting = on;
    player.stop();
    el.classList.toggle('presenting', on);
    if (on) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setTimeout(paint, 50);
    refresh();
  }

  // ---------- Кнопки ----------
  el.addEventListener('click', (e) => {
    const toolBtn = e.target.closest('[data-tool]');
    if (toolBtn) {
      tool = toolBtn.dataset.tool;
      showHint(TOOLS.find((t) => t.id === tool).hint);
      refresh();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const count = frames().length;
    switch (b.dataset.act) {
      case 'back': leave(); break;
      case 'info': infoDialog(); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'more': moreMenu(); break;
      case 'note': form(`Комментарий к шагу ${fi() + 1}`, [
        { name: 'note', label: 'Что происходит на этом шаге', type: 'textarea', value: frame().note },
      ], { onSubmit: (v) => commit(() => { frame().note = v.note.trim(); }) }); break;
      case 'prev': player.prev(); break;
      case 'next': player.next(count); break;
      case 'play': player.toggle(count); break;
      case 'steps': stepsMenu(); break;
      case 'speed': player.speed = player.speed === 1 ? 2 : player.speed === 2 ? 0.5 : 1; refresh(); break;
      case 'add-step': addStep(); showHint('Новый шаг: игроки встали в концы своих стрелок. Рисуйте следующее действие.'); break;
      case 'add-home': addPlayer('home'); break;
      case 'add-away': addPlayer('away'); break;
      case 'ball': toggleBall(); break;
      case 'straight': straight = !straight; refresh(); showHint(straight ? 'Линии рисуются прямыми' : 'Линии рисуются от руки'); break;
      case 'present': setPresenting(true); break;
      case 'present-exit': setPresenting(false); break;
      default: break;
    }
  });

  // Клавиатура (для планшета с клавиатурой/компьютера)
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (e.key === ' ') { e.preventDefault(); player.toggle(frames().length); }
    else if (e.key === 'ArrowRight') player.next(frames().length);
    else if (e.key === 'ArrowLeft') player.prev();
    else if (e.key === 'Escape' && presenting) setPresenting(false);
  };
  document.addEventListener('keydown', onKey);
  const onHide = () => { if (document.visibilityState === 'hidden') saveNow(); };
  document.addEventListener('visibilitychange', onHide);

  function leave() {
    player.stop();
    saveNow();
    onBack();
  }

  refresh();
  showHint(TOOLS[0].hint);

  return {
    destroy() {
      player.stop();
      saveNow();
      ro.disconnect();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    },
  };
}
