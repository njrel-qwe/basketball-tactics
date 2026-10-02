package com.coach.tacticboard.data

import com.coach.tacticboard.court.Court
import com.coach.tacticboard.court.Poly

val MOVEMENT_TYPES = setOf(LineType.MOVE, LineType.DRIBBLE, LineType.SCREEN)

/** Смещение мяча относительно центра игрока, который им владеет (в метрах). */
val BALL_OFFSET = Pt(0.5f, -0.5f)

fun Frame.token(id: String?): Token? = id?.let { tid -> tokens.firstOrNull { it.id == tid } }

fun Frame.movementLineFor(tokenId: String): DrawLine? =
    lines.lastOrNull { it.fromId == tokenId && it.type in MOVEMENT_TYPES && it.points.size >= 2 }

fun Frame.passLine(): DrawLine? {
    val owner = ball?.ownerId ?: return null
    return lines.lastOrNull { it.type == LineType.PASS && it.fromId == owner && it.points.size >= 2 }
}

fun ballPosition(ball: Ball?, tokens: List<Token>): Pt? {
    if (ball == null) return null
    val owner = ball.ownerId?.let { id -> tokens.firstOrNull { it.id == id } }
    return if (owner != null) owner.pos + BALL_OFFSET else Pt(ball.x, ball.y)
}

fun Frame.ballPos(): Pt? = ballPosition(ball, tokens)

/**
 * Строит следующий шаг: игроки переходят в конечные точки своих линий движения,
 * мяч переходит к адресату передачи. Линии очищаются.
 */
fun Frame.advance(): Frame {
    val newTokens = tokens.map { t ->
        val end = movementLineFor(t.id)?.points?.last()
        if (end != null) t.at(end) else t
    }
    val pass = passLine()
    val newBall = when {
        ball == null -> null
        pass == null -> if (ball.ownerId != null && newTokens.none { it.id == ball.ownerId }) {
            Ball(null, ball.x, ball.y)
        } else ball
        pass.toId != null && newTokens.any { it.id == pass.toId } -> Ball(ownerId = pass.toId)
        else -> pass.points.last().let { Ball(null, it.x, it.y) }
    }
    return Frame(tokens = newTokens, lines = emptyList(), ball = newBall, note = "")
}

/** Позиции для отрисовки во время анимации между шагами. */
data class RenderState(val tokens: List<Token>, val ball: Pt?)

private fun smoothstep(v: Float): Float {
    val t = v.coerceIn(0f, 1f)
    return t * t * (3 - 2 * t)
}

private fun lerp(a: Pt, b: Pt, t: Float) = Pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)

fun interpolate(a: Frame, b: Frame?, t: Float): RenderState {
    if (b == null || t <= 0f) return RenderState(a.tokens, a.ballPos())
    val tokens = buildList {
        for (ta in a.tokens) {
            val tb = b.token(ta.id)
            val end = tb?.pos ?: ta.pos
            val line = a.movementLineFor(ta.id)
            val p = if (line != null) Poly.pointAlong(line.points, t, ta.pos, end) else lerp(ta.pos, end, t)
            // Игрок, удалённый на следующем шаге, исчезает в середине анимации.
            if (tb != null || t < 0.5f) add(ta.at(p))
        }
        // Игроки, появившиеся на следующем шаге.
        if (t >= 0.5f) b.tokens.filter { a.token(it.id) == null }.forEach { add(it) }
    }
    val ball: Pt? = when {
        a.ball == null && b.ball == null -> null
        a.ball == null -> if (t >= 0.5f) ballPosition(b.ball, tokens) else null
        b.ball == null -> if (t < 0.5f) ballPosition(a.ball, tokens) else null
        else -> {
            val start = ballPosition(a.ball, tokens)!!
            val end = ballPosition(b.ball, tokens) ?: start
            val sameOwner = a.ball.ownerId != null && a.ball.ownerId == b.ball.ownerId
            if (sameOwner) start else {
                val pass = a.passLine()
                if (pass != null) {
                    // Передача — мяч летит в середине шага.
                    lerp(start, end, smoothstep((t - 0.25f) / 0.5f))
                } else lerp(start, end, t)
            }
        }
    }
    return RenderState(tokens, ball)
}

/** Точка «опеки»: между игроком и кольцом. */
fun guardSpot(p: Pt, dist: Float = 1.1f): Pt {
    val basket = Court.BASKET
    val d = basket - p
    val len = d.length()
    if (len < 0.01f) return p
    return p + d * (minOf(dist, len * 0.6f) / len)
}
