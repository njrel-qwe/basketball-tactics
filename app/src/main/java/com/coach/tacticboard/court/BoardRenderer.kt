package com.coach.tacticboard.court

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import com.coach.tacticboard.data.CourtType
import com.coach.tacticboard.data.DrawLine
import com.coach.tacticboard.data.LineType
import com.coach.tacticboard.data.Pt
import com.coach.tacticboard.data.Team
import com.coach.tacticboard.data.Token
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

object BoardColors {
    val Surround = Color(0xFF2E4A3A)
    val Floor = Color(0xFFE6B47F)
    val Paint = Color(0xFFC8743E)
    val Lines = Color.White
    val Home = Color(0xFF1565C0)
    val Away = Color(0xFFD32F2F)
    val Ink = Color(0xFF1B1B1B)
    val Ball = Color(0xFFF57C00)
    val Highlight = Color(0xFFFFEB3B)
}

const val TOKEN_RADIUS = 0.55f
const val BALL_RADIUS = 0.3f

// ---------- Площадка ----------

private fun arc(c: Pt, r: Float, fromDeg: Float, toDeg: Float, n: Int = 48): List<Pt> =
    (0..n).map {
        val a = (fromDeg + (toDeg - fromDeg) * it / n) * PI.toFloat() / 180f
        Pt(c.x + r * cos(a), c.y + r * sin(a))
    }

private fun DrawScope.polyline(g: CourtGeometry, pts: List<Pt>, flip: Boolean, color: Color, width: Float, effect: PathEffect? = null) {
    if (pts.size < 2) return
    val path = Path()
    pts.forEachIndexed { i, p ->
        val o = g.toScreen(p.x, if (flip) g.length - p.y else p.y)
        if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
    }
    drawPath(path, color, style = Stroke(width, pathEffect = effect, join = StrokeJoin.Round))
}

private fun DrawScope.drawHalfMarkings(g: CourtGeometry, flip: Boolean) {
    val w = max(2f, g.px(0.06f))
    val c = BoardColors.Lines
    val b = Court.BASKET
    fun y(v: Float) = if (flip) g.length - v else v

    // Трапеция/прямоугольник зоны
    val paintTl = g.toScreen(5.05f, minOf(y(0f), y(5.8f)))
    val paintBr = g.toScreen(9.95f, maxOf(y(0f), y(5.8f)))
    drawRect(BoardColors.Paint, paintTl, androidx.compose.ui.geometry.Size(paintBr.x - paintTl.x, paintBr.y - paintTl.y))
    polyline(g, listOf(Pt(5.05f, 0f), Pt(5.05f, 5.8f), Pt(9.95f, 5.8f), Pt(9.95f, 0f)), flip, c, w)

    // Отметки на линиях зоны
    for (m in listOf(1.75f, 2.85f, 3.7f, 4.55f)) {
        polyline(g, listOf(Pt(4.85f, m), Pt(5.05f, m)), flip, c, w)
        polyline(g, listOf(Pt(9.95f, m), Pt(10.15f, m)), flip, c, w)
    }

    // Круг штрафного броска: ближняя к кольцу половина пунктиром
    val dash = PathEffect.dashPathEffect(floatArrayOf(g.px(0.3f), g.px(0.25f)))
    polyline(g, arc(Pt(7.5f, 5.8f), 1.8f, 0f, 180f), flip, c, w)
    polyline(g, arc(Pt(7.5f, 5.8f), 1.8f, 180f, 360f), flip, c, w, dash)

    // Трёхочковая линия
    val cornerY = b.y + kotlin.math.sqrt(6.75f * 6.75f - 6.6f * 6.6f)
    val angle = kotlin.math.atan2(cornerY - b.y, 6.6f) * 180f / PI.toFloat()
    polyline(g, listOf(Pt(0.9f, 0f), Pt(0.9f, cornerY)), flip, c, w)
    polyline(g, listOf(Pt(14.1f, 0f), Pt(14.1f, cornerY)), flip, c, w)
    polyline(g, arc(b, 6.75f, angle, 180f - angle, 64), flip, c, w)

    // Зона без фолов в нападении, щит и кольцо
    polyline(g, arc(b, 1.25f, 0f, 180f), flip, c, w)
    polyline(g, listOf(Pt(6.6f, 1.2f), Pt(8.4f, 1.2f)), flip, c, max(3f, g.px(0.1f)))
    polyline(g, listOf(Pt(7.5f, 1.2f), Pt(7.5f, 1.35f)), flip, BoardColors.Ball, w)
    polyline(g, arc(b, 0.225f, 0f, 360f, 24), flip, BoardColors.Ball, max(2.5f, g.px(0.07f)))
}

