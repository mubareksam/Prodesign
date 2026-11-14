package io.github.artcraftandroid.procraft.canvas

/** Reverse only the preview order, not the document or export sequence. Held slots remain repeated. */
internal fun qelemPreviewOrder(slots: List<Int>, reverse: Boolean): List<Int> =
    if (reverse) slots.asReversed() else slots

/** Map a preview slot back to the unmodified timeline's slot. */
internal fun qelemTimelineSlot(slot: Int, size: Int, reverse: Boolean): Int =
    if (reverse) size - 1 - slot else slot

/** Inclusive endpoints are layer IDs so frame insertion/reordering cannot silently retarget them. */
internal fun qelemPreviewBounds(frames: List<ULong>, first: ULong?, last: ULong?): IntRange? {
    if (first == null || last == null) return null
    val a = frames.indexOf(first)
    val b = frames.indexOf(last)
    return if (a < 0 || b < a) null else a..b
}

/** The timeline slot indices in a preview range, including all slots of held frames. */
internal fun qelemRangeSlots(slots: List<Int>, bounds: IntRange?): List<Int> =
    slots.indices.filter { i -> bounds == null || slots[i] in bounds }

/** A forward or ping-pong preview cycle, using the core's slot-level bounce semantics. */
internal fun qelemCycleSlots(slots: Int, pingPong: Boolean): Int =
    if (slots <= 0) 0 else if (pingPong && slots > 1) (slots.toLong() * 2 - 2).coerceAtMost(Int.MAX_VALUE.toLong()).toInt() else slots

/** Delay for a temporary preview speed; neither project FPS nor exports are changed. */
internal fun qelemPreviewDelayMs(fps: Int, percent: Int): Long {
    val rate = fps.coerceIn(1, 60)
    val speed = if (percent in listOf(50, 100, 200)) percent else 100
    return (100_000L / (rate * speed)).coerceAtLeast(1L)
}

/** Move one timeline slot without wrapping, including held slots. Empty timelines stay empty. */
internal fun qelemStepSlot(current: Int?, count: Int, delta: Int): Int? {
    if (count <= 0) return null
    return ((current ?: 0).toLong() + delta.toLong()).coerceIn(0L, (count - 1).toLong()).toInt()
}
