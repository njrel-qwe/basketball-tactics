package com.coach.tacticboard.data

/** Готовая комбинация из справочника. */
data class PlaybookEntry(
    val tactic: Tactic,
    val summary: String,
    val keyPoints: List<String>,
)

// ---------- Конструктор комбинаций ----------

private fun p(x: Float, y: Float) = Pt(x, y)

private sealed interface Spec
private data class Mv(val type: LineType, val id: String, val pts: List<Pt>) : Spec
private data class Ps(val from: String, val to: String) : Spec

private fun move(id: String, vararg pts: Pt): Spec = Mv(LineType.MOVE, id, pts.toList())
private fun dribble(id: String, vararg pts: Pt): Spec = Mv(LineType.DRIBBLE, id, pts.toList())
private fun screen(id: String, vararg pts: Pt): Spec = Mv(LineType.SCREEN, id, pts.toList())
private fun pass(from: String, to: String): Spec = Ps(from, to)

/**
 * Пошаговое описание: каждый step() фиксирует текущие позиции и линии,
 * а следующий шаг строится автоматически через [advance].
 * При [autoDefense] защитник xN всегда опекает нападающего oN.
 */
private class PlayBuilder(start: Frame, private val autoDefense: Boolean) {
    private var cur: Frame = start
    val frames = mutableListOf<Frame>()

    init {
        if (autoDefense) cur = defend(cur)
    }

    private fun defend(f: Frame): Frame = f.copy(tokens = f.tokens.map { t ->
        if (t.team == Team.AWAY) {
            val target = f.token("o" + t.id.removePrefix("x"))
            if (target != null) t.at(guardSpot(target.pos)) else t
        } else t
    })

    private fun pos(id: String) = cur.token(id)!!.pos

    fun step(note: String, vararg specs: Spec, defense: Map<String, Pt> = emptyMap()) {
        val moves = specs.filterIsInstance<Mv>().map { m ->
            DrawLine(type = m.type, points = listOf(pos(m.id)) + m.pts, fromId = m.id)
        }
        val passes = specs.filterIsInstance<Ps>().map { s ->
            val end = moves.firstOrNull { it.fromId == s.to }?.points?.last() ?: pos(s.to)
            DrawLine(type = LineType.PASS, points = listOf(pos(s.from), end), fromId = s.from, toId = s.to)
        }
        val withDefense = cur.copy(tokens = cur.tokens.map { t -> defense[t.id]?.let { t.at(it) } ?: t })
        val frame = withDefense.copy(lines = moves + passes, note = note)
        frames += frame
        cur = frame.advance().let { if (autoDefense) defend(it) else it }
    }

    fun finish(note: String, defense: Map<String, Pt> = emptyMap()): List<Frame> {
        frames += cur.copy(note = note, tokens = cur.tokens.map { t -> defense[t.id]?.let { t.at(it) } ?: t })
        return frames.toList()
    }
}

private fun o(n: Int, at: Pt) = Token("o$n", Team.HOME, "$n", at.x, at.y)
private fun x(n: Int, at: Pt = Pt(7.5f, 7f)) = Token("x$n", Team.AWAY, "X$n", at.x, at.y)

private fun frameOf(vararg tokens: Token, ballOwner: String = "o1") =
    Frame(tokens = tokens.toList(), ball = Ball(ownerId = ballOwner))

private fun fiveOnFive(vararg offense: Pt): Frame {
    val tokens = offense.mapIndexed { i, pt -> o(i + 1, pt) } + offense.indices.map { x(it + 1) }
    return Frame(tokens = tokens, ball = Ball(ownerId = "o1"))
}

// Ключевые точки площадки (кольцо сверху)
private val TOP = p(7.5f, 9.2f)
private val L_WING = p(2.4f, 6.4f)
private val R_WING = p(12.6f, 6.4f)
private val L_CORNER = p(1.1f, 1.2f)
private val R_CORNER = p(13.9f, 1.2f)
private val L_BLOCK = p(5.3f, 2.6f)
private val R_BLOCK = p(9.7f, 2.6f)
private val L_ELBOW = p(5.3f, 5.8f)
private val R_ELBOW = p(9.7f, 5.8f)

// ---------- Справочник ----------

object Playbook {

    val entries: List<PlaybookEntry> by lazy {
        listOf(pickAndRoll(), pickAndPop(), giveAndGo(), downScreen(), backdoor(), zone23(), horns())
    }

    fun find(id: String) = entries.firstOrNull { it.tactic.id == id }

    private fun pnrStart() = fiveOnFive(TOP, R_WING, L_WING, L_CORNER, R_BLOCK)

