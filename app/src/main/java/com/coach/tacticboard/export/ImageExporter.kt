package com.coach.tacticboard.export

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.content.FileProvider
import com.coach.tacticboard.court.Court
import com.coach.tacticboard.court.CourtGeometry
import com.coach.tacticboard.court.drawBoard
import com.coach.tacticboard.data.Frame
import com.coach.tacticboard.data.Tactic
import com.coach.tacticboard.data.Variant
import com.coach.tacticboard.data.interpolate
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object ImageExporter {

    private val Bg = Color(0xFF121820)

    private fun render(width: Int, height: Int, block: DrawScope.() -> Unit): Bitmap {
        val image = ImageBitmap(width, height)
        CanvasDrawScope().draw(Density(1f), LayoutDirection.Ltr, Canvas(image), Size(width.toFloat(), height.toFloat())) {
            drawRect(Bg)
            block()
        }
        return image.asAndroidBitmap()
    }

    private fun paint(size: Float, bold: Boolean, color: Int = android.graphics.Color.WHITE) =
        TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size
            this.color = color
            typeface = Typeface.create(Typeface.DEFAULT, if (bold) Typeface.BOLD else Typeface.NORMAL)
        }

    private fun DrawScope.text(text: String, x: Float, y: Float, width: Int, p: TextPaint, maxLines: Int = 3): Float {
        if (text.isBlank()) return 0f
        val layout = StaticLayout.Builder.obtain(text, 0, text.length, p, width)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setMaxLines(maxLines)
            .setEllipsize(android.text.TextUtils.TruncateAt.END)
            .build()
        drawIntoCanvas {
            it.nativeCanvas.save()
            it.nativeCanvas.translate(x, y)
            layout.draw(it.nativeCanvas)
            it.nativeCanvas.restore()
        }
        return layout.height.toFloat()
    }

    private fun DrawScope.board(tactic: Tactic, frame: Frame, area: Rect) {
        val g = CourtGeometry.fit(area, tactic.court)
        val rs = interpolate(frame, null, 0f)
        drawBoard(g, rs.tokens, frame.lines, rs.ball)
    }

    /** Один шаг комбинации. */
    fun renderStep(tactic: Tactic, variant: Variant, index: Int, width: Int = 1440): Bitmap {
        val frame = variant.frames[index]
        val pad = width * 0.04f
        val boardW = width - 2 * pad
        val boardH = boardW / Court.aspect(tactic.court)
        val header = width * 0.13f
        val noteH = if (frame.note.isNotBlank()) width * 0.12f else 0f
        val height = (header + boardH + noteH + pad * 2).toInt()
        return render(width, height) {
            val title = "${tactic.name} · ${variant.name}"
            text(title, pad, pad, boardW.toInt(), paint(width * 0.045f, true), 1)
            val sub = "Шаг ${index + 1} из ${variant.frames.size}" + if (tactic.category.isNotBlank()) " · ${tactic.category}" else ""
            text(sub, pad, pad + width * 0.06f, boardW.toInt(), paint(width * 0.03f, false, 0xFFFFB74D.toInt()), 1)
            board(tactic, frame, Rect(Offset(pad, header + pad * 0.5f), Size(boardW, boardH)))
            text(frame.note, pad, header + boardH + pad, boardW.toInt(), paint(width * 0.032f, false))
        }
    }

    /** Все шаги варианта на одном листе (сетка в 2 колонки). */
    fun renderSheet(tactic: Tactic, variant: Variant, width: Int = 2000): Bitmap {
        val cols = if (variant.frames.size == 1) 1 else 2
        val rows = (variant.frames.size + cols - 1) / cols
        val pad = width * 0.03f
        val cellW = (width - pad * (cols + 1)) / cols
        val boardH = cellW / Court.aspect(tactic.court)
        val captionH = width * 0.075f / cols * 2
        val cellH = boardH + captionH
        val header = width * 0.09f
        val height = (header + rows * (cellH + pad) + pad).toInt()
        return render(width, height) {
            text("${tactic.name} · ${variant.name}", pad, pad, (width - 2 * pad).toInt(), paint(width * 0.035f, true), 1)
            if (tactic.category.isNotBlank()) {
                text(tactic.category, pad, pad + width * 0.045f, (width - 2 * pad).toInt(), paint(width * 0.022f, false, 0xFFFFB74D.toInt()), 1)
            }
            variant.frames.forEachIndexed { i, frame ->
                val col = i % cols
                val row = i / cols
                val x = pad + col * (cellW + pad)
                val y = header + pad + row * (cellH + pad)
                board(tactic, frame, Rect(Offset(x, y), Size(cellW, boardH)))
                val caption = "${i + 1}. " + frame.note.ifBlank { "Шаг ${i + 1}" }
                text(caption, x, y + boardH + pad * 0.3f, cellW.toInt(), paint(width * 0.02f * 2 / cols, false), 2)
            }
        }
    }

    private fun fileName(tactic: Tactic): String {
        val safe = tactic.name.replace(Regex("[^\\p{L}\\p{N}_-]+"), "_").trim('_').ifBlank { "tactic" }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return "${safe}_$stamp.png"
    }

    /** Сохраняет в галерею (Pictures/TacticBoard). Возвращает описание места сохранения. */
    fun saveToGallery(context: Context, bitmap: Bitmap, tactic: Tactic): String {
        val name = fileName(tactic)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/TacticBoard")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
            val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                ?: error("Не удалось создать файл")
            resolver.openOutputStream(uri)?.use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            "Галерея › Pictures/TacticBoard"
        } else {
            val dir = File(context.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "").apply { mkdirs() }
            val file = File(dir, name)
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            file.absolutePath
        }
    }

    fun share(context: Context, bitmap: Bitmap, tactic: Tactic) {
        val dir = File(context.cacheDir, "shared").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val file = File(dir, fileName(tactic))
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        val uri: Uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, tactic.name)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Поделиться схемой").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
