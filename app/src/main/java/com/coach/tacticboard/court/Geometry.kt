package com.coach.tacticboard.court

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import com.coach.tacticboard.data.CourtType
import com.coach.tacticboard.data.Pt
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/** Размеры площадки FIBA в метрах. */
object Court {
    const val WIDTH = 15f
    const val HALF_LENGTH = 14f
    const val MARGIN = 0.9f // поле вокруг площадки, куда тоже можно ставить фишки
    val BASKET = Pt(7.5f, 1.575f)

    fun length(type: CourtType) = if (type == CourtType.HALF) HALF_LENGTH else HALF_LENGTH * 2
    fun aspect(type: CourtType) = (WIDTH + 2 * MARGIN) / (length(type) + 2 * MARGIN)
}

/** Перевод метров площадки в пиксели экрана и обратно. */
class CourtGeometry(val origin: Offset, val scale: Float, val court: CourtType) {
    val length = Court.length(court)

    fun toScreen(p: Pt) = Offset(origin.x + p.x * scale, origin.y + p.y * scale)
    fun toScreen(x: Float, y: Float) = Offset(origin.x + x * scale, origin.y + y * scale)
    fun toCourt(o: Offset) = Pt((o.x - origin.x) / scale, (o.y - origin.y) / scale)
    fun px(meters: Float) = meters * scale

    fun clamp(p: Pt) = Pt(
        p.x.coerceIn(-Court.MARGIN + 0.3f, Court.WIDTH + Court.MARGIN - 0.3f),
        p.y.coerceIn(-Court.MARGIN + 0.3f, length + Court.MARGIN - 0.3f),
    )

    /** Прямоугольник площадки вместе с полем вокруг неё. */
    val boardRect: Rect
        get() = Rect(
            toScreen(-Court.MARGIN, -Court.MARGIN),
            toScreen(Court.WIDTH + Court.MARGIN, length + Court.MARGIN),
        )

    companion object {
        fun fit(area: Rect, court: CourtType): CourtGeometry {
            val wM = Court.WIDTH + 2 * Court.MARGIN
            val hM = Court.length(court) + 2 * Court.MARGIN
            val scale = min(area.width / wM, area.height / hM)
            val left = area.left + (area.width - wM * scale) / 2 + Court.MARGIN * scale
            val top = area.top + (area.height - hM * scale) / 2 + Court.MARGIN * scale
            return CourtGeometry(Offset(left, top), scale, court)
        }

        fun fit(size: Size, court: CourtType) = fit(Rect(Offset.Zero, size), court)
    }
}

/** Операции с ломаными (траекториями). */
object Poly {
    fun length(pts: List<Pt>): Float {
        var s = 0f
        for (i in 1 until pts.size) s += pts[i - 1].dist(pts[i])
        return s
    }

    fun pointAtDistance(pts: List<Pt>, d: Float): Pt {
        if (pts.isEmpty()) return Pt(0f, 0f)
        if (d <= 0f) return pts.first()
        var left = d
        for (i in 1 until pts.size) {
            val seg = pts[i - 1].dist(pts[i])
            if (left <= seg && seg > 0f) {
                val k = left / seg
                return pts[i - 1] + (pts[i] - pts[i - 1]) * k
            }
            left -= seg
        }
        return pts.last()
    }

    /** Точка на доле [t] пути, с поправкой, чтобы путь начинался в [start] и заканчивался в [end]. */
    fun pointAlong(pts: List<Pt>, t: Float, start: Pt, end: Pt): Pt {
        val p = pointAtDistance(pts, length(pts) * t)
        val offset = (start - pts.first()) * (1 - t) + (end - pts.last()) * t
        return p + offset
    }

    /** Часть ломаной между расстояниями [from] и [to] от начала. */
    fun sub(pts: List<Pt>, from: Float, to: Float): List<Pt> {
        if (pts.size < 2 || to <= from) return emptyList()
        val out = mutableListOf(pointAtDistance(pts, from))
        var acc = 0f
        for (i in 1 until pts.size) {
            acc += pts[i - 1].dist(pts[i])
            if (acc > from && acc < to) out.add(pts[i])
        }
        out.add(pointAtDistance(pts, to))
        return out
    }

    fun distanceTo(pts: List<Pt>, p: Pt): Float {
        if (pts.size == 1) return pts[0].dist(p)
        var best = Float.MAX_VALUE
        for (i in 1 until pts.size) best = min(best, segDist(p, pts[i - 1], pts[i]))
        return best
    }

    private fun segDist(p: Pt, a: Pt, b: Pt): Float {
        val ab = b - a
        val len2 = ab.x * ab.x + ab.y * ab.y
        if (len2 == 0f) return p.dist(a)
        val t = (((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2).coerceIn(0f, 1f)
        return p.dist(a + ab * t)
    }

    /** Упрощение Рамера — Дугласа — Пекера. */
    fun simplify(pts: List<Pt>, eps: Float = 0.06f): List<Pt> {
        if (pts.size < 3) return pts
        var maxD = 0f
        var idx = 0
        for (i in 1 until pts.size - 1) {
            val d = segDist(pts[i], pts.first(), pts.last())
            if (d > maxD) { maxD = d; idx = i }
        }
        return if (maxD > eps) {
            simplify(pts.subList(0, idx + 1), eps).dropLast(1) + simplify(pts.subList(idx, pts.size), eps)
        } else listOf(pts.first(), pts.last())
    }

    /** Единичный вектор направления в конце линии. */
    fun endDirection(pts: List<Pt>, lookBack: Float): Pt {
        val total = length(pts)
        val from = pointAtDistance(pts, max(0f, total - lookBack))
        val d = pts.last() - from
        val l = sqrt(d.x * d.x + d.y * d.y)
        return if (l == 0f) Pt(0f, 1f) else d * (1f / l)
    }
}
