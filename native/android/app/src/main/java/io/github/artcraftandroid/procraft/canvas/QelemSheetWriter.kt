package io.github.artcraftandroid.procraft.canvas

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import java.io.File

/** Straight-alpha RGBA supplied by the native engine, scaled to fit one tile. */
internal data class QelemSheetFrame(val width: Int, val height: Int, val rgba: ByteArray)

/**
 * Writes a temporary PNG. The caller owns a successful file; on failure the incomplete file is
 * removed. The source callback may stop at any frame, and no frame is silently dropped.
 */
internal fun qelemWriteSheet(
    plan: QelemSheetPlan,
    storyboard: Boolean,
    holds: List<Int>,
    output: File,
    valid: () -> Boolean,
    readFrame: (Int) -> QelemSheetFrame?,
    progress: (Float) -> Unit,
): Boolean {
    var sheet: Bitmap? = null
    var complete = false
    try {
        if (holds.size != plan.frames || !valid()) return false
        val result = Bitmap.createBitmap(plan.width, plan.height, Bitmap.Config.ARGB_8888)
        sheet = result
        val canvas = Canvas(result)
        if (storyboard) canvas.drawColor(Color.WHITE)
        val paint = Paint().apply { isFilterBitmap = storyboard }
        val ink = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 16f }
        for (i in 0 until plan.frames) {
            if (!valid()) return false
            val image = readFrame(i) ?: return false
            val w = image.width
            val h = image.height
            if (w !in 1..plan.tile || h !in 1..plan.tile || image.rgba.size.toLong() != w.toLong() * h * 4) return false
            val pixels = IntArray(w * h) { n ->
                val k = n * 4
                ((image.rgba[k + 3].toInt() and 255) shl 24) or ((image.rgba[k].toInt() and 255) shl 16) or
                    ((image.rgba[k + 1].toInt() and 255) shl 8) or (image.rgba[k + 2].toInt() and 255)
            }
            val bitmap = Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888)
            try {
                val (x, y) = plan.cell(i)
                val left = x + (plan.tile - w) / 2f
                val top = y + (plan.tile - h) / 2f
                canvas.drawBitmap(bitmap, left, top, paint)
                if (storyboard) canvas.drawText("Frame ${i + 1} · ${holds[i].coerceAtLeast(1)}×", (x + 5).toFloat(), (y + plan.tile + 22).toFloat(), ink)
            } finally { bitmap.recycle() }
            progress((i + 1).toFloat() / (plan.frames + 1))
        }
        if (!valid()) return false
        val written = output.outputStream().use { result.compress(Bitmap.CompressFormat.PNG, 100, it) }
        if (!written || !valid()) return false
        progress(1f)
        complete = true
        return true
    } finally {
        sheet?.recycle()
        if (!complete) output.delete()
    }
}
