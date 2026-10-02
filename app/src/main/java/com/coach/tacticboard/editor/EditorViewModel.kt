package com.coach.tacticboard.editor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coach.tacticboard.court.BALL_ID
import com.coach.tacticboard.court.BALL_RADIUS
import com.coach.tacticboard.court.CourtGeometry
import com.coach.tacticboard.court.Poly
import com.coach.tacticboard.court.TOKEN_RADIUS
import com.coach.tacticboard.data.BALL_OFFSET
import com.coach.tacticboard.data.Ball
import com.coach.tacticboard.data.CourtType
import com.coach.tacticboard.data.DrawLine
import com.coach.tacticboard.data.Frame
import com.coach.tacticboard.data.LineType
import com.coach.tacticboard.data.MOVEMENT_TYPES
import com.coach.tacticboard.data.Pt
import com.coach.tacticboard.data.Tactic
import com.coach.tacticboard.data.TacticRepository
import com.coach.tacticboard.data.Team
import com.coach.tacticboard.data.Token
import com.coach.tacticboard.data.Variant
import com.coach.tacticboard.data.advance
import com.coach.tacticboard.data.ballPos
import com.coach.tacticboard.data.guardSpot
import com.coach.tacticboard.data.newId
import com.coach.tacticboard.court.BoardInput
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class Tool(val title: String, val lineType: LineType? = null) {
    SELECT("Двигать"),
    MOVE("Движение", LineType.MOVE),
    DRIBBLE("Ведение", LineType.DRIBBLE),
    PASS("Передача", LineType.PASS),
    SCREEN("Заслон", LineType.SCREEN),
    ERASER("Ластик"),
}

/** Стандартные позиции нападения на половине площадки. */
val HOME_SPOTS = listOf(
    Pt(7.5f, 9.0f),   // разыгрывающий — верх дуги
    Pt(12.6f, 6.4f),  // правый фланг
    Pt(2.4f, 6.4f),   // левый фланг
    Pt(1.2f, 1.3f),   // левый угол
    Pt(9.7f, 2.6f),   // правый блок
    Pt(13.8f, 1.3f),
    Pt(5.3f, 2.6f),
)

fun startingFrame(home: Int, away: Int, withBall: Boolean): Frame {
    val tokens = mutableListOf<Token>()
    for (i in 0 until home) tokens += Token("o${i + 1}", Team.HOME, "${i + 1}", HOME_SPOTS[i].x, HOME_SPOTS[i].y)
    for (i in 0 until away) {
        val g = guardSpot(HOME_SPOTS[i])
        tokens += Token("x${i + 1}", Team.AWAY, "X${i + 1}", g.x, g.y)
    }
    val ball = if (withBall) {
        if (home > 0) Ball(ownerId = "o1") else Ball(null, 7.5f, 9f)
    } else null
    return Frame(tokens = tokens, ball = ball)
}

