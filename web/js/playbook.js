// Готовые комбинации с пошаговыми объяснениями.
import { pt as p } from './geometry.js';
import { advance, findToken, guardSpot, token } from './model.js';

const move = (id, ...pts) => ({ kind: 'mv', type: 'move', id, pts });
const dribble = (id, ...pts) => ({ kind: 'mv', type: 'dribble', id, pts });
const screen = (id, ...pts) => ({ kind: 'mv', type: 'screen', id, pts });
const pass = (from, to) => ({ kind: 'ps', from, to });

/**
 * Каждый step() фиксирует текущие позиции и линии; следующий шаг строится через advance().
 * При autoDefense защитник xN всегда опекает нападающего oN.
 */
class PlayBuilder {
  constructor(start, autoDefense) {
    this.auto = autoDefense;
    this.frames = [];
    this.cur = autoDefense ? this.defend(start) : start;
  }

  defend(f) {
    return {
      ...f,
      tokens: f.tokens.map((t) => {
        if (t.team !== 'away') return t;
        const target = findToken(f, 'o' + t.id.slice(1));
        if (!target) return t;
        const g = guardSpot(target);
        return { ...t, x: g.x, y: g.y };
      }),
    };
  }

  pos(id) { const t = findToken(this.cur, id); return p(t.x, t.y); }

  applyDefense(frame, defense) {
    return { ...frame, tokens: frame.tokens.map((t) => (defense[t.id] ? { ...t, ...defense[t.id] } : t)) };
  }

  step(note, specs, defense = {}) {
    const moves = specs.filter((s) => s.kind === 'mv').map((m) => ({
      id: Math.random().toString(36).slice(2), type: m.type, points: [this.pos(m.id), ...m.pts], from: m.id, to: null,
    }));
    const passes = specs.filter((s) => s.kind === 'ps').map((s) => {
      const mv = moves.find((m) => m.from === s.to);
      const end = mv ? mv.points[mv.points.length - 1] : this.pos(s.to);
      return { id: Math.random().toString(36).slice(2), type: 'pass', points: [this.pos(s.from), end], from: s.from, to: s.to };
    });
    const frame = { ...this.applyDefense(this.cur, defense), lines: [...moves, ...passes], note };
    this.frames.push(frame);
    const next = advance(frame);
    this.cur = this.auto ? this.defend(next) : next;
    return this;
  }

  finish(note, defense = {}) {
    this.frames.push({ ...this.applyDefense(this.cur, defense), note });
    return this.frames;
  }
}

const o = (n, at) => token(`o${n}`, 'home', `${n}`, at);
const x = (n, at = p(7.5, 7)) => token(`x${n}`, 'away', `X${n}`, at);
const fiveOnFive = (...offense) => ({
  tokens: [...offense.map((at, i) => o(i + 1, at)), ...offense.map((_, i) => x(i + 1))],
  lines: [], ball: { owner: 'o1' }, note: '',
});

const TOP = p(7.5, 9.2), L_WING = p(2.4, 6.4), R_WING = p(12.6, 6.4);
const L_CORNER = p(1.1, 1.2), R_CORNER = p(13.9, 1.2), L_BLOCK = p(5.3, 2.6), R_BLOCK = p(9.7, 2.6);
const L_ELBOW = p(5.3, 5.8), R_ELBOW = p(9.7, 5.8);

const tactic = (id, name, category, description, variants) => ({
  id, name, category, description, court: 'half', updatedAt: 0,
  variants: variants.map(([vname, frames], i) => ({ id: `${id}_${i}`, name: vname, frames })),
});