    private fun pnrCommon(b: PlayBuilder) {
        b.step(
            "5 поднимается от блока и ставит заслон защитнику X1 с правой стороны. 1 готовит проход, дожидаясь заслона.",
            screen("o5", p(8.5f, 8.2f)),
        )
        b.step(
            "1 обыгрывает заслон ведением вправо, проходя плечом к плечу с 5-м. 5 разворачивается и откатывается к кольцу (roll).",
            dribble("o1", p(9.8f, 8.7f), p(11.2f, 6.4f)),
            move("o5", p(8.2f, 5.8f), p(7.6f, 3.0f)),
        )
    }

    private fun pickAndRoll(): PlaybookEntry {
        val a = PlayBuilder(pnrStart(), autoDefense = true).also { b ->
            pnrCommon(b)
            b.step("Защитник 5-го вышел на 1 — передача откатившемуся 5-му.", pass("o1", "o5"))
        }.finish("5 завершает атаку у кольца: бросок или проход.")

        val bFrames = PlayBuilder(pnrStart(), autoDefense = true).also { b ->
            pnrCommon(b)
            b.step(
                "X4 помогает под кольцом против 5-го — 4 остаётся один в углу. Передача в угол.",
                pass("o1", "o4"),
                defense = mapOf("x4" to p(6.5f, 3.4f)),
            )
        }.finish("4 бросает трёхочковый из угла.", defense = mapOf("x4" to p(5.0f, 3.2f)))

        val tactic = Tactic(
            id = "pb_pnr",
            name = "Пик-н-ролл",
            category = "Нападение",
            description = "Самая популярная двухходовка в баскетболе: высокий игрок ставит заслон владеющему мячом, " +
                "после чего откатывается к кольцу. Защита вынуждена выбирать, кого закрывать.",
            variants = listOf(
                Variant(id = "pb_pnr_a", name = "Пас на ролл", frames = a),
                Variant(id = "pb_pnr_b", name = "Пас в угол", frames = bFrames),
            ),
        )
        return PlaybookEntry(
            tactic,
            "Заслон для игрока с мячом и откат к кольцу.",
            listOf(
                "Заслон ставится под углом, спиной к направлению, куда пойдёт защитник.",
                "Владеющий мячом ждёт, пока заслон поставлен, и проходит вплотную к заслоняющему.",
                "Заслоняющий откатывается только после того, как партнёр прошёл мимо.",
                "Читайте защиту: кто остался свободным — ролл, угол или собственный бросок.",
            ),
        )
    }

    private fun pickAndPop(): PlaybookEntry {
        val frames = PlayBuilder(fiveOnFive(TOP, R_WING, L_CORNER, L_ELBOW, R_BLOCK), autoDefense = true).also { b ->
            b.step("4 поднимается от левого локтя и ставит заслон X1 слева.", screen("o4", p(6.5f, 8.3f)))
            b.step(
                "1 атакует налево через заслон. 4 вместо отката выходит за трёхочковую линию (pop).",
                dribble("o1", p(5.6f, 9.4f), p(4.0f, 7.0f)),
                move("o4", p(7.2f, 9.6f), p(8.8f, 9.6f)),
            )
            b.step("Защитник 4-го помогал против прохода — передача 4-му на открытый бросок.", pass("o1", "o4"))
        }.finish("4 бросает из-за дуги либо атакует закрывающегося защитника проходом.")
        return PlaybookEntry(
            Tactic(
                id = "pb_pnp", name = "Пик-н-поп", category = "Нападение",
                description = "Разновидность пик-н-ролла для бросающего высокого игрока: после заслона он не идёт к кольцу, " +
                    "а отходит на дистанцию броска.",
                variants = listOf(Variant(id = "pb_pnp_a", name = "Основной", frames = frames)),
            ),
            "Заслон и выход заслоняющего на бросок.",
            listOf(
                "Подходит, если у четвёртого/пятого номера стабильный бросок.",
                "Выход (pop) — в сторону, противоположную проходу, чтобы растянуть защиту.",
                "Если защитник успел закрыть бросок — 4-й атакует его проходом.",
            ),
        )
    }

    private fun giveAndGo(): PlaybookEntry {
        val frames = PlayBuilder(fiveOnFive(TOP, R_WING, L_WING, L_CORNER, L_BLOCK), autoDefense = true).also { b ->
            b.step("1 отдаёт передачу на фланг 2-му.", pass("o1", "o2"))
            b.step(
                "1 делает обманный шаг влево и резко врывается к кольцу перед своим защитником.",
                move("o1", p(6.6f, 8.0f), p(8.6f, 5.4f), p(8.3f, 2.6f)),
            )
            b.step("2 возвращает мяч 1-му на рывке.", pass("o2", "o1"))
        }.finish("1 завершает атаку лэй-апом.")
        return PlaybookEntry(
            Tactic(
                id = "pb_gng", name = "Отдай и выйди", category = "Нападение",
                description = "Простейшее взаимодействие двух игроков: отдал передачу — сразу рванул к кольцу за ответной.",
                variants = listOf(Variant(id = "pb_gng_a", name = "Основной", frames = frames)),
            ),
            "Передача и мгновенный рывок к кольцу (give-and-go).",
            listOf(
                "После передачи защитник часто поворачивает голову за мячом — это момент для рывка.",
                "Обманное движение в противоположную сторону делает рывок эффективнее.",
                "Передача на рывке — с отскоком или навесом, на уровень груди.",
            ),
        )
    }

