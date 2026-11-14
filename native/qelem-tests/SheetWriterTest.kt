package io.github.artcraftandroid.procraft.canvas

import android.graphics.Bitmap
import android.graphics.Canvas
import java.io.File
import javax.imageio.ImageIO

fun main() {
    val sprite = qelemSheetPlan(3, 2, 128, false)!!
    check(sprite.width == 256 && sprite.height == 256 && sprite.rows == 2 && sprite.cell(2) == (0 to 128))
    val story = qelemSheetPlan(3, 2, 128, true)!!
    check(story.width == 256 && story.height == 320 && story.cell(2) == (0 to 160))
    check(qelemSheetPlan(0, 2, 128, false) == null)
    check(qelemSheetPlan(61, 2, 128, false) == null)
    check(qelemSheetPlan(2, 0, 128, false) == null)
    check(qelemSheetPlan(2, 2, 129, false) == null)
    check(qelemSheetPlan(60, 1, 384, true) == null)
    check(qelemSheetPlan(60, 6, 384, true) == null) // 8 MP cap
    fun image(i: Int): QelemSheetFrame {
        val color = when (i) { 0 -> intArrayOf(255, 0, 0, 255); 1 -> intArrayOf(0, 255, 0, 128); else -> intArrayOf(0, 0, 255, 255) }
        return QelemSheetFrame(4, 4, ByteArray(4 * 4 * 4) { color[it % 4].toByte() })
    }
    val dir = java.nio.file.Files.createTempDirectory("qelem-sheets-").toFile()
    try {
        val out = File(dir, "sprite.png")
        val progress = mutableListOf<Float>()
        check(qelemWriteSheet(sprite, false, listOf(1, 3, 1), out, { true }, ::image, progress::add))
        val png = ImageIO.read(out)
        check(png.width == 256 && png.height == 256)
        check(png.getRGB(63, 63) == 0xffff0000.toInt())
        check((png.getRGB(191, 63) ushr 24) == 128 && (png.getRGB(191, 63) and 0x00ff00) == 0x00ff00)
        check(png.getRGB(63, 191) == 0xff0000ff.toInt())
        check(png.getRGB(191, 191) == 0) // unused cell stays transparent
        check(progress.last() == 1f && progress.zipWithNext().all { (a, b) -> b >= a })
        check(Bitmap.alive == 0)
        Canvas.labels.clear()
        val storyOut = File(dir, "story.png")
        check(qelemWriteSheet(story, true, listOf(1, 3, 1), storyOut, { true }, ::image, {}))
        check(ImageIO.read(storyOut).getRGB(250, 310) == ColorWhite)
        check(Canvas.labels == listOf("Frame 1 · 1×", "Frame 2 · 3×", "Frame 3 · 1×"))
        check(Bitmap.alive == 0)
        val fail = File(dir, "failure.png").apply { writeText("partial") }
        check(!qelemWriteSheet(sprite, false, listOf(1, 1, 1), fail, { true }, { if (it == 1) null else image(it) }, {}))
        check(!fail.exists() && Bitmap.alive == 0)
        var visits = 0
        fail.writeText("partial")
        check(!qelemWriteSheet(sprite, false, listOf(1, 1, 1), fail, { ++visits < 4 }, ::image, {}))
        check(!fail.exists() && Bitmap.alive == 0)
        fail.writeText("partial")
        check(!qelemWriteSheet(sprite, false, listOf(1, 1, 1), fail, { true }, { QelemSheetFrame(129, 1, ByteArray(129 * 4)) }, {}))
        check(!fail.exists() && Bitmap.alive == 0)
        fail.writeText("partial")
        Bitmap.failCompression = true
        check(!qelemWriteSheet(sprite, false, listOf(1, 1, 1), fail, { true }, ::image, {}))
        Bitmap.failCompression = false
        check(!fail.exists() && Bitmap.alive == 0)
        fail.writeText("partial")
        check(runCatching { qelemWriteSheet(sprite, false, listOf(1, 1, 1), fail, { true }, { throw IllegalStateException("simulated") }, {}) }.isFailure)
        check(!fail.exists() && Bitmap.alive == 0)
        println("Qelem sheets: pixel/alpha layout, labels, bounds, cancellation and failure cleanup passed")
    } finally { dir.deleteRecursively() }
}
private const val ColorWhite = -1