function pickAndRoll() {
  const start = () => fiveOnFive(TOP, R_WING, L_WING, L_CORNER, R_BLOCK);
  const common = (b) => b
    .step('5 поднимается от блока и ставит заслон защитнику X1 с правой стороны. 1 ждёт заслона.',
      [screen('o5', p(8.5, 8.2))])
    .step('1 обыгрывает заслон ведением вправо, проходя плечом к плечу с 5-м. 5 разворачивается и откатывается к кольцу (roll).',
      [dribble('o1', p(9.8, 8.7), p(11.2, 6.4)), move('o5', p(8.2, 5.8), p(7.6, 3.0))]);
  const a = common(new PlayBuilder(start(), true))
    .step('Защитник 5-го вышел на 1 — передача откатившемуся 5-му.', [pass('o1', 'o5')])
    .finish('5 завершает атаку у кольца: бросок или проход.');
  const b = common(new PlayBuilder(start(), true))
    .step('X4 помогает под кольцом против 5-го — 4 остаётся один в углу. Передача в угол.',
      [pass('o1', 'o4')], { x4: p(6.5, 3.4) })
    .finish('4 бросает трёхочковый из угла.', { x4: p(5.0, 3.2) });
  return {
    tactic: tactic('pb_pnr', 'Пик-н-ролл', 'Нападение',
      'Самая популярная двухходовка в баскетболе: высокий игрок ставит заслон владеющему мячом, после чего откатывается к кольцу. Защита вынуждена выбирать, кого закрывать.',
      [['Пас на ролл', a], ['Пас в угол', b]]),
    summary: 'Заслон для игрока с мячом и откат к кольцу.',
    keyPoints: [
      'Заслон ставится под углом, спиной к направлению, куда пойдёт защитник.',
      'Владеющий мячом ждёт, пока заслон поставлен, и проходит вплотную к заслоняющему.',
      'Заслоняющий откатывается только после того, как партнёр прошёл мимо.',
      'Читайте защиту: кто остался свободным — ролл, угол или собственный бросок.',
    ],
  };
}

function pickAndPop() {
  const f = new PlayBuilder(fiveOnFive(TOP, R_WING, L_CORNER, L_ELBOW, R_BLOCK), true)
    .step('4 поднимается от левого локтя и ставит заслон X1 слева.', [screen('o4', p(6.5, 8.3))])
    .step('1 атакует налево через заслон. 4 вместо отката выходит за трёхочковую линию (pop).',
      [dribble('o1', p(5.6, 9.4), p(4.0, 7.0)), move('o4', p(7.2, 9.6), p(8.8, 9.6))])
    .step('Защитник 4-го помогал против прохода — передача 4-му на открытый бросок.', [pass('o1', 'o4')])
    .finish('4 бросает из-за дуги либо атакует закрывающегося защитника проходом.');
  return {
    tactic: tactic('pb_pnp', 'Пик-н-поп', 'Нападение',
      'Разновидность пик-н-ролла для бросающего высокого игрока: после заслона он не идёт к кольцу, а отходит на дистанцию броска.',
      [['Основной', f]]),
    summary: 'Заслон и выход заслоняющего на бросок.',
    keyPoints: [
      'Подходит, если у четвёртого/пятого номера стабильный бросок.',
      'Выход (pop) — в сторону, противоположную проходу, чтобы растянуть защиту.',
      'Если защитник успел закрыть бросок — 4-й атакует его проходом.',
    ],
  };
}

function giveAndGo() {
  const f = new PlayBuilder(fiveOnFive(TOP, R_WING, L_WING, L_CORNER, L_BLOCK), true)
    .step('1 отдаёт передачу на фланг 2-му.', [pass('o1', 'o2')])
    .step('1 делает обманный шаг влево и резко врывается к кольцу перед своим защитником.',
      [move('o1', p(6.6, 8.0), p(8.6, 5.4), p(8.3, 2.6))])
    .step('2 возвращает мяч 1-му на рывке.', [pass('o2', 'o1')])
    .finish('1 завершает атаку лэй-апом.');
  return {
    tactic: tactic('pb_gng', 'Отдай и выйди', 'Нападение',
      'Простейшее взаимодействие двух игроков: отдал передачу — сразу рванул к кольцу за ответной.',
      [['Основной', f]]),
    summary: 'Передача и мгновенный рывок к кольцу (give-and-go).',
    keyPoints: [
      'После передачи защитник часто поворачивает голову за мячом — это момент для рывка.',
      'Обманное движение в противоположную сторону делает рывок эффективнее.',
      'Передача на рывке — с отскоком или навесом, на уровень груди.',
    ],
  };
}