    private fun downScreen(): PlaybookEntry {
        val start = fiveOnFive(TOP, p(9.8f, 2.0f), L_WING, R_WING, L_BLOCK)
        val frames = PlayBuilder(start, autoDefense = true).also { b ->
            b.step(
                "4 спускается с фланга и ставит заслон (даун-скрин) защитнику X2. 2 уводит своего защитника к лицевой линии.",
                screen("o4", p(10.9f, 3.4f)),
                move("o2", p(9.4f, 1.3f)),
            )
            b.step(
                "2 выходит из-под заслона наверх, на позицию 45°, плечом к плечу с заслоняющим.",
                move("o2", p(10.6f, 2.3f), p(11.8f, 3.6f), p(12.6f, 6.0f)),
            )
            b.step(
                "1 отдаёт передачу 2-му. 4 после заслона ныряет к кольцу, запирая своего защитника спиной (seal).",
                pass("o1", "o2"),
                move("o4", p(9.6f, 2.4f)),
            )
        }.finish("2 бросает с выхода либо отдаёт 4-му под кольцо.")
        return PlaybookEntry(
            Tactic(
                id = "pb_down", name = "Выход из-под заслона", category = "Нападение",
                description = "Игрок без мяча освобождается для броска, используя заслон партнёра (даун-скрин / пин-даун).",
                variants = listOf(Variant(id = "pb_down_a", name = "Даун-скрин", frames = frames)),
            ),
            "Заслон без мяча для освобождения снайпера.",
            listOf(
                "Сначала уведи защитника в противоположную сторону, потом выходи.",
                "Выходи вплотную к заслону — плечом к плечу, чтобы защитник не протиснулся.",
                "Читай защитника: преследует сзади — закручивайся к кольцу (curl); срезает — уходи в угол (fade).",
                "Заслоняющий после заслона часто сам оказывается открыт (slip / seal).",
            ),
        )
    }

    private fun backdoor(): PlaybookEntry {
        val frames = PlayBuilder(fiveOnFive(TOP, R_WING, L_WING, L_CORNER, L_BLOCK), autoDefense = true).also { b ->
            b.step(
                "X2 плотно перекрывает передачу на фланг. 2 делает шаг навстречу мячу, затягивая защитника выше.",
                move("o2", p(12.2f, 7.8f)),
                defense = mapOf("x2" to p(11.8f, 6.9f)),
            )
            b.step(
                "Резкая смена направления: 2 уходит за спину защитнику к кольцу. 1 даёт передачу с отскоком.",
                move("o2", p(11.6f, 5.4f), p(8.6f, 2.4f)),
                pass("o1", "o2"),
                defense = mapOf("x2" to p(11.8f, 8.3f)),
            )
        }.finish("2 получает мяч под кольцом и забивает.", defense = mapOf("x2" to p(10.6f, 4.4f)))
        return PlaybookEntry(
            Tactic(
                id = "pb_backdoor", name = "Бэкдор", category = "Нападение",
                description = "Ответ на агрессивное перекрытие передач: нападающий уходит за спину защитнику к кольцу.",
                variants = listOf(Variant(id = "pb_backdoor_a", name = "Основной", frames = frames)),
            ),
            "Рывок за спину защитнику, перекрывающему передачу.",
            listOf(
                "Сигнал для бэкдора — защитник стоит в линии передачи и смотрит на мяч.",
                "Затяни защитника на 1–2 шага выше, затем резкий рывок к кольцу.",
                "Передача — с отскоком, мимо руки защитника.",
            ),
        )
    }

