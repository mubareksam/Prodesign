package com.qelem.tablet

import org.junit.Assert.*
import org.junit.Test

class PadGestureTest {
    @Test fun movingDoesNotStartDrawingButNearbyDoubleTapDoes() {
        val g = PadGesture(20f)
        assertFalse(g.down(100, 0f, 0f)); g.move(100f, 0f); g.up(200, 100f, 0f, false)
        assertFalse(g.down(250, 100f, 0f)); g.up(300, 100f, 0f, false)
        assertTrue(g.down(400, 105f, 0f)); g.up(500, 110f, 0f, true)
        assertFalse(g.down(520, 110f, 0f))
    }
    @Test fun distantSlowAndCancelledTapsNeverDraw() {
        val g = PadGesture(20f)
        assertFalse(g.down(100, 0f, 0f)); g.up(120, 0f, 0f, false)
        assertFalse(g.down(200, 50f, 0f)); g.up(210, 50f, 0f, false)
        assertFalse(g.down(900, 50f, 0f)); g.up(920, 50f, 0f, false); g.cancel()
        assertFalse(g.down(930, 50f, 0f))
    }
}