function downScreen() {
  const f = new PlayBuilder(fiveOnFive(TOP, p(9.8, 2.0), L_WING, R_WING, L_BLOCK), true)
    .step('4 спускается с фланга и ставит заслон (даун-скрин) защитнику X2. 2 уводит своего защитника к лицевой линии.',
      [screen('o4', p(10.9, 3.4)), move('o2', p(9.4, 1.3))])
    .step('2 выходит из-под заслона наверх, на позицию 45°, плечом к плечу с заслоняющим.',
      [move('o2', p(10.6, 2.3), p(11.8, 3.6), p(12.6, 6.0))])
    .step('1 отдаёт передачу 2-му. 4 после заслона ныряет к кольцу, запирая защитника спиной (seal).',
      [pass('o1', 'o2'), move('o4', p(9.6, 2.4))])
    .finish('2 бросает с выхода либо отдаёт 4-му под кольцо.');
  return {
    tactic: tactic('pb_down', 'Выход из-под заслона', 'Нападение',
      'Игрок без мяча освобождается для броска, используя заслон партнёра (даун-скрин / пин-даун).',
      [['Даун-скрин', f]]),
    summary: 'Заслон без мяча для освобождения снайпера.',
    keyPoints: [
      'Сначала уведи защитника в противоположную сторону, потом выходи.',
      'Выходи вплотную к заслону — плечом к плечу, чтобы защитник не протиснулся.',
      'Защитник преследует сзади — закручивайся к кольцу (curl); срезает — уходи в угол (fade).',
      'Заслоняющий после заслона часто сам оказывается открыт (slip / seal).',
    ],
  };
}

function backdoor() {
  const f = new PlayBuilder(fiveOnFive(TOP, R_WING, L_WING, L_CORNER, L_BLOCK), true)
    .step('X2 плотно перекрывает передачу на фланг. 2 делает шаг навстречу мячу, затягивая защитника выше.',
      [move('o2', p(12.2, 7.8))], { x2: p(11.8, 6.9) })
    .step('Резкая смена направления: 2 уходит за спину защитнику к кольцу. 1 даёт передачу с отскоком.',
      [move('o2', p(11.6, 5.4), p(8.6, 2.4)), pass('o1', 'o2')], { x2: p(11.8, 8.3) })
    .finish('2 получает мяч под кольцом и забивает.', { x2: p(10.6, 4.4) });
  return {
    tactic: tactic('pb_backdoor', 'Бэкдор', 'Нападение',
      'Ответ на агрессивное перекрытие передач: нападающий уходит за спину защитнику к кольцу.',
      [['Основной', f]]),
    summary: 'Рывок за спину защитнику, перекрывающему передачу.',
    keyPoints: [
      'Сигнал для бэкдора — защитник стоит в линии передачи и смотрит на мяч.',
      'Затяни защитника на 1–2 шага выше, затем резкий рывок к кольцу.',
      'Передача — с отскоком, мимо руки защитника.',
    ],
  };
}

