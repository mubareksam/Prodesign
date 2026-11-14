package io.github.artcraftandroid.procraft.canvas

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class QelemSheetPlanTest {
    @Test fun framesArePlacedInRowsAndColumns() {
        val sheet = requireNotNull(qelemSheetPlan(3, 2, 128, true))
        assertEquals(256, sheet.width)
        assertEquals(320, sheet.height)
        assertEquals(0 to 160, sheet.cell(2))
    }

    @Test fun oversizedOrInvalidSheetsAreRefused() {
        assertNull(qelemSheetPlan(0, 1, 128, false))
        assertNull(qelemSheetPlan(61, 1, 128, false))
        assertNull(qelemSheetPlan(3, 0, 128, false))
        assertNull(qelemSheetPlan(3, 2, 129, false))
        assertNull(qelemSheetPlan(60, 1, 384, true))
        assertNull(qelemSheetPlan(60, 6, 384, true))
    }
}