fun DrawScope.drawCourt(g: CourtGeometry) {
    val rect = g.boardRect
    drawRect(BoardColors.Surround, rect.topLeft, rect.size)
    val tl = g.toScreen(0f, 0f)
    val br = g.toScreen(Court.WIDTH, g.length)
    drawRect(BoardColors.Floor, tl, androidx.compose.ui.geometry.Size(br.x - tl.x, br.y - tl.y))

    drawHalfMarkings(g, flip = false)
    if (g.court == CourtType.FULL) drawHalfMarkings(g, flip = true)

    val w = max(2f, g.px(0.06f))
    val c = BoardColors.Lines
    // Центральная линия и круг
    polyline(g, listOf(Pt(0f, 14f), Pt(15f, 14f)), false, c, w)
    if (g.court == CourtType.FULL) {
        polyline(g, arc(Pt(7.5f, 14f), 1.8f, 0f, 360f), false, c, w)
    } else {
        polyline(g, arc(Pt(7.5f, 14f), 1.8f, 180f, 360f), false, c, w)
    }
    // Внешние границы
    polyline(g, listOf(Pt(0f, 0f), Pt(15f, 0f), Pt(15f, g.length), Pt(0f, g.length), Pt(0f, 0f)), false, c, w * 1.4f)
}

// ---------- Линии ----------

private fun smoothPath(g: CourtGeometry, pts: List<Pt>): Path {
    val path = Path()
    val o = pts.map { g.toScreen(it) }
    path.moveTo(o[0].x, o[0].y)
    if (o.size == 2) {
        path.lineTo(o[1].x, o[1].y)
        return path
    }
    for (i in 1 until o.size - 1) {
        val mid = Offset((o[i].x + o[i + 1].x) / 2, (o[i].y + o[i + 1].y) / 2)
        path.quadraticTo(o[i].x, o[i].y, mid.x, mid.y)
    }
    path.lineTo(o.last().x, o.last().y)
    return path
}

private fun DrawScope.arrowHead(g: CourtGeometry, tip: Pt, dir: Pt, color: Color, size: Float = 0.5f) {
    val n = Pt(-dir.y, dir.x)
    val base = tip - dir * size
    val a = g.toScreen(tip)
    val b = g.toScreen(base + n * (size * 0.5f))
    val c = g.toScreen(base - n * (size * 0.5f))
    val path = Path().apply { moveTo(a.x, a.y); lineTo(b.x, b.y); lineTo(c.x, c.y); close() }
    drawPath(path, color, style = Fill)
}

/** Обрезает линию, чтобы она не заходила под фишки игроков на концах. */
private fun trimmed(line: DrawLine, tokens: List<Token>): List<Pt> {
    val pts = line.points
    val total = Poly.length(pts)
    var start = 0f
    var end = total
    val first = pts.first()
    val last = pts.last()
    tokens.minByOrNull { it.pos.dist(first) }?.let { t ->
        val d = t.pos.dist(first)
        if (d < TOKEN_RADIUS) start = TOKEN_RADIUS + 0.05f - d
    }
    tokens.filter { it.id != line.fromId }.minByOrNull { it.pos.dist(last) }?.let { t ->
        val d = t.pos.dist(last)
        if (d < TOKEN_RADIUS + 0.1f) end = total - (TOKEN_RADIUS + 0.12f - d)
    }
    return if (end - start > 0.3f) Poly.sub(pts, start, end) else pts
}

fun lineColor(line: DrawLine, tokens: List<Token>): Color {
    val from = tokens.firstOrNull { it.id == line.fromId }
    return if (from?.team == Team.AWAY) BoardColors.Away else BoardColors.Ink
}

