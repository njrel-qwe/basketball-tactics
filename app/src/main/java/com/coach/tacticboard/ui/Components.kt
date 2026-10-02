package com.coach.tacticboard.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.coach.tacticboard.data.CATEGORIES
import com.coach.tacticboard.data.LineType
import kotlin.math.PI
import kotlin.math.sin

/** Маленькая иконка, показывающая стиль линии. */
@Composable
fun LineTypeIcon(type: LineType, color: Color, size: Dp = 26.dp) {
    Canvas(Modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val sw = w * 0.09f
        val y = h / 2
        val x0 = w * 0.08f
        val x1 = w * 0.92f
        val head = w * 0.24f
        fun arrow() {
            val p = Path().apply {
                moveTo(x1, y); lineTo(x1 - head, y - head * 0.55f); lineTo(x1 - head, y + head * 0.55f); close()
            }
            drawPath(p, color)
        }
        when (type) {
            LineType.MOVE -> {
                drawLine(color, Offset(x0, y), Offset(x1 - head * 0.8f, y), sw, StrokeCap.Round); arrow()
            }
            LineType.PASS -> {
                drawLine(
                    color, Offset(x0, y), Offset(x1 - head * 0.8f, y), sw,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(w * 0.14f, w * 0.09f)),
                ); arrow()
            }
            LineType.DRIBBLE -> {
                val p = Path()
                val end = x1 - head * 0.9f
                var x = x0
                p.moveTo(x, y)
                while (x < end) {
                    x += w * 0.02f
                    p.lineTo(x, y + h * 0.16f * sin((x - x0) / (w * 0.22f) * 2 * PI.toFloat()))
                }
                drawPath(p, color, style = Stroke(sw, cap = StrokeCap.Round)); arrow()
            }
            LineType.SCREEN -> {
                drawLine(color, Offset(x0, y), Offset(x1, y), sw, StrokeCap.Round)
                drawLine(color, Offset(x1, y - h * 0.28f), Offset(x1, y + h * 0.28f), sw * 1.3f, StrokeCap.Round)
            }
        }
    }
}

/** Диалог ввода одной строки. */
@Composable
fun TextInputDialog(
    title: String,
    initial: String,
    label: String = "",
    singleLine: Boolean = true,
    confirmText: String = "Готово",
    allowEmpty: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var value by remember { mutableStateOf(TextFieldValue(initial, TextRange(0, initial.length))) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = value,
                onValueChange = { value = it },
                label = if (label.isNotEmpty()) ({ Text(label) }) else null,
                singleLine = singleLine,
                minLines = if (singleLine) 1 else 3,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
        },
        confirmButton = {
            TextButton(
                enabled = allowEmpty || value.text.isNotBlank(),
                onClick = { onConfirm(value.text) },
            ) { Text(confirmText) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

/** Диалог названия, категории и описания тактики. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TacticInfoDialog(
    title: String,
    name: String,
    category: String,
    description: String,
    confirmText: String = "Сохранить",
    extra: (@Composable () -> Unit)? = null,
    onDismiss: () -> Unit,
    onConfirm: (name: String, category: String, description: String) -> Unit,
) {
    var n by remember { mutableStateOf(name) }
    var c by remember { mutableStateOf(category) }
    var d by remember { mutableStateOf(description) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = n, onValueChange = { n = it },
                    label = { Text("Название, например «Пик-н-ролл»") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth(),
                )
                Text("Категория", style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    CATEGORIES.forEach { cat ->
                        FilterChip(selected = c == cat, onClick = { c = if (c == cat) "" else cat }, label = { Text(cat) })
                    }
                }
                OutlinedTextField(
                    value = d, onValueChange = { d = it },
                    label = { Text("Описание (необязательно)") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 160.dp),
                )
                extra?.invoke()
            }
        },
        confirmButton = {
            TextButton(enabled = n.isNotBlank(), onClick = { onConfirm(n, c, d) }) { Text(confirmText) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

@Composable
fun ConfirmDialog(title: String, text: String, confirmText: String, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = { TextButton(onClick = { onConfirm(); onDismiss() }) { Text(confirmText) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
