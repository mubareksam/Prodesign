package io.github.artcraftandroid.procraft.canvas

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import java.io.File
import java.util.Locale

/** Snapshot a native palette as a white PNG chart; empty slots are omitted, in palette order. */
internal fun qelemWritePaletteChart(name: String, colors: List<Int>, output: File, valid: () -> Boolean): Boolean {
    var bitmap: Bitmap? = null
    var complete = false
    try {
        if (colors.isEmpty() || colors.size > 30 || !valid()) return false
        val columns = 5
        val cellW = 120
        val cellH = 100
        val header = 44
        val rows = (colors.size + columns - 1) / columns
        val result = Bitmap.createBitmap(columns * cellW, header + rows * cellH, Bitmap.Config.ARGB_8888)
        bitmap = result
        val canvas = Canvas(result)
        canvas.drawColor(Color.WHITE)
        val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 16f }
        val swatch = Paint()
        canvas.drawText(name.trim().ifEmpty { "Palette" }.take(50), 12f, 27f, text)
        colors.forEachIndexed { i, rgb ->
            if (!valid()) return false
            val x = (i % columns * cellW).toFloat()
            val y = (header + i / columns * cellH).toFloat()
            swatch.color = 0xff000000.toInt() or (rgb and 0xffffff)
            canvas.drawRect(x + 8f, y + 5f, x + 112f, y + 66f, swatch)
            canvas.drawText(String.format(Locale.ROOT, "#%06X", rgb and 0xffffff), x + 8f, y + 88f, text)
        }
        if (!valid()) return false
        val written = output.outputStream().use { result.compress(Bitmap.CompressFormat.PNG, 100, it) }
        if (!written || !valid()) return false
        complete = true
        return true
    } finally {
        bitmap?.recycle()
        if (!complete) output.delete()
    }
}