fun DrawScope.drawLine(g: CourtGeometry, line: DrawLine, tokens: List<Token>, alpha: Float = 1f) {
    if (line.points.size < 2) return
    val pts = trimmed(line, tokens)
    if (pts.size < 2) return
    val color = lineColor(line, tokens).copy(alpha = alpha)
    val width = max(3f, g.px(0.09f))
    val total = Poly.length(pts)
    val dir = Poly.endDirection(pts, 0.4f)
    val stroke = Stroke(width, cap = StrokeCap.Round, join = StrokeJoin.Round)

    when (line.type) {
        LineType.MOVE -> {
            drawPath(smoothPath(g, Poly.sub(pts, 0f, max(0f, total - 0.3f)).ifEmpty { pts }), color, style = stroke)
            arrowHead(g, pts.last(), dir, color)
        }
        LineType.PASS -> {
            val effect = PathEffect.dashPathEffect(floatArrayOf(g.px(0.35f), g.px(0.22f)))
            drawPath(
                smoothPath(g, Poly.sub(pts, 0f, max(0f, total - 0.3f)).ifEmpty { pts }), color,
                style = Stroke(width, cap = StrokeCap.Butt, join = StrokeJoin.Round, pathEffect = effect),
            )
            arrowHead(g, pts.last(), dir, color)
        }
        LineType.DRIBBLE -> {
            val waveEnd = max(0f, total - 0.6f)
            val step = 0.08f
            val amp = 0.17f
            val period = 0.7f
            val wave = mutableListOf<Pt>()
            var d = 0f
            while (d <= waveEnd) {
                val p = Poly.pointAtDistance(pts, d)
                val ahead = Poly.pointAtDistance(pts, d + 0.05f)
                val t = ahead - p
                val l = t.length().takeIf { it > 0f } ?: 1f
                val n = Pt(-t.y / l, t.x / l)
                wave.add(p + n * (amp * sin(2 * PI.toFloat() * d / period)))
                d += step
            }
            wave.add(Poly.pointAtDistance(pts, total - 0.3f))
            if (wave.size >= 2) {
                val path = Path()
                wave.forEachIndexed { i, p ->
                    val o = g.toScreen(p)
                    if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
                }
                drawPath(path, color, style = stroke)
            }
            arrowHead(g, pts.last(), dir, color)
        }
        LineType.SCREEN -> {
            drawPath(smoothPath(g, pts), color, style = stroke)
            val n = Pt(-dir.y, dir.x)
            val end = pts.last()
            drawLine(color, g.toScreen(end + n * 0.5f), g.toScreen(end - n * 0.5f), width * 1.4f, StrokeCap.Round)
        }
    }
}

// ---------- Игроки и мяч ----------

private fun textPaint(color: Color, size: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = color.toArgb()
    textSize = size
    textAlign = Paint.Align.CENTER
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
}

fun DrawScope.drawToken(g: CourtGeometry, t: Token, highlight: Boolean = false) {
    val c = g.toScreen(t.pos)
    val r = g.px(TOKEN_RADIUS)
    // тень
    drawCircle(Color.Black.copy(alpha = 0.25f), r, c + Offset(r * 0.08f, r * 0.12f))
    if (highlight) drawCircle(BoardColors.Highlight, r * 1.3f, c)
    val textColor: Color
    if (t.team == Team.HOME) {
        drawCircle(BoardColors.Home, r, c)
        drawCircle(Color.White, r, c, style = Stroke(r * 0.12f))
        textColor = Color.White
    } else {
        drawCircle(Color.White, r, c)
        drawCircle(BoardColors.Away, r, c, style = Stroke(r * 0.16f))
        textColor = BoardColors.Away
    }
    val label = t.label
    val size = when {
        label.length <= 1 -> r * 1.2f
        label.length == 2 -> r * 0.95f
        else -> r * 0.72f
    }
    drawIntoCanvas { canvas ->
        val p = textPaint(textColor, size)
        val fm = p.fontMetrics
        canvas.nativeCanvas.drawText(label, c.x, c.y - (fm.ascent + fm.descent) / 2, p)
    }
}

fun DrawScope.drawBall(g: CourtGeometry, p: Pt, highlight: Boolean = false) {
    val c = g.toScreen(p)
    val r = g.px(BALL_RADIUS)
    if (highlight) drawCircle(BoardColors.Highlight, r * 1.5f, c)
    drawCircle(BoardColors.Ball, r, c)
    val w = max(1.5f, r * 0.12f)
    drawCircle(BoardColors.Ink, r, c, style = Stroke(w))
    drawLine(BoardColors.Ink, c + Offset(-r, 0f), c + Offset(r, 0f), w)
    drawLine(BoardColors.Ink, c + Offset(0f, -r), c + Offset(0f, r), w)
}

/** Полная отрисовка доски: площадка, линии, фишки, мяч. */
fun DrawScope.drawBoard(
    g: CourtGeometry,
    tokens: List<Token>,
    lines: List<DrawLine>,
    ball: Pt?,
    linesAlpha: Float = 1f,
    draft: DrawLine? = null,
    highlightId: String? = null,
) {
    drawCourt(g)
    lines.forEach { drawLine(g, it, tokens, linesAlpha) }
    draft?.let { drawLine(g, it, tokens, 0.7f) }
    tokens.forEach { drawToken(g, it, it.id == highlightId) }
    ball?.let { drawBall(g, it, highlightId == BALL_ID) }
}

const val BALL_ID = "__ball__"
