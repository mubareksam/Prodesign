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
    println("Qelem preview order: empty, single, holds, reversal, source preservation and slot mapping passed")
}
