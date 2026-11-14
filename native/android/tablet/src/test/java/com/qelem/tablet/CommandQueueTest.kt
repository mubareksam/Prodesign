package com.qelem.tablet

import org.junit.Assert.*
import org.junit.Test

class CommandQueueTest {
    @Test fun motionIsCoalescedWithoutLosingStrokeBoundaries() {
        val q = CommandQueue(4, 2)
        assertTrue(q.offer("D 0 0 1 S")); assertTrue(q.offer("M 0.1 0.1 1"))
        assertTrue(q.offer("M 0.2 0.2 1")); assertTrue(q.offer("M 0.3 0.3 1")); assertTrue(q.offer("U 0.4 0.4 1"))
        assertEquals("D 0 0 1 S", q.take(1)); assertEquals("M 0.3 0.3 1", q.take(1)); assertEquals("U 0.4 0.4 1", q.take(1))
    }
    @Test fun criticalEventsEvictOnlyMotionAndStopWakes() {
        val q = CommandQueue(3, 20)
        assertTrue(q.offer("D 0 0 1 S")); assertTrue(q.offer("M 0.1 0.1 1")); assertTrue(q.offer("UNDO")); assertTrue(q.offer("U 1 1 1"))
        assertEquals("D 0 0 1 S", q.take(1)); assertEquals("UNDO", q.take(1)); assertEquals("U 1 1 1", q.take(1))
        q.stop(); assertFalse(q.offer("D 0 0 1 S")); assertNull(q.take(1))
    }
    @Test fun relativeMotionIsNeverDiscarded() {
        val q = CommandQueue(2, 1)
        assertTrue(q.offer("R .1 .2")); assertTrue(q.offer("R .2 .3")); assertFalse(q.offer("R .3 .4"))
    }
}
