package io.github.artcraftandroid.procraft.canvas

/** Bounded layout shared by the UI, renderer and dependency-free tests. */
internal data class QelemSheetPlan(
    val frames: Int, val columns: Int, val rows: Int, val tile: Int,
    val label: Int, val width: Int, val height: Int,
) {
    fun cell(index: Int): Pair<Int, Int> = (index % columns * tile) to (index / columns * (tile + label))
}

/** A sheet contains every visible top-level frame once, not expanded held slots. */
internal fun qelemSheetPlan(frames: Int, columns: Int, tile: Int, storyboard: Boolean): QelemSheetPlan? {
    if (frames !in 1..60 || columns !in 1..6 || tile !in listOf(128, 256, 384)) return null
    val label = if (storyboard) 32 else 0
    val rows = (frames + columns - 1) / columns
    val width = columns.toLong() * tile
    val height = rows.toLong() * (tile + label)
    if (width > 4096 || height > 4096 || width * height > 8L * 1024 * 1024) return null
    return QelemSheetPlan(frames, columns, rows, tile, label, width.toInt(), height.toInt())
}