function zone23() {
  const zone = { x1: p(5.9, 7.3), x2: p(9.1, 7.3), x3: p(3.6, 3.2), x4: p(11.4, 3.2), x5: p(7.5, 2.8) };
  const shift = { x1: p(8.0, 7.0), x2: p(11.4, 6.4), x3: p(5.6, 3.4), x4: p(12.0, 2.8), x5: p(9.4, 2.6) };
  const after = { x1: p(7.0, 7.2), x2: p(10.4, 6.8), x3: p(4.8, 3.4), x4: p(11.0, 2.6), x5: p(7.6, 4.0) };
  const start = () => ({
    tokens: [
      o(1, p(7.5, 9.4)), o(2, R_WING), o(3, L_WING), o(4, p(11.4, 1.0)), o(5, p(4.6, 1.8)),
      x(1, zone.x1), x(2, zone.x2), x(3, zone.x3), x(4, zone.x4), x(5, zone.x5),
    ],
    lines: [], ball: { owner: 'o1' }, note: '',
  });
  const common = (b) => b
    .step('Нападение расставляется в «дыры» зоны 2-3. 1 переводит мяч на фланг 2-му.', [pass('o1', 'o2')])
    .step('Зона смещается к мячу. 5 с противоположного блока резко выходит на линию штрафного (флеш). 2 отдаёт ему.',
      [move('o5', p(6.0, 3.8), p(7.4, 5.6)), pass('o2', 'o5')], shift);
  const a = common(new PlayBuilder(start(), false))
    .step('X5 вынужден выйти на 5-го. 4 из-под щита ныряет к кольцу — передача сверху вниз (high-low).',
      [move('o4', p(9.0, 1.8)), pass('o5', 'o4')], after)
    .finish('4 получает мяч под кольцом: бросок без сопротивления.', after);
  const b = common(new PlayBuilder(start(), false))
    .step('X3 сместился в центр против 5-го — 3 сдвигается в свободную зону на 45° и получает передачу.',
      [move('o3', p(2.2, 4.6)), pass('o5', 'o3')], { x3: p(5.4, 4.4), x5: p(7.6, 3.6), x1: p(6.6, 7.2) })
    .finish('3 бросает открытый трёхочковый.');
  return {
    tactic: tactic('pb_zone23', 'Атака против зоны 2-3', 'Против зоны',
      'Мяч в высокий пост (на линию штрафного) — главный ключ против зоны 2-3: оттуда видно всю площадку, а каждый защитник зоны отвечает сразу за двоих.',
      [['Хай-лоу', a], ['Бросок с фланга', b]]),
    summary: 'Мяч на линию штрафного и передача в свободную зону.',
    keyPoints: [
      'Стойте в промежутках между защитниками зоны, а не напротив них.',
      'Быстрые передачи двигают зону быстрее, чем ведение.',
      'Игрок на линии штрафного развернулся лицом к кольцу — сразу видит всю зону.',
      'Атакуйте слабую сторону и пространство за спиной зоны (лицевая линия).',
    ],
  };
}

function horns() {
  const f = new PlayBuilder(fiveOnFive(TOP, L_CORNER, R_CORNER, L_ELBOW, R_ELBOW), true)
    .step('Расстановка «Хорнс»: двое высоких на локтях, крайние — в углах. 5 ставит заслон X1 справа.',
      [screen('o5', p(8.5, 8.3))])
    .step('1 атакует вправо через заслон. 5 откатывается к кольцу, 4 выходит за дугу наверх.',
      [dribble('o1', p(9.8, 8.8), p(11.2, 6.6)), move('o5', p(8.6, 4.6), p(8.2, 2.6)), move('o4', p(5.6, 8.6), p(7.2, 9.6))])
    .step('Защита сжалась против ролла — передача наверх 4-му.', [pass('o1', 'o4')])
    .finish('4 бросает или продолжает атаку передачей 5-му под кольцо (high-low).');
  return {
    tactic: tactic('pb_horns', 'Хорнс', 'Нападение',
      'Расстановка «рога»: двое высоких у локтей зоны дают разыгрывающему выбор, с чьим заслоном играть, а углы растягивают защиту.',
      [['Ролл и поп', f]]),
    summary: 'Двое высоких на локтях: пик-н-ролл с вариантами.',
    keyPoints: [
      'Расстановка сразу ставит защиту перед выбором — с какой стороны будет заслон.',
      'Один высокий откатывается, второй выходит на бросок — защите не хватает людей.',
      'Игроки в углах держат ширину и наказывают за помощь.',
    ],
  };
}

export const PLAYBOOK = [pickAndRoll(), pickAndPop(), giveAndGo(), downScreen(), backdoor(), zone23(), horns()];
export const findPlay = (id) => PLAYBOOK.find((e) => e.tactic.id === id);
