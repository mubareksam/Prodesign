# Qelem 1.4 notes

This retrospective version follows historical commit `0973550d39e6237d46673f8b331a632a48fe7ea6`. It retains Qelem branding, the Qmer credit, the 1.1 New canvas fix and the three-finger undo/four-finger redo gestures used in the rebranded 1.0–1.3 builds. The original historical version used two fingers for undo and three for redo.

New in 1.4: optional frame group labels saved in projects and displayed on the timeline, plus horizontal motion blur, sharpen, bloom and glitch effects. The labels are tags, not nested frame groups or batch operations; effects are basic destructive pixel edits on the active cel, not non-destructive or live previews, and can be undone.

GIF and silent MP4 export use frame holds and playback order; PNG sequences contain source frames, not timing metadata. MP4 requires compatible WebView encoding. Android gestures, encoding and MediaStore exports have not been verified on physical devices.

The package and stored project keys retain their original names for compatibility. The APK uses a public test certificate. Back up projects before updates or downgrades. Android normally refuses installing 1.4 over a higher version code, and uninstalling can delete artwork.
