package io.github.artcraftandroid.procraft.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.artcraftandroid.procraft.canvas.qelemSheetPlan

/** Options describe the native renderer's limitations before any share is created. */
@Composable
internal fun QelemSheetDialog(storyboard: Boolean, frames: Int, onCancel: () -> Unit, onShare: (Int, Int) -> Unit) {
    var columns by remember(storyboard) { mutableIntStateOf(3) }
    var tile by remember(storyboard) { mutableIntStateOf(256) }
    val plan = qelemSheetPlan(frames, columns, tile, storyboard)
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text(if (storyboard) "Storyboard PNG" else "Sprite sheet PNG") },
        text = {
            Column(Modifier.heightIn(max = 400.dp).verticalScroll(rememberScrollState())) {
                Text("Each visible top-level frame or group is rendered once in timeline order. Hidden frames are excluded; held slots are not repeated. Background/foreground frame overlays and motion are not included.")
                Text(if (storyboard) "Artwork background on a white sheet; each tile is labelled with its frame number and hold." else "Transparent square tiles with unused cells transparent. Artwork is fitted and centred; tiles are not full-resolution exports.", modifier = Modifier.padding(top = 8.dp))
                Text("Columns", modifier = Modifier.padding(top = 12.dp))
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    for (n in 1..6) TextButton(onClick = { columns = n }) { Text(if (columns == n) "[$n]" else "$n") }
                }
                Text("Tile size", modifier = Modifier.padding(top = 6.dp))
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    for (n in listOf(128, 256, 384)) TextButton(onClick = { tile = n }) { Text(if (tile == n) "[$n]" else "$n") }
                }
                Text(plan?.let { "${it.frames} frames · ${it.width} × ${it.height} pixels" }
                    ?: "Choose a smaller sheet. Maximum 60 frames, 4096 pixels per side and 8 megapixels.", modifier = Modifier.padding(top = 10.dp))
                Text("Source canvas limit: 4 megapixels. Large exports can use substantial memory.", modifier = Modifier.padding(top = 8.dp))
            }
        },
        dismissButton = { TextButton(onClick = onCancel) { Text("Cancel") } },
        confirmButton = { TextButton(enabled = plan != null, onClick = { onShare(columns, tile) }) { Text("Share PNG") } },
    )
}
