package com.coach.tacticboard.data

import kotlinx.serialization.Serializable
import java.util.UUID
import kotlin.math.hypot

fun newId(): String = UUID.randomUUID().toString().replace("-", "").take(10)

@Serializable
enum class Team { HOME, AWAY }

@Serializable
enum class CourtType { HALF, FULL }

@Serializable
enum class LineType { MOVE, DRIBBLE, PASS, SCREEN }

/** Точка в метрах. Ось X — поперёк площадки (0..15), ось Y — от лицевой линии (кольцо сверху). */
@Serializable
data class Pt(val x: Float, val y: Float) {
    operator fun plus(o: Pt) = Pt(x + o.x, y + o.y)
    operator fun minus(o: Pt) = Pt(x - o.x, y - o.y)
    operator fun times(k: Float) = Pt(x * k, y * k)
    fun dist(o: Pt) = hypot(x - o.x, y - o.y)
    fun length() = hypot(x, y)
}

@Serializable
data class Token(
    val id: String,
    val team: Team,
    val label: String,
    val x: Float,
    val y: Float,
) {
    val pos: Pt get() = Pt(x, y)
    fun at(p: Pt) = copy(x = p.x, y = p.y)
}

/**
 * Линия на схеме. [fromId] — игрок, от которого начинается линия
 * (для движения/ведения/заслона это сам игрок, для передачи — пасующий),
 * [toId] — адресат передачи.
 */
@Serializable
data class DrawLine(
    val id: String = newId(),
    val type: LineType,
    val points: List<Pt>,
    val fromId: String? = null,
    val toId: String? = null,
)

/** Мяч: либо у игрока [ownerId], либо свободно лежит в точке (x, y). */
@Serializable
data class Ball(
    val ownerId: String? = null,
    val x: Float = 7.5f,
    val y: Float = 9f,
)

/** Один шаг (этап) комбинации. */
@Serializable
data class Frame(
    val tokens: List<Token> = emptyList(),
    val lines: List<DrawLine> = emptyList(),
    val ball: Ball? = null,
    val note: String = "",
)

@Serializable
data class Variant(
    val id: String = newId(),
    val name: String,
    val frames: List<Frame> = listOf(Frame()),
)

@Serializable
data class Tactic(
    val id: String = newId(),
    val name: String,
    val category: String = "",
    val description: String = "",
    val court: CourtType = CourtType.HALF,
    val variants: List<Variant> = listOf(Variant(name = "Вариант A")),
    val updatedAt: Long = System.currentTimeMillis(),
)

val CATEGORIES = listOf("Нападение", "Против зоны", "Защита", "Розыгрыш аута", "Быстрый прорыв", "Другое")