    private fun zone23(): PlaybookEntry {
        val zone = mapOf(
            "x1" to p(5.9f, 7.3f), "x2" to p(9.1f, 7.3f),
            "x3" to p(3.6f, 3.2f), "x4" to p(11.4f, 3.2f), "x5" to p(7.5f, 2.8f),
        )
        val zoneShift = mapOf(
            "x1" to p(8.0f, 7.0f), "x2" to p(11.4f, 6.4f),
            "x3" to p(5.6f, 3.4f), "x4" to p(12.0f, 2.8f), "x5" to p(9.4f, 2.6f),
        )
        val start = frameOf(
            o(1, p(7.5f, 9.4f)), o(2, R_WING), o(3, L_WING), o(4, p(11.4f, 1.0f)), o(5, p(4.6f, 1.8f)),
            x(1, zone["x1"]!!), x(2, zone["x2"]!!), x(3, zone["x3"]!!), x(4, zone["x4"]!!), x(5, zone["x5"]!!),
        )

        fun common(b: PlayBuilder) {
            b.step("Нападение расставляется в «дыры» зоны 2-3. 1 переводит мяч на фланг 2-му.", pass("o1", "o2"))
            b.step(
                "Зона смещается к мячу. 5 с противоположного блока резко выходит на линию штрафного (флеш). 2 отдаёт ему.",
                move("o5", p(6.0f, 3.8f), p(7.4f, 5.6f)),
                pass("o2", "o5"),
                defense = zoneShift,
            )
        }

        val shiftAfter = mapOf(
            "x1" to p(7.0f, 7.2f), "x2" to p(10.4f, 6.8f),
            "x3" to p(4.8f, 3.4f), "x4" to p(11.0f, 2.6f), "x5" to p(7.6f, 4.0f),
        )
        val a = PlayBuilder(start, autoDefense = false).also { b ->
            common(b)
            b.step(
                "X5 вынужден выйти на 5-го. 4 из-под щита ныряет к кольцу — передача сверху вниз (high-low).",
                move("o4", p(9.0f, 1.8f)),
                pass("o5", "o4"),
                defense = shiftAfter,
            )
        }.finish("4 получает мяч под кольцом: бросок без сопротивления.", defense = shiftAfter)

        val bFrames = PlayBuilder(start, autoDefense = false).also { b ->
            common(b)
            b.step(
                "X3 сместился в центр против 5-го — 3 сдвигается в свободную зону на 45° и получает передачу.",
                move("o3", p(2.2f, 4.6f)),
                pass("o5", "o3"),
                defense = mapOf("x3" to p(5.4f, 4.4f), "x5" to p(7.6f, 3.6f), "x1" to p(6.6f, 7.2f)),
            )
        }.finish("3 бросает открытый трёхочковый.")

        return PlaybookEntry(
            Tactic(
                id = "pb_zone23", name = "Атака против зоны 2-3", category = "Против зоны",
                description = "Мяч в высокий пост (на линию штрафного) — главный ключ против зоны 2-3: " +
                    "оттуда видно всю площадку, а каждый защитник зоны отвечает сразу за двоих.",
                variants = listOf(
                    Variant(id = "pb_zone23_a", name = "Хай-лоу", frames = a),
                    Variant(id = "pb_zone23_b", name = "Бросок с фланга", frames = bFrames),
                ),
            ),
            "Мяч на линию штрафного и передача в свободную зону.",
            listOf(
                "Стойте в промежутках между защитниками зоны, а не напротив них.",
                "Быстрые передачи двигают зону быстрее, чем ведение.",
                "Игрок на линии штрафного: развернулся лицом к кольцу — сразу видит всю зону.",
                "Атакуйте слабую сторону и пространство за спиной зоны (лицевая линия).",
            ),
        )
    }

    private fun horns(): PlaybookEntry {
        val frames = PlayBuilder(fiveOnFive(TOP, L_CORNER, R_CORNER, L_ELBOW, R_ELBOW), autoDefense = true).also { b ->
            b.step(
                "Расстановка «Хорнс»: двое высоких на локтях, крайние — в углах. 5 ставит заслон X1 справа.",
                screen("o5", p(8.5f, 8.3f)),
            )
            b.step(
                "1 атакует вправо через заслон. 5 откатывается к кольцу, 4 выходит за дугу наверх.",
                dribble("o1", p(9.8f, 8.8f), p(11.2f, 6.6f)),
                move("o5", p(8.6f, 4.6f), p(8.2f, 2.6f)),
                move("o4", p(5.6f, 8.6f), p(7.2f, 9.6f)),
            )
            b.step("Защита сжалась против ролла — передача наверх 4-му.", pass("o1", "o4"))
        }.finish("4 бросает или продолжает атаку передачей 5-му под кольцо (high-low).")
        return PlaybookEntry(
            Tactic(
                id = "pb_horns", name = "Хорнс", category = "Нападение",
                description = "Расстановка «рога»: двое высоких у локтей зоны дают разыгрывающему выбор, " +
                    "с чьим заслоном играть, а углы растягивают защиту.",
                variants = listOf(Variant(id = "pb_horns_a", name = "Ролл и поп", frames = frames)),
            ),
            "Двое высоких на локтях: пик-н-ролл с вариантами.",
            listOf(
                "Расстановка сразу ставит защиту перед выбором — с какой стороны будет заслон.",
                "Один высокий откатывается, второй выходит на бросок — защите не хватает людей.",
                "Игроки в углах держат ширину и наказывают за помощь.",
            ),
        )
    }
}
