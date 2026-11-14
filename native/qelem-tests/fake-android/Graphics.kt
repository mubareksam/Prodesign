// JVM-only fake for testing the real sheet writer; not part of the Android app.
package android.graphics

import java.awt.image.BufferedImage
import java.io.OutputStream
import javax.imageio.ImageIO

object Color { const val WHITE = -1; const val BLACK = -0x1000000 }
class Paint(flags: Int = 0) {
    var isFilterBitmap = false
    var color: Int = Color.BLACK
    var textSize: Float = 16f
    companion object { const val ANTI_ALIAS_FLAG = 1 }
}
class Bitmap private constructor(val image: BufferedImage) {
    enum class Config { ARGB_8888 }
    enum class CompressFormat { PNG }
    private var recycled = false
    init { alive++ }
    fun recycle() { if (!recycled) { recycled = true; alive-- } }
    fun compress(format: CompressFormat, quality: Int, stream: OutputStream): Boolean = !failCompression && ImageIO.write(image, "png", stream)
    companion object {
        var alive = 0
        var failCompression = false
        fun createBitmap(w: Int, h: Int, config: Config) = Bitmap(BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB))
        fun createBitmap(pixels: IntArray, w: Int, h: Int, config: Config): Bitmap {
            val b = createBitmap(w, h, config)
            b.image.setRGB(0, 0, w, h, pixels, 0, w)
            return b
        }
    }
}
class Canvas(private val target: Bitmap) {
    fun drawColor(color: Int) {
        val g = target.image.createGraphics()
        try { g.color = java.awt.Color(color, true); g.fillRect(0, 0, target.image.width, target.image.height) } finally { g.dispose() }
    }
    fun drawBitmap(bitmap: Bitmap, x: Float, y: Float, paint: Paint) {
        val g = target.image.createGraphics()
        try { g.drawImage(bitmap.image, x.toInt(), y.toInt(), null) } finally { g.dispose() }
    }
    fun drawRect(left: Float, top: Float, right: Float, bottom: Float, paint: Paint) {
        val g = target.image.createGraphics()
        try {
            g.color = java.awt.Color(paint.color, true)
            g.fillRect(left.toInt(), top.toInt(), (right - left).toInt(), (bottom - top).toInt())
        } finally { g.dispose() }
    }
    fun drawText(text: String, x: Float, y: Float, paint: Paint) {
        labels.add(text)
        val g = target.image.createGraphics()
        try { g.color = java.awt.Color(paint.color, true); g.drawString(text, x, y) } finally { g.dispose() }
    }
    companion object { val labels = mutableListOf<String>() }
}
