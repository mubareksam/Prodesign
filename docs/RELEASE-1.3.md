# Qelem 1.3 notes

This retrospective version follows historical commit `06e6d4f7c479abf144710d7f0691ad83bc054a70`. It retains Qelem branding, the Qmer credit, the 1.1 New canvas fix and the three-finger undo/four-finger redo gestures used in the rebranded 1.0–1.2 builds. The original historical version used two fingers for undo and three for redo.

New in 1.3: per-frame holds (1–12 ticks), one to four onion frames in each direction with configurable colours, basic destructive undoable effects on the active cel, and numbered PNG sequence export. GIF and silent MP4 export use frame holds and preview playback order; PNG sequences contain source frames, not timing metadata. MP4 requires compatible WebView encoding and has not been verified on physical Android devices. Effects are not non-destructive or full live previews.

The package and stored project keys retain their original names for compatibility. The APK uses a public test certificate. Back up projects before updates or downgrades. Android normally refuses installing 1.3 over a higher version code, and uninstalling can delete artwork.
