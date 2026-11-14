package com.qelem.tablet

/** Every contact is a fresh anchor, so touching the pad never moves the cursor by itself. */
internal class RelativeMotion(private val slop: Float) {
    private var x = 0f; private var y = 0f; private var startX = 0f; private var startY = 0f
    private var moved = false
    fun down(x: Float, y: Float) { this.x = x; this.y = y; startX = x; startY = y; moved = false }
    fun move(x: Float, y: Float, width: Int, height: Int): Pair<Float, Float>? {
        val dx = x - this.x; val dy = y - this.y; this.x = x; this.y = y
        val sx = x - startX; val sy = y - startY
        if (sx * sx + sy * sy > slop * slop) moved = true
        if (width <= 0 || height <= 0) return null
        return (dx / width).coerceIn(-1f, 1f) to (dy / height).coerceIn(-1f, 1f)
    }
    fun isTap() = !moved
}
