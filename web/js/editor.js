// Экран редактора тактики.
import { Geometry, Poly, dist, pt, sub, add } from './geometry.js';
import {
  BALL_OFFSET, BALL_R, CATEGORIES, HOME_SPOTS, MOVEMENT, TOKEN_R,
  advance, ballPosition, clone, guardSpot, hitToken, newId, startingFrame, token,
} from './model.js';
import { BALL_ID, ballOffset, drawBoard } from './render.js';
import { StepPlayer } from './player.js';
import { renderSheet, renderStep } from './exporter.js';
import { offerFile, safeFileName, shareJsonFile, shareTacticLink } from './share.js';
import { SPEEDS, getPref, setPref, speedLabel } from './storage.js';
import { recordVideo, videoSupported } from './video.js';
import { confirmDialog, form, h, icon, progressDialog, sheet, toast, vibrate } from './ui.js';

const TOOLS = [
  { id: 'select', label: 'Двигать', icon: 'hand', hint: 'Перетаскивайте игроков и мяч. Удержите палец на игроке или на пустом месте — откроется меню.' },
  { id: 'move', label: 'Бег', icon: 'move', hint: 'Проведите пальцем от игрока туда, куда он побежит.' },
  { id: 'dribble', label: 'Ведение', icon: 'dribble', hint: 'Проведите от игрока с мячом — путь ведения.' },
  { id: 'pass', label: 'Пас', icon: 'pass', hint: 'Проведите от игрока к партнёру — передача.' },
  { id: 'screen', label: 'Заслон', icon: 'screen', hint: 'Проведите от игрока к месту, где он поставит заслон.' },
  { id: 'eraser', label: 'Ластик', icon: 'eraser', hint: 'Коснитесь линии или игрока (или проведите по ним), чтобы удалить.' },
];
const MIN_TOKEN_PX = 14; // фишки на экране не мельче этого радиуса
const MAGNET = 2.0; // на каком расстоянии (м) мяч и пас «примагничиваются» к игроку
const LINE_NAMES = { move: 'Бег', dribble: 'Ведение', pass: 'Передача', screen: 'Заслон' };

