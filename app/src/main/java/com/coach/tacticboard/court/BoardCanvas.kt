package com.coach.tacticboard.court

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import com.coach.tacticboard.data.CourtType
import com.coach.tacticboard.data.DrawLine
import com.coach.tacticboard.data.Frame
import com.coach.tacticboard.data.Pt
import com.coach.tacticboard.data.interpolate

/** Обработчик касаний доски — координаты уже в метрах площадки. */
interface BoardInput {
    fun onDragStart(p: Pt, geometry: CourtGeometry)
    fun onDrag(p: Pt)
    fun onDragEnd()
    fun onTap(p: Pt)
}

/**
 * Доска с площадкой. Если [next] задан и [progress] > 0 — рисуется промежуточное
 * положение игроков при переходе от [frame] к [next].
 */
@Composable
fun BoardCanvas(
    court: CourtType,
    frame: Frame,
    modifier: Modifier = Modifier,
    next: Frame? = null,
    progress: Float = 0f,
    draft: DrawLine? = null,
    highlightId: String? = null,
    input: BoardInput? = null,
) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(
            Modifier
                .aspectRatio(Court.aspect(court), matchHeightConstraintsFirst = true)
                .then(
                    if (input == null) Modifier else Modifier.pointerInput(court, input) {
                        awaitEachGesture {
                            val down = awaitFirstDown()
                            val g = CourtGeometry.fit(size.toSizeF(), court)
                            val start = down.position
                            var dragging = false
                            while (true) {
                                val event = awaitPointerEvent()
                                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                                if (!change.pressed) break
                                if (!dragging && (change.position - start).getDistance() > viewConfiguration.touchSlop * 0.6f) {
                                    dragging = true
                                    input.onDragStart(g.toCourt(start), g)
                                }
                                if (dragging) {
                                    input.onDrag(g.toCourt(change.position))
                                    change.consume()
                                }
                            }
                            if (dragging) input.onDragEnd() else input.onTap(g.toCourt(start))
                        }
                    }
                )
        ) {
            val g = CourtGeometry.fit(size, court)
            if (next != null && progress > 0f) {
                val rs = interpolate(frame, next, progress)
                drawBoard(g, rs.tokens, frame.lines, rs.ball, linesAlpha = 0.3f)
            } else {
                val rs = interpolate(frame, null, 0f)
                drawBoard(g, rs.tokens, frame.lines, rs.ball, draft = draft, highlightId = highlightId)
            }
        }
    }
}

private fun androidx.compose.ui.unit.IntSize.toSizeF() =
    androidx.compose.ui.geometry.Size(width.toFloat(), height.toFloat())
