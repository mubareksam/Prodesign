package io.github.artcraftandroid.procraft.canvas

import android.graphics.Bitmap
import android.graphics.Canvas
import java.io.File
import javax.imageio.ImageIO

fun main() {
    val dir = java.nio.file.Files.createTempDirectory("qelem-palette-").toFile()
    try {
        val out = File(dir, "chart.png")
        Canvas.labels.clear()
        check(qelemWritePaletteChart("Palette 1", listOf(0x123456, 0xff8800, 0x00ff00), out) { true })
        val image = ImageIO.read(out)
        check(image.width == 600 && image.height == 144)
        check(image.getRGB(10, 50) == 0xff123456.toInt())
        check(image.getRGB(130, 50) == 0xffff8800.toInt())
        check(image.getRGB(250, 50) == 0xff00ff00.toInt())
        check(image.getRGB(500, 50) == -1)
        check(Canvas.labels == listOf("Palette 1", "#123456", "#FF8800", "#00FF00"))
        check(Bitmap.alive == 0)
        out.writeText("partial")
        check(!qelemWritePaletteChart("empty", emptyList(), out) { true })
        check(!out.exists() && Bitmap.alive == 0)
        out.writeText("partial")
        var calls = 0
        check(!qelemWritePaletteChart("cancel", listOf(1, 2, 3), out) { ++calls < 3 })
        check(!out.exists() && Bitmap.alive == 0)
        out.writeText("partial")
        Bitmap.failCompression = true
        check(!qelemWritePaletteChart("compress", listOf(1), out) { true })
        Bitmap.failCompression = false
        check(!out.exists() && Bitmap.alive == 0)
        out.writeText("partial")
        check(!qelemWritePaletteChart("overflow", List(31) { it }, out) { true })
        check(!out.exists() && Bitmap.alive == 0)
        println("Qelem palette chart: PNG colours, HEX labels, empty palette and cancellation passed")
    } finally { dir.deleteRecursively() }
}
