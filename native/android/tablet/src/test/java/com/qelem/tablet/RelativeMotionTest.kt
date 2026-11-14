package com.qelem.tablet

import org.junit.Assert.*
import org.junit.Test

class RelativeMotionTest {
    @Test fun eachTouchStartsFromCurrentCursorAndOnlyMovementProducesDeltas() {
        val motion = RelativeMotion(8f)
        motion.down(100f, 100f)
        assertEquals(0f, motion.move(100f, 100f, 200, 200)!!.first, 0.0001f)
        assertEquals(0.1f, motion.move(120f, 80f, 200, 200)!!.first, 0.0001f)
        assertFalse(motion.isTap())
        motion.down(10f, 20f)
        assertTrue(motion.isTap())
        assertEquals(0.05f, motion.move(20f, 20f, 200, 200)!!.first, 0.0001f)
        assertNull(motion.move(20f, 20f, 0, 200))
    }
}