class EditorViewModel(
    private val repo: TacticRepository,
    initial: Tactic,
    /** Сохранять ли тактику (для временных копий из библиотеки — до первого изменения нет). */
    private var persistent: Boolean,
) : ViewModel(), BoardInput {

    private data class Snapshot(val tactic: Tactic, val variant: Int, val frame: Int)

    var tactic by mutableStateOf(initial)
        private set
    var variantIndex by mutableStateOf(0)
        private set
    val player = StepPlayer()
    val frameIndex: Int get() = player.index

    var tool by mutableStateOf(Tool.SELECT)
    var straightLines by mutableStateOf(false)
    var draft by mutableStateOf<DrawLine?>(null)
        private set
    var highlightId by mutableStateOf<String?>(null)
        private set
    /** Игрок, для которого открыт диалог смены номера (двойной тап). */
    var labelEditTokenId by mutableStateOf<String?>(null)

    private val undoStack = ArrayDeque<Snapshot>()
    private val redoStack = ArrayDeque<Snapshot>()
    var canUndo by mutableStateOf(false)
        private set
    var canRedo by mutableStateOf(false)
        private set

    val variant: Variant get() = tactic.variants[variantIndex.coerceIn(0, tactic.variants.lastIndex)]
    val frames: List<Frame> get() = variant.frames
    val frame: Frame get() = frames[frameIndex.coerceIn(0, frames.lastIndex)]

    // ---------- История ----------

    private fun snapshot() = Snapshot(tactic, variantIndex, frameIndex)

    private fun checkpoint() {
        undoStack.addLast(snapshot())
        if (undoStack.size > 200) undoStack.removeFirst()
        redoStack.clear()
        refreshHistoryFlags()
    }

    private fun refreshHistoryFlags() {
        canUndo = undoStack.isNotEmpty()
        canRedo = redoStack.isNotEmpty()
    }

    private fun restore(s: Snapshot) {
        tactic = s.tactic
        variantIndex = s.variant.coerceIn(0, tactic.variants.lastIndex)
        player.goTo(s.frame.coerceIn(0, frames.lastIndex))
        refreshHistoryFlags()
        scheduleSave()
    }

    fun undo() {
        val s = undoStack.removeLastOrNull() ?: return
        redoStack.addLast(snapshot())
        restore(s)
    }

    fun redo() {
        val s = redoStack.removeLastOrNull() ?: return
        undoStack.addLast(snapshot())
        restore(s)
    }

    /** Изменение тактики с записью в историю. */
    private fun commit(change: (Tactic) -> Tactic) {
        player.stop()
        checkpoint()
        tactic = change(tactic)
        scheduleSave()
    }

    // ---------- Сохранение ----------

    private var saveJob: Job? = null

    private fun scheduleSave() {
        persistent = true
        saveJob?.cancel()
        saveJob = viewModelScope.launch {
            delay(500)
            saveNow()
        }
    }

    fun saveNow() {
        saveJob?.cancel()
        if (persistent) repo.upsert(tactic.copy(updatedAt = System.currentTimeMillis()))
    }

    override fun onCleared() {
        saveNow()
    }

    // ---------- Вспомогательные функции изменения ----------

    private fun Tactic.withVariant(transform: (Variant) -> Variant): Tactic =
        copy(variants = variants.mapIndexed { i, v -> if (i == variantIndex) transform(v) else v })

    private fun Tactic.withFrame(index: Int = frameIndex, transform: (Frame) -> Frame): Tactic =
        withVariant { v -> v.copy(frames = v.frames.mapIndexed { i, f -> if (i == index) transform(f) else f }) }

    /** Применяет изменение к текущему и всем последующим шагам (добавление/удаление игроков). */
    private fun Tactic.withFramesFromCurrent(transform: (Frame) -> Frame): Tactic =
        withVariant { v -> v.copy(frames = v.frames.mapIndexed { i, f -> if (i >= frameIndex) transform(f) else f }) }

    private fun setLive(transform: (Frame) -> Frame) {
        tactic = tactic.withFrame(transform = transform)
    }

    // ---------- Игроки и мяч ----------

    fun addPlayer(team: Team) {
        val f = frame
        val same = f.tokens.filter { it.team == team }
        val prefix = if (team == Team.HOME) "" else "X"
        val number = (1..99).first { n -> same.none { it.label == "$prefix$n" } }
        val spot = if (team == Team.HOME) {
            HOME_SPOTS.firstOrNull { s -> f.tokens.none { it.pos.dist(s) < 1f } } ?: Pt(7.5f, 11f)
        } else {
            val target = f.tokens.firstOrNull { it.team == Team.HOME && it.label == "$number" }
            val s = target?.let { guardSpot(it.pos) } ?: guardSpot(HOME_SPOTS[(number - 1) % HOME_SPOTS.size])
            if (f.tokens.any { it.pos.dist(s) < 0.8f }) Pt(7.5f, 11.5f) else s
        }
        val token = Token(newId(), team, "$prefix$number", spot.x, spot.y)
        commit { t -> t.withFramesFromCurrent { fr -> fr.copy(tokens = fr.tokens + token) } }
        highlightId = token.id
    }

    fun toggleBall() {
        val hasBall = frame.ball != null
        commit { t ->
            t.withFramesFromCurrent { fr ->
                if (hasBall) fr.copy(ball = null, lines = fr.lines.filterNot { it.type == LineType.PASS })
                else {
                    val owner = fr.tokens.firstOrNull { it.team == Team.HOME && it.label == "1" }
                        ?: fr.tokens.firstOrNull { it.team == Team.HOME }
                    fr.copy(ball = if (owner != null) Ball(owner.id) else Ball(null, 7.5f, 9f))
                }
            }
        }
    }

    fun setTokenLabel(id: String, label: String) {
        val clean = label.trim().take(3)
        if (clean.isEmpty()) return
        commit { t ->
            t.copy(variants = t.variants.map { v ->
                v.copy(frames = v.frames.map { f ->
                    f.copy(tokens = f.tokens.map { if (it.id == id) it.copy(label = clean) else it })
                })
            })
        }
    }

    fun tokenById(id: String?): Token? = frame.tokens.firstOrNull { it.id == id }

    private fun removeToken(id: String) {
        tactic = tactic.withFramesFromCurrent { fr ->
            val tok = fr.tokens.firstOrNull { it.id == id }
            val ball = fr.ball?.let { b ->
                if (b.ownerId == id && tok != null) Ball(null, tok.x + BALL_OFFSET.x, tok.y + BALL_OFFSET.y) else b
            }
            fr.copy(
                tokens = fr.tokens.filterNot { it.id == id },
                lines = fr.lines.filterNot { it.fromId == id || it.toId == id },
                ball = ball,
            )
        }
    }

    // ---------- Линии ----------

    private fun addLine(line: DrawLine) {
        commit { t ->
            t.withFrame { fr ->
                val filtered = fr.lines.filterNot { old ->
                    line.fromId != null && old.fromId == line.fromId && (
                        (line.type in MOVEMENT_TYPES && old.type in MOVEMENT_TYPES) ||
                            (line.type == LineType.PASS && old.type == LineType.PASS))
                }
                fr.copy(lines = filtered + line)
            }
        }
    }

    // ---------- Очистка ----------

    fun clearLines() = commit { t -> t.withFrame { it.copy(lines = emptyList()) } }

    fun clearAll() {
        commit { t -> t.withVariant { v -> v.copy(frames = listOf(Frame())) } }
        player.goTo(0)
    }

    fun resetToStart(home: Int, away: Int) {
        commit { t -> t.withVariant { v -> v.copy(frames = listOf(startingFrame(home, away, home > 0))) } }
        player.goTo(0)
    }

    // ---------- Шаги ----------

    fun addStep() {
        val newFrame = frame.advance()
        val at = frameIndex + 1
        commit { t -> t.withVariant { v -> v.copy(frames = v.frames.toMutableList().apply { add(at, newFrame) }) } }
        player.goTo(at)
    }

    fun deleteStep() {
        if (frames.size <= 1) return
        val at = frameIndex
        commit { t -> t.withVariant { v -> v.copy(frames = v.frames.filterIndexed { i, _ -> i != at }) } }
        player.goTo(at.coerceAtMost(frames.lastIndex))
    }

    fun setNote(text: String) = commit { t -> t.withFrame { it.copy(note = text.trim()) } }

    // ---------- Варианты ----------

    fun selectVariant(i: Int) {
        player.stop()
        variantIndex = i.coerceIn(0, tactic.variants.lastIndex)
        player.goTo(0)
    }

    fun addVariant(copyCurrent: Boolean) {
        val letter = ('A' + tactic.variants.size).let { if (it <= 'Z') it.toString() else "${tactic.variants.size + 1}" }
        val base = if (copyCurrent) variant.frames else listOf(frames.first().copy(lines = emptyList(), note = ""))
        val v = Variant(name = "Вариант $letter", frames = base)
        commit { t -> t.copy(variants = t.variants + v) }
        selectVariant(tactic.variants.lastIndex)
    }

    fun renameVariant(i: Int, name: String) {
        if (name.isBlank()) return
        commit { t -> t.copy(variants = t.variants.mapIndexed { idx, v -> if (idx == i) v.copy(name = name.trim()) else v }) }
    }

    fun deleteVariant(i: Int) {
        if (tactic.variants.size <= 1) return
        val current = variantIndex
        commit { t -> t.copy(variants = t.variants.filterIndexed { idx, _ -> idx != i }) }
        selectVariant(if (current > i) current - 1 else current.coerceAtMost(tactic.variants.lastIndex))
    }

    // ---------- Свойства тактики ----------

    fun updateInfo(name: String, category: String, description: String) {
        if (name.isBlank()) return
        commit { t -> t.copy(name = name.trim(), category = category, description = description.trim()) }
    }

    fun toggleCourt() = commit { t -> t.copy(court = if (t.court == CourtType.HALF) CourtType.FULL else CourtType.HALF) }

    // ---------- Касания доски ----------

    private var dragTargetId: String? = null
    private var dragOffset = Pt(0f, 0f)
    private var geometry: CourtGeometry? = null
    private var eraseCheckpointed = false
    private var lastTapTokenId: String? = null
    private var lastTapTime = 0L

    private fun hitToken(p: Pt, radius: Float = TOKEN_RADIUS + 0.35f, exclude: String? = null): Token? =
        frame.tokens.filter { it.id != exclude && it.pos.dist(p) <= radius }.minByOrNull { it.pos.dist(p) }

    private fun hitBall(p: Pt): Boolean = frame.ballPos()?.let { it.dist(p) <= BALL_RADIUS + 0.3f } ?: false

    override fun onDragStart(p: Pt, geometry: CourtGeometry) {
        player.stop()
        this.geometry = geometry
        when (tool) {
            Tool.SELECT -> {
                val target = when {
                    hitBall(p) -> BALL_ID
                    else -> hitToken(p)?.id
                }
                dragTargetId = target
                highlightId = target
                if (target != null) {
                    checkpoint()
                    val pos = if (target == BALL_ID) frame.ballPos()!! else tokenById(target)!!.pos
                    dragOffset = pos - p
                }
            }
            Tool.ERASER -> {
                eraseCheckpointed = false
                eraseAt(p)
            }
            else -> {
                val type = tool.lineType!!
                val from = hitToken(p)
                val start = from?.pos ?: p
                draft = DrawLine(type = type, points = listOf(start), fromId = from?.id)
                highlightId = from?.id
            }
        }
    }

    override fun onDrag(p: Pt) {
        val g = geometry ?: return
        when (tool) {
            Tool.SELECT -> {
                val id = dragTargetId ?: return
                val target = g.clamp(p + dragOffset)
                if (id == BALL_ID) {
                    setLive { it.copy(ball = Ball(null, target.x, target.y)) }
                } else {
                    setLive { fr ->
                        val tok = fr.tokens.firstOrNull { it.id == id } ?: return@setLive fr
                        val delta = target - tok.pos
                        fr.copy(
                            tokens = fr.tokens.map { if (it.id == id) it.at(target) else it },
                            // линии движения игрока переезжают вместе с ним
                            lines = fr.lines.map { l ->
                                if (l.fromId == id) l.copy(points = l.points.map { it + delta }) else l
                            },
                        )
                    }
                }
            }
            Tool.ERASER -> eraseAt(p)
            else -> {
                val d = draft ?: return
                val cp = g.clamp(p)
                draft = if (straightLines) {
                    d.copy(points = listOf(d.points.first(), cp))
                } else if (d.points.last().dist(cp) >= 0.15f) {
                    d.copy(points = d.points + cp)
                } else d
            }
        }
    }

    override fun onDragEnd() {
        when (tool) {
            Tool.SELECT -> {
                if (dragTargetId == BALL_ID) {
                    val bp = frame.ballPos()
                    val owner = bp?.let { pos -> hitToken(pos, TOKEN_RADIUS + 0.6f) }
                    if (owner != null) setLive { it.copy(ball = Ball(ownerId = owner.id)) }
                }
                if (dragTargetId != null) scheduleSave()
                dragTargetId = null
                highlightId = null
            }
            Tool.ERASER -> if (eraseCheckpointed) scheduleSave()
            else -> {
                val d = draft
                draft = null
                highlightId = null
                if (d == null || Poly.length(d.points) < 0.6f) return
                var pts = if (straightLines) d.points else Poly.simplify(d.points, 0.05f)
                if (pts.size < 2) pts = listOf(d.points.first(), d.points.last())
                val target = hitToken(pts.last(), TOKEN_RADIUS + 0.4f, exclude = d.fromId)
                val toId = if (d.type == LineType.PASS) target?.id else null
                addLine(d.copy(points = pts, toId = toId))
            }
        }
    }

    override fun onTap(p: Pt) {
        player.stop()
        when (tool) {
            Tool.ERASER -> {
                eraseCheckpointed = false
                eraseAt(p)
                if (eraseCheckpointed) scheduleSave()
            }
            Tool.SELECT -> {
                val tok = hitToken(p)
                val now = System.currentTimeMillis()
                if (tok != null && tok.id == lastTapTokenId && now - lastTapTime < 400) {
                    labelEditTokenId = tok.id
                    lastTapTokenId = null
                } else {
                    lastTapTokenId = tok?.id
                    lastTapTime = now
                }
            }
            else -> Unit
        }
    }

    private fun eraseAt(p: Pt) {
        val tok = hitToken(p, TOKEN_RADIUS + 0.1f)
        val line = frame.lines
            .map { it to Poly.distanceTo(it.points, p) }
            .filter { it.second < 0.45f }
            .minByOrNull { it.second }?.first
        if (tok == null && line == null) return
        if (!eraseCheckpointed) {
            checkpoint()
            eraseCheckpointed = true
        }
        if (tok != null) removeToken(tok.id)
        else if (line != null) setLive { fr -> fr.copy(lines = fr.lines.filterNot { it.id == line.id }) }
    }
}