export function openEditor(root, { tactic: initial, onBack, onSave }) {
  // ---------- Состояние ----------
  let tactic = clone(initial);
  let vi = 0;
  let tool = 'select';
  let straight = false;
  let draft = null;
  let highlight = null;
  let orientation = getPref('orientation', 'auto'); // auto | vertical | horizontal
  const undoStack = [];
  const redoStack = [];
  const player = new StepPlayer(() => { draw(); updateStepbar(); });
  player.speed = getPref('speed', 1);

  const variant = () => tactic.variants[Math.min(vi, tactic.variants.length - 1)];
  const frames = () => variant().frames;
  const fi = () => Math.min(player.index, frames().length - 1);
  const frame = () => frames()[fi()];

  // ---------- Разметка ----------
  const el = h(`<div class="screen editor">
    <div class="board-wrap">
      <canvas class="board"></canvas>
      <div class="floats top-left">
        <button class="fbtn round" data-act="back" aria-label="Назад">${icon('back')}</button>
        <button class="fbtn title" data-act="tactic-menu"><span class="t-name"></span><span class="t-var"></span></button>
      </div>
      <div class="floats top-right">
        <button class="fbtn step-pill" data-act="steps"></button>
        <button class="fbtn round" data-act="undo" aria-label="Отменить">${icon('undo')}</button>
        <button class="fbtn round" data-act="redo" aria-label="Повторить">${icon('redo')}</button>
      </div>
      <button class="fnote" data-act="note"></button>
      <div class="hint"></div>
    </div>
    <div class="controls">
      <div class="ctl-row tools"></div>
      <div class="ctl-row playrow">
        <button class="cbtn" data-act="prev" aria-label="Предыдущий шаг">${icon('prev')}</button>
        <button class="play-btn" data-act="play" aria-label="Воспроизвести">${icon('play')}</button>
        <button class="cbtn" data-act="next" aria-label="Следующий шаг">${icon('next')}</button>
        <button class="cbtn speed" data-act="speed" aria-label="Скорость">1×</button>
        <button class="cbtn add-step" data-act="add-step">${icon('plus')}<span>Шаг</span></button>
        <button class="cbtn" data-act="clear-lines" aria-label="Стереть линии">${icon('sweep')}<span>Стереть</span></button>
        <button class="cbtn" data-act="more" aria-label="Ещё">${icon('more')}<span>Ещё</span></button>
      </div>
    </div>
  </div>`);
  root.replaceChildren(el);

  const canvas = el.querySelector('canvas.board');
  const ctx = canvas.getContext('2d');
  const toolsEl = el.querySelector('.tools');
  for (const t of TOOLS) {
    toolsEl.append(h(`<button class="cbtn" data-tool="${t.id}">${icon(t.icon)}<span>${t.label}</span></button>`));
  }
  toolsEl.append(h(`<button class="cbtn add" data-act="add">${icon('person')}<span>Добавить</span></button>`));

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

  /**
   * Кому достанется мяч/пас в точке p: ближайший игрок той же команды в радиусе MAGNET,
   * а соперник — только если отпустить прямо на нём (перехват).
   */
  const receiverAt = (f, p, team = 'home', exclude = null) => {
    const near = (pred, radius) => f.tokens
      .filter((t) => t.id !== exclude && pred(t) && dist(t, p) <= radius)
      .sort((a, b) => dist(a, p) - dist(b, p))[0] || null;
    const mate = near((t) => t.team === team, MAGNET);
    const rival = near((t) => t.team !== team, TOKEN_R + 0.35);
    if (rival && (!mate || dist(rival, p) < dist(mate, p))) return rival;
    return mate;
  };
  const ballPos = (f) => ballPosition(f.ball, f.tokens, geom ? ballOffset(geom, MIN_TOKEN_PX) : undefined);
  const hitBall = (p) => {
    const bp = ballPos(frame());
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
    if (pointer || !geom) return;
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
        const pos = dragTarget === BALL_ID ? ballPos(f) : f.tokens.find((t) => t.id === dragTarget);
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
        // подсвечиваем игрока, которому достанется мяч
        highlight = receiverAt(f, target)?.id || BALL_ID;
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
        const owner = receiverAt(f, pt(f.ball.x, f.ball.y));
        if (owner) {
          f.ball = { owner: owner.id };
          vibrate(15);
        } else {
          showHint('Мяч лежит на полу. Перетащите его ближе к игроку — он окажется у него в руках.');
        }
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
        const passer = f.tokens.find((t) => t.id === d.from);
        let target = d.type === 'pass' ? receiverAt(f, end, passer?.team || 'home', d.from) : null;
        if (d.type === 'pass') {
          // пас в точку, куда игрок прибежит по своей стрелке
          const runEnd = f.lines
            .filter((l) => MOVEMENT.has(l.type) && l.from && l.from !== d.from)
            .map((l) => ({ l, p: l.points[l.points.length - 1] }))
            .filter((x) => dist(x.p, end) <= MAGNET)
            .sort((a, b) => dist(a.p, end) - dist(b.p, end))[0];
          if (runEnd && (!target || dist(runEnd.p, end) < dist(target, end))) {
            target = { id: runEnd.l.from, x: runEnd.p.x, y: runEnd.p.y };
          }
          if (!target) showHint('Пас никому не адресован — мяч останется на полу. Доведите стрелку до игрока.');
          else if (f.ball && f.ball.owner !== d.from) showHint('Пас начинается не от игрока с мячом — мяч не перейдёт.');
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
    const w = canvas.clientWidth, hgt = canvas.clientHeight;
    if (!w || !hgt) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hgt * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hgt * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const fs = frames();
    const i = fi();
    const rotate = orientation === 'auto' ? 'auto' : orientation === 'horizontal';
    geom = drawBoard(ctx, { x: 0, y: 0, w, h: hgt }, tactic.court, fs[i], {
      next: fs[i + 1], progress: player.progress, draft, highlight, rotate, minTokenPx: MIN_TOKEN_PX,
    });
  }

  const ro = new ResizeObserver(() => paint());
  ro.observe(canvas);

  // ---------- Панели ----------
  function updateStepbar() {
    const n = frames().length;
    el.querySelector('.step-pill').textContent = `Шаг ${fi() + 1}/${n}`;
    const play = el.querySelector('[data-act="play"]');
    play.innerHTML = icon(player.playing ? 'pause' : 'play');
    play.disabled = n < 2;
    el.querySelector('[data-act="prev"]').disabled = fi() === 0 && !player.animating;
    el.querySelector('[data-act="next"]').disabled = fi() >= n - 1;
    const note = el.querySelector('.fnote');
    note.textContent = frame().note || '';
    note.hidden = !frame().note;
  }

  function refresh() {
    el.querySelector('.t-name').textContent = tactic.name;
    el.querySelector('.t-var').textContent = tactic.variants.length > 1 ? variant().name : '';
    el.querySelector('[data-act="undo"]').disabled = !undoStack.length;
    const redoBtn = el.querySelector('[data-act="redo"]');
    redoBtn.hidden = !redoStack.length;
    el.querySelector('.speed').textContent = speedLabel(player.speed);
    el.querySelector('[data-act="clear-lines"]').disabled = !frame().lines.length;
    toolsEl.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    updateStepbar();
    draw();
  }

  function selectVariant(i) {
    player.stop();
    vi = i;
    player.goTo(0);
    refresh();
  }

  /** Меню по нажатию на название: варианты и свойства тактики. */
  function tacticMenu() {
    const items = tactic.variants.map((v, i) => ({
      icon: 'court', label: v.name, active: i === vi, action: () => selectVariant(i),
    }));
    items.push(
      { icon: 'copy', label: 'Новый вариант: копия текущего', action: () => addVariant(true) },
      { icon: 'plus', label: 'Новый вариант: с начальной расстановки', action: () => addVariant(false) },
      { icon: 'edit', label: `Переименовать «${variant().name}»`, action: () => form('Название варианта', [
        { name: 'name', label: 'Название', value: variant().name, required: true },
      ], { onSubmit: (v) => v.name.trim() && commit(() => { variant().name = v.name.trim(); }) }) },
    );
    if (tactic.variants.length > 1) {
      items.push({
        icon: 'trash', label: `Удалить «${variant().name}»`, danger: true,
        action: () => confirmDialog(`Удалить «${variant().name}»?`, 'Все шаги этого варианта будут удалены.', 'Удалить', () => {
          const i = vi;
          commit(() => tactic.variants.splice(i, 1));
          vi = Math.max(0, Math.min(i, tactic.variants.length - 1));
          player.goTo(0);
          refresh();
        }),
      });
    }
    items.push('divider', { icon: 'edit', label: 'Название и описание тактики', action: infoDialog });
    sheet(tactic.name, items);
  }

  function stepsMenu() {
    sheet('Шаги', frames().map((f, i) => ({
      label: `${i + 1}. ${f.note || `Шаг ${i + 1}`}`, active: i === fi(), action: () => player.goTo(i),
    })));
  }

  function addMenu() {
    sheet('Добавить', [
      { icon: 'person', label: 'Своего игрока', action: () => addPlayer('home') },
      { icon: 'person', label: 'Соперника', action: () => addPlayer('away') },
      { icon: 'ball', label: frame().ball ? 'Убрать мяч' : 'Мяч', action: toggleBall },
      'divider',
      { icon: 'help', label: 'Совет: удержите палец на пустом месте поля — игрок появится прямо там', disabled: true },
    ]);
  }

  function noteDialog() {
    form(`Комментарий к шагу ${fi() + 1}`, [
      { name: 'note', label: 'Что происходит на этом шаге', type: 'textarea', value: frame().note },
    ], { onSubmit: (v) => commit(() => { frame().note = v.note.trim(); }) });
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

  function restart(frame0) {
    commit(() => { variant().frames = [frame0]; });
    player.goTo(0);
    refresh();
  }

  function clearMenu() {
    sheet('Очистить', [
      { icon: 'sweep', label: 'Стереть линии на этом шаге', action: () => commit(() => { frame().lines = []; }) },
      { icon: 'trash', label: 'Очистить всю схему (пустая площадка)', danger: true, action: () => restart({ tokens: [], lines: [], ball: null, note: '' }) },
      { icon: 'court', label: 'Заново: 5 на 5', action: () => restart(startingFrame(5, 5)) },
      { icon: 'court', label: 'Заново: только нападение', action: () => restart(startingFrame(5, 0)) },
    ]);
  }

  async function exportImage(all) {
    try {
      const c = all ? renderSheet(tactic, variant()) : renderStep(tactic, variant(), fi());
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      offerFile(blob, `${safeFileName(tactic.name)}.png`, { title: 'Картинка готова', kind: 'image' });
    } catch (e) {
      toast(`Не удалось: ${e.message}`);
    }
  }

  async function exportVideo() {
    if (!videoSupported()) return toast('Этот браузер не умеет записывать видео');
    player.stop();
    const ctrl = new AbortController();
    const pd = progressDialog(`Запись видео · скорость ${speedLabel(player.speed)}`, () => ctrl.abort());
    try {
      const res = await recordVideo(tactic, variant(), { speed: player.speed, onProgress: (p) => pd.set(p), signal: ctrl.signal });
      if (!res || pd.cancelled) return;
      await pd.finish();
      offerFile(res.blob, `${safeFileName(tactic.name)}.${res.ext}`, { title: 'Видео готово', kind: 'video' });
    } catch (e) {
      await pd.finish();
      toast(`Не удалось записать видео: ${e.message}`);
    }
  }

  function setOrientation(o) {
    orientation = o;
    setPref('orientation', o);
    paint();
  }

  const fullscreenAvailable = () => document.fullscreenEnabled && !matchMedia('(display-mode: standalone)').matches;

  function moreMenu() {
    const names = { auto: 'авто', vertical: 'вертикально', horizontal: 'боком' };
    const nextOrient = { auto: 'horizontal', horizontal: 'vertical', vertical: 'auto' }[orientation];
    const items = [
      { icon: 'note', label: frame().note ? 'Изменить комментарий к шагу' : 'Комментарий к шагу', action: noteDialog },
      {
        icon: straight ? 'curve' : 'straight', label: straight ? 'Рисовать от руки' : 'Рисовать прямыми линиями',
        action: () => { straight = !straight; showHint(straight ? 'Линии рисуются прямыми' : 'Линии рисуются от руки'); },
      },
      { icon: 'court', label: tactic.court === 'half' ? 'Вся площадка' : 'Половина площадки', action: () => commit(() => { tactic.court = tactic.court === 'half' ? 'full' : 'half'; }) },
      { icon: 'court', label: `Положение поля: ${names[orientation]} → ${names[nextOrient]}`, action: () => setOrientation(nextOrient) },
    ];
    if (fullscreenAvailable()) {
      items.push({
        icon: 'present', label: document.fullscreenElement ? 'Выйти из полноэкранного режима' : 'Во весь экран', immediate: true,
        action: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}),
      });
    }
    items.push(
      { icon: 'trash', label: `Удалить шаг ${fi() + 1}`, disabled: frames().length <= 1, action: () => confirmDialog(`Удалить шаг ${fi() + 1}?`, 'Игроки и линии этого шага пропадут.', 'Удалить', deleteStep) },
      { icon: 'sweep', label: 'Очистить…', action: clearMenu },
      'divider',
      { icon: 'video', label: 'Сохранить видео', disabled: frames().length < 2, action: exportVideo },
      { icon: 'image', label: 'Картинка: этот шаг', action: () => exportImage(false) },
      { icon: 'image', label: 'Картинка: все шаги на одном листе', action: () => exportImage(true) },
      { icon: 'link', label: 'Отправить ссылкой', immediate: true, action: () => shareTacticLink(tactic) },
      { icon: 'download', label: 'Сохранить файлом (.json)', immediate: true, action: () => shareJsonFile(tactic, `${safeFileName(tactic.name)}.json`) },
    );
    sheet(null, items);
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
      case 'tactic-menu': tacticMenu(); break;
      case 'add': addMenu(); break;
      case 'clear-lines': commit(() => { frame().lines = []; }); showHint('Линии стёрты. Вернуть — кнопка «Отменить» сверху.'); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'more': moreMenu(); break;
      case 'note': noteDialog(); break;
      case 'prev': player.prev(); break;
      case 'next': player.next(count); break;
      case 'play': player.toggle(count); break;
      case 'steps': stepsMenu(); break;
      case 'speed': {
        player.speed = SPEEDS[(SPEEDS.indexOf(player.speed) + 1) % SPEEDS.length];
        setPref('speed', player.speed);
        showHint(`Скорость воспроизведения ${speedLabel(player.speed)}`);
        refresh();
        break;
      }
      case 'add-step': addStep(); showHint('Новый шаг: игроки встали в концы своих стрелок. Рисуйте следующее действие.'); break;
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
