package io.github.artcraftandroid.procraft.canvas

/** Reverse only the preview order, not the document or export sequence. Held slots remain repeated. */
internal fun qelemPreviewOrder(slots: List<Int>, reverse: Boolean): List<Int> =
    if (reverse) slots.asReversed() else slots

/** Map a preview slot back to the unmodified timeline's slot. */
internal fun qelemTimelineSlot(slot: Int, size: Int, reverse: Boolean): Int =
    if (reverse) size - 1 - slot else slot
