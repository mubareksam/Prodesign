package io.github.artcraftandroid.procraft.canvas

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class QelemPreviewTest {
    @Test fun rangeTracksFrameIdsAndIncludesHeldSlots() {
        val ids = listOf(7uL, 8uL, 9uL)
        val slots = listOf(0, 0, 1, 2, 2, 2)
        val bounds = qelemPreviewBounds(ids, 8uL, 9uL)
        assertEquals(1..2, bounds)
        assertEquals(listOf(2, 3, 4, 5), qelemRangeSlots(slots, bounds))
        assertEquals(listOf(5, 4, 3, 2), qelemPreviewOrder(qelemRangeSlots(slots, bounds), true))
        assertNull(qelemPreviewBounds(ids, 9uL, 8uL))
        assertNull(qelemPreviewBounds(ids, 50uL, 8uL))
    }

    @Test fun steppingIsBoundedAndHandlesEmptyTimelines() {
        assertNull(qelemStepSlot(null, 0, 1))
        assertEquals(0, qelemStepSlot(0, 3, -1))
        assertEquals(1, qelemStepSlot(0, 3, 1))
        assertEquals(2, qelemStepSlot(2, 3, 1))
        assertEquals(2, qelemStepSlot(1, 3, Int.MAX_VALUE))
        assertEquals(0, qelemStepSlot(2, 3, Int.MIN_VALUE))
    }
    @Test fun timecodeUsesDocumentFpsAndNeverGoesNegative() {
        assertEquals("0:00:00", qelemTimelineTime(-1, 12))
        assertEquals("0:01:01", qelemTimelineTime(13, 12))
        assertEquals("1:00:00", qelemTimelineTime(720, 12))
        assertEquals("0:00:00", qelemTimelineTime(0, 0))
    }
    @Test fun rulerMappingUsesVisibleScrolledGeometryAndClamps() {
        val visible = listOf(QelemRulerItem(5, -20, 60), QelemRulerItem(6, 40, 60), QelemRulerItem(7, 100, 60))
        assertEquals(5, qelemRulerSlot(0f, 10, visible))
        assertEquals(5, qelemRulerSlot(39.99f, 10, visible))
        assertEquals(6, qelemRulerSlot(40f, 10, visible))
        assertEquals(7, qelemRulerSlot(500f, 10, visible))
        assertEquals(5, qelemRulerSlot(-400f, 10, visible))
        assertNull(qelemRulerSlot(Float.NaN, 10, visible))
        assertNull(qelemRulerSlot(0f, 0, visible))
        assertNull(qelemRulerSlot(0f, 10, emptyList()))
        assertEquals(6, qelemRulerSlot(42f, 7, visible))
    }
    @Test fun heldSelectionTracksIdentityAcrossReordering() {
        val slotsAfterMove = listOf(0, 1, 1, 1, 2)
        assertEquals(2, qelemHeldOffset(12uL, 12uL, 2, 1, slotsAfterMove))
        assertEquals(1, qelemHeldOffset(12uL, 12uL, 9, 0, listOf(0, 0, 1)))
        assertEquals(0, qelemHeldOffset(13uL, 12uL, 2, 1, slotsAfterMove))
        assertEquals(0, qelemHeldOffset(null, null, 2, 1, slotsAfterMove))
    }
    @Test fun multipleHeldSlotsToggleOneStableFrameId() {
        val a = qelemToggleFrameSelection(emptySet(), 7uL)
        val both = qelemToggleFrameSelection(a, 8uL)
        assertEquals(setOf(7uL, 8uL), both)
        assertEquals(setOf(8uL), qelemToggleFrameSelection(both, 7uL))
        assertEquals(both, qelemToggleFrameSelection(both, null))
    }
    @Test fun timingRespectsPreviewSpeedAndBounce() {
        assertEquals(200L, qelemPreviewDelayMs(10, 50))
        assertEquals(100L, qelemPreviewDelayMs(10, 100))
        assertEquals(50L, qelemPreviewDelayMs(10, 200))
        assertEquals(4, qelemCycleSlots(4, false))
        assertEquals(6, qelemCycleSlots(4, true))
        assertEquals(1, qelemCycleSlots(1, true))
        assertEquals(0, qelemCycleSlots(0, true))
    }
}
