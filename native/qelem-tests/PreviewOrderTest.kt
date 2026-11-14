package io.github.artcraftandroid.procraft.canvas

/** Dependency-free regression for the helper used by the Android animation preview. */
fun main() {
    val source = listOf(0, 0, 1, 2, 2, 2)
    check(qelemPreviewOrder(source, false) == source)
    check(qelemPreviewOrder(source, true) == listOf(2, 2, 2, 1, 0, 0))
    check(source == listOf(0, 0, 1, 2, 2, 2))
    check(qelemPreviewOrder(emptyList(), true).isEmpty())
    check(qelemPreviewOrder(listOf(5), true) == listOf(5))
    for (i in source.indices) {
        check(qelemTimelineSlot(i, source.size, false) == i)
        check(qelemTimelineSlot(i, source.size, true) == source.lastIndex - i)
        check(qelemPreviewOrder(source, true)[i] == source[qelemTimelineSlot(i, source.size, true)])
    }
    val ids = listOf(10uL, 20uL, 30uL)
    val middle = qelemPreviewBounds(ids, 20uL, 30uL)
    check(middle == 1..2)
    check(qelemRangeSlots(source, middle) == listOf(2, 3, 4, 5))
    check(qelemPreviewOrder(qelemRangeSlots(source, middle), true) == listOf(5, 4, 3, 2))
    check(qelemRangeSlots(source, qelemPreviewBounds(ids, 20uL, 20uL)) == listOf(2))
    check(qelemPreviewBounds(ids, 30uL, 20uL) == null)
    check(qelemPreviewBounds(ids, 99uL, 20uL) == null)
    check(qelemPreviewBounds(listOf(30uL, 10uL, 20uL), 20uL, 30uL) == null)
    check(qelemRangeSlots(source, null) == source.indices.toList())
    check(qelemCycleSlots(0, true) == 0 && qelemCycleSlots(1, true) == 1)
    check(qelemCycleSlots(4, false) == 4 && qelemCycleSlots(4, true) == 6)
    check(qelemPreviewDelayMs(10, 50) == 200L && qelemPreviewDelayMs(10, 100) == 100L)
    check(qelemPreviewDelayMs(10, 200) == 50L && qelemPreviewDelayMs(60, 200) == 8L)
    check(qelemPreviewDelayMs(0, 999) == 1000L)
    println("Qelem preview: reversal, held slots, ID-based range, speed and cycle timing passed")
}
