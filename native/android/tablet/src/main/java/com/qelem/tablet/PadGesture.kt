package com.qelem.tablet

/** Finger move is non-marking. Only a nearby second tap within the window starts a stroke. */
internal class PadGesture(private val slop: Float, private val doubleTapMs: Long = 350) {
    private var lastTime: Long = -1
    private var lastX = 0f; private var lastY = 0f
    private var startX = 0f; private var startY = 0f; private var moved = false
    private fun close(x: Float, y: Float, a: Float, b: Float): Boolean { val dx = x-a; val dy = y-b; return dx*dx + dy*dy <= slop*slop }
    fun down(time: Long, x: Float, y: Float): Boolean {
        val double = lastTime >= 0 && time >= lastTime && time - lastTime <= doubleTapMs && close(x,y,lastX,lastY)
        lastTime = -1; startX = x; startY = y; moved = false
        return double
    }
    fun move(x: Float, y: Float) { if (!close(x,y,startX,startY)) moved = true }
    fun up(time: Long, x: Float, y: Float, drew: Boolean) { if (!drew && !moved && close(x,y,startX,startY)) { lastTime = time; lastX = x; lastY = y } else lastTime = -1 }
    fun cancel() { lastTime = -1; moved = true }
}
