package com.qelem.tablet

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import com.google.zxing.client.android.Intents
import com.journeyapps.barcodescanner.CaptureActivity
import java.util.Locale

/** Native controller; the picture stays on the PC. */
class TabletActivity : Activity() {
    private val ui = Handler(Looper.getMainLooper())
    private var link: Link? = null
    private var returnToPairing = false
    private var pendingBluetoothToken: String? = null
    private var mode = "WIFI"
    private lateinit var root: LinearLayout
    private lateinit var ip: EditText
    private lateinit var code: EditText
    private lateinit var status: TextView
    private val ink = Color.rgb(240, 180, 106)
    private val dark = Color.rgb(16, 16, 18)
    private val card = Color.rgb(38, 38, 42)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onCreate(state: Bundle?) { super.onCreate(state); window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); pairing() }
    private fun background(color: Int, radius: Int = 14) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat() }
    private fun column(): LinearLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), dp(8), dp(12), dp(8)); setBackgroundColor(dark); root = this; setContentView(this) }
    private fun label(text: String) = TextView(this).apply { this.text = text; setTextColor(Color.WHITE); textSize = 15f }
    private fun button(text: String, click: () -> Unit) = Button(this).apply { this.text = text; isAllCaps = false; setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD; background = background(Color.rgb(148, 68, 16)); setOnClickListener { click() } }
    private fun field(hintText: String, input: Int) = EditText(this).apply { hint = hintText; setSingleLine(); setTextColor(Color.WHITE); setHintTextColor(Color.LTGRAY); inputType = input; setPadding(dp(14), dp(8), dp(14), dp(8)); background = background(card, 10) }
    private fun gap(page: LinearLayout, height: Int = 8) { page.addView(View(this), LinearLayout.LayoutParams(1, dp(height))) }
    private fun row(parent: LinearLayout, vararg buttons: Pair<String, () -> Unit>) {
        val layout = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        buttons.forEachIndexed { i, (title, action) -> if (i > 0) layout.addView(View(this), LinearLayout.LayoutParams(dp(4), 1)); layout.addView(button(title, action), LinearLayout.LayoutParams(0, dp(46), 1f)) }
        parent.addView(layout, LinearLayout.LayoutParams(-1, -2))
    }

    private fun pairing(message: String = "") {
        val container = column(); val scroll = ScrollView(this).apply { isFillViewport = true }
        val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; setPadding(dp(4), dp(10), dp(4), dp(10)) }
        container.addView(scroll, LinearLayout.LayoutParams(-1, -1)); scroll.addView(page)
        page.addView(label("Qelem Tablet").apply { textSize = 32f; typeface = Typeface.DEFAULT_BOLD; setTextColor(ink); gravity = Gravity.CENTER }); gap(page, 14)
        status = label(message.ifEmpty { "READY TO CONNECT" }).apply { gravity = Gravity.CENTER; background = background(card); setPadding(dp(16), dp(14), dp(16), dp(14)) }
        page.addView(status, LinearLayout.LayoutParams(-1, -2)); gap(page)
        page.addView(label("On Windows, open Qelem and press F8. Choose a connection and start pairing.").apply { gravity = Gravity.CENTER }); gap(page)
        row(page,
            "Wi-Fi" to { pendingBluetoothToken = null; mode = "WIFI"; ip.isEnabled = true; status.text = "Private Wi-Fi or offline hotspot" },
            "USB" to { pendingBluetoothToken = null; mode = "USB"; ip.setText("127.0.0.1"); ip.isEnabled = false; status.text = "USB: connect cable and set up ADB reverse" },
            "Bluetooth" to { mode = "BT"; ip.isEnabled = false; status.text = "Bluetooth: pair your PC first, then scan its QR" })
        gap(page)
        ip = field("PC IPv4 · e.g. 192.168.1.2", InputType.TYPE_CLASS_PHONE)
        code = field("32-character pairing code", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS)
        page.addView(ip, LinearLayout.LayoutParams(-1, dp(48))); gap(page)
        page.addView(code, LinearLayout.LayoutParams(-1, dp(48))); gap(page)
        page.addView(button("Scan QR & connect") { scan() }, LinearLayout.LayoutParams(-1, dp(50))); gap(page)
        page.addView(button("Connect manually") {
            val token = code.text.toString().trim().lowercase(Locale.ROOT)
            if (mode == "BT") {
                if (!token.matches(Regex("[0-9a-f]{32}"))) status.text = "Enter the 32-character Windows pairing code." else { pendingBluetoothToken = token; chooseBluetoothPc() }
            } else {
                val host = if (mode == "USB") "127.0.0.1" else ip.text.toString().trim()
                val p = Pairing.parse("QELEMPAIR1|$mode|$host|48652|$token")
                if (p == null) status.text = "Enter a private PC IPv4 and a 32-character code." else connect(Link(p.host, p.token, allowUsbLoopback = p.usb))
            }
        }, LinearLayout.LayoutParams(-1, dp(50))); gap(page)
        page.addView(button("Cancel connection") { pendingBluetoothToken = null; link?.close(); link = null; status.text = "Connection cancelled" }, LinearLayout.LayoutParams(-1, dp(46))); gap(page)
        page.addView(label("USB requires ADB reverse. Bluetooth is experimental; pair Android and Windows in system settings first. Wi-Fi and QR codes are not encrypted.").apply { textSize = 13f; setTextColor(Color.LTGRAY); gravity = Gravity.CENTER })
        if (mode != "WIFI") ip.isEnabled = false
    }

    private fun scan() {
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) { status.text = "No camera available. Use manual pairing."; return }
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) { requestPermissions(arrayOf(Manifest.permission.CAMERA), 20); return }
        try {
            // Explicit capture intent avoids the legacy IntentIntegrator's fragment dependency.
            val intent = Intent(this, CaptureActivity::class.java).setAction(Intents.Scan.ACTION)
            intent.putExtra(Intents.Scan.FORMATS, "QR_CODE"); intent.putExtra(Intents.Scan.PROMPT_MESSAGE, "Scan Qelem's pairing QR")
            intent.putExtra(Intents.Scan.BEEP_ENABLED, false); intent.putExtra(Intents.Scan.ORIENTATION_LOCKED, false)
            startActivityForResult(intent, 21)
        } catch (e: Exception) { status.text = "Scanner unavailable. Use manual pairing. ${e.message ?: ""}" }
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 20) { if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) scan() else { status.text = "Camera permission denied. Use manual pairing." } }
        if (requestCode == 22) { if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) chooseBluetoothPc() else { pendingBluetoothToken = null; status.text = "Bluetooth permission denied." } }
    }
    @Deprecated("CaptureActivity result")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 21) return
        if (resultCode != RESULT_OK) { status.text = "Scan cancelled. You can scan again or connect manually."; return }
        val pair = Pairing.parse(data?.getStringExtra(Intents.Scan.RESULT) ?: "")
        if (pair == null) { status.text = "Invalid Qelem pairing QR."; return }
        code.setText(pair.token)
        if (pair.bluetooth) {
            mode = "BT"; ip.isEnabled = false
            pendingBluetoothToken = pair.token; chooseBluetoothPc()
        } else {
            mode = if (pair.usb) "USB" else "WIFI"; ip.setText(pair.host); ip.isEnabled = !pair.usb
            connect(Link(pair.host, pair.token, allowUsbLoopback = pair.usb))
        }
    }
    @SuppressLint("MissingPermission")
    private fun chooseBluetoothPc() {
        if (Build.VERSION.SDK_INT >= 31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), 22); return
        }
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null || !adapter.isEnabled) { pendingBluetoothToken = null; status.text = "Enable Bluetooth on both devices and pair them in system settings first."; return }
        val devices = adapter.bondedDevices.sortedBy { it.name ?: it.address }
        if (devices.isEmpty()) { pendingBluetoothToken = null; status.text = "Pair the Windows PC in Android Bluetooth settings first."; return }
        AlertDialog.Builder(this).setTitle("Choose your paired Windows PC")
            .setItems(devices.map { "${it.name ?: "Device"}  (${it.address})" }.toTypedArray()) { _, index ->
                val token = pendingBluetoothToken
                pendingBluetoothToken = null
                if (token != null) connect(Link("", token, transport = BluetoothTransport(devices[index])))
            }.setNegativeButton("Cancel") { _, _ -> pendingBluetoothToken = null }.setOnCancelListener { pendingBluetoothToken = null }.show()
    }
    private fun connect(connection: Link) {
        status.text = if (mode == "BT") "Waiting for PC over Bluetooth…" else "Connecting…"
        connection.onState = { ok, error -> ui.post { if (link === connection) { if (ok) profiles(connection) else { link = null; pairing(error ?: "Disconnected") } } } }
        link?.close(); link = connection; connection.start()
    }
    private fun profiles(connection: Link) {
        val page = column(); page.addView(label("Connected · choose a remote").apply { textSize = 24f; typeface = Typeface.DEFAULT_BOLD; setTextColor(ink) }); gap(page, 16)
        page.addView(button("Qelem  ›  Drawing pad & tools") { drawing(connection, true) }, LinearLayout.LayoutParams(-1, dp(60))); gap(page)
        page.addView(button("Windows  ›  General pen pad") { drawing(connection, false) }, LinearLayout.LayoutParams(-1, dp(60))); gap(page)
        page.addView(label("Use Qelem remote with Qelem's F8 canvas mode; use Windows remote with the standalone server or F8 Windows mode. App detection is not automatic.").apply { setTextColor(Color.LTGRAY) }); gap(page, 16)
        page.addView(button("Disconnect") { link = null; connection.close(); pairing("Disconnected") }, LinearLayout.LayoutParams(-1, dp(48)))
    }
    private fun drawing(connection: Link, qelem: Boolean, mouse: Boolean = false) {
        val page = column()
        fun tools(vararg items: Triple<String, String, () -> Unit>) {
            val line = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            items.forEach { (icon, description, action) ->
                val control = button(icon, action).apply { contentDescription = description; textSize = 20f; minHeight = 0; minimumHeight = 0; setPadding(0, 0, 0, 0) }
                line.addView(control, LinearLayout.LayoutParams(0, dp(42), 1f).apply { setMargins(dp(2), 0, dp(2), 0) })
            }
            page.addView(line); gap(page, 3)
        }
        tools(Triple("‹", "Back to remotes", { connection.send("C"); profiles(connection) }), Triple("↶", "Undo", { connection.send("UNDO") }), Triple("↷", "Redo", { connection.send(if (qelem) "QELEM_REDO" else "REDO") }), Triple("▣", "Tablet mode", { if (mouse) { connection.send("C"); drawing(connection, qelem, false) } }), Triple("↖", "Mouse mode", { if (!mouse) { connection.send("C"); drawing(connection, qelem, true) } }))
        if (qelem) tools(Triple("✎", "Brush", { connection.send("PAINT") }), Triple("▱", "Eraser", { connection.send("ERASE") }), Triple("◉", "Smudge", { connection.send("SMUDGE") }), Triple("⌖", "Pick color", { connection.send("PICK") }))
        else tools(Triple("▣", "Save", { connection.send("SAVE") }), Triple("⎋", "Escape", { connection.send("ESCAPE") }), Triple("−", "Zoom out", { connection.send("ZOOMOUT") }), Triple("+", "Zoom in", { connection.send("ZOOMIN") }))
        if (mouse) {
            page.addView(label("Mouse: slide to move from the current cursor position; tap to click.").apply { textSize = 13f; setTextColor(Color.LTGRAY) })
            page.addView(MousePad(this, connection), LinearLayout.LayoutParams(-1, 0, 1f))
            row(page, "Left click" to { connection.send("LEFT") }, "Right click" to { connection.send("RIGHT") })
            return
        }
        var direct = false
        val hint = label("Move: slide to position · double-tap & hold to draw") .apply { textSize = 12f; setTextColor(Color.LTGRAY) }
        val drawToggle = Switch(this).apply { text = "Direct draw"; setTextColor(Color.WHITE); setOnCheckedChangeListener { _, checked -> direct = checked; connection.send("C"); hint.text = if (checked) "Draw: touch to paint · turn off to move" else "Move: slide to position · double-tap & hold to draw" } }
        val onlyPen = Switch(this).apply { text = "Stylus only"; setTextColor(Color.WHITE) }
        val switches = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }; switches.addView(drawToggle, LinearLayout.LayoutParams(0, -2, 1f)); switches.addView(onlyPen, LinearLayout.LayoutParams(0, -2, 1f)); page.addView(switches); page.addView(hint)
        val pad = Pad(this, connection, { onlyPen.isChecked }, { direct })
        page.addView(pad, LinearLayout.LayoutParams(-1, 0, 1f))
        page.addView(label("Faint marks are local guides, not the PC screen. Tap to clear.").apply { textSize = 11f; setTextColor(Color.LTGRAY); setOnClickListener { pad.clearTrace() } })
        if (qelem) {
            fun slider(title: String, command: String) {
                val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }; bar.addView(label(title))
                bar.addView(SeekBar(this).apply { max = 100; progress = 50; setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(view: SeekBar?, value: Int, fromUser: Boolean) { if (fromUser) connection.send("$command ${value / 100f}") }
                    override fun onStartTrackingTouch(view: SeekBar?) {}; override fun onStopTrackingTouch(view: SeekBar?) {}
                }) }, LinearLayout.LayoutParams(0, dp(40), 1f)); page.addView(bar)
            }
            slider("Size", "SIZE"); slider("Opacity", "OPACITY")
        }
    }
    override fun onPause() { super.onPause(); if (link != null) { returnToPairing = true; link?.close(); link = null } }
    override fun onDestroy() { super.onDestroy() }
    override fun onResume() { super.onResume(); if (returnToPairing && ::root.isInitialized) { returnToPairing = false; pairing("Disconnected while away") } }

    private class MousePad(activity: Activity, private val link: Link) : View(activity) {
        private val motion = RelativeMotion(10f * resources.displayMetrics.density)
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private var pointer = -1; private var blocked = false
        override fun performClick(): Boolean { super.performClick(); return true }
        override fun onDraw(canvas: Canvas) { canvas.drawColor(Color.rgb(27, 27, 30)); paint.color = Color.rgb(240, 180, 106); paint.style = Paint.Style.STROKE; paint.strokeWidth = 2f; canvas.drawRect(1f, 1f, width - 1f, height - 1f, paint) }
        override fun onTouchEvent(event: MotionEvent): Boolean {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { pointer = event.getPointerId(0); blocked = false; motion.down(event.x, event.y) }
                MotionEvent.ACTION_POINTER_DOWN -> { blocked = true; pointer = -1 }
                MotionEvent.ACTION_MOVE -> if (!blocked) {
                    val i = event.findPointerIndex(pointer)
                    if (i >= 0) motion.move(event.getX(i), event.getY(i), width, height)?.let { (dx,dy) ->
                        if (dx != 0f || dy != 0f) link.send(String.format(Locale.ROOT, "R %.5f %.5f", dx, dy))
                    }
                }
                MotionEvent.ACTION_UP -> { if (!blocked && pointer >= 0 && motion.isTap()) link.send("LEFT"); pointer = -1; blocked = false; performClick() }
                MotionEvent.ACTION_CANCEL -> { pointer = -1; blocked = true }
            }
            return true
        }
    }

    private class Pad(activity: Activity, private val link: Link, private val penOnly: () -> Boolean, private val direct: () -> Boolean) : View(activity) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val trace = Path()
        private var tracePoints = 0
        fun clearTrace() { trace.reset(); tracePoints = 0; invalidate() }
        private fun tracePoint(x: Float, y: Float, first: Boolean = false) {
            if (first || tracePoints >= 3000) { if (tracePoints >= 3000) clearTrace(); trace.moveTo(x, y) } else trace.lineTo(x, y)
            tracePoints++; invalidate()
        }
        private val gesture = PadGesture((48 * resources.displayMetrics.density))
        private var pointer = -1; private var blocked = false; private var stylus = false; private var drawing = false
        override fun performClick(): Boolean { super.performClick(); return true }
        override fun onDraw(canvas: Canvas) {
            canvas.drawColor(Color.rgb(27, 27, 30)); paint.style = Paint.Style.STROKE; paint.strokeWidth = 2f * resources.displayMetrics.density
            paint.color = Color.argb(75, 240, 180, 106); paint.strokeCap = Paint.Cap.ROUND; canvas.drawPath(trace, paint)
            paint.color = Color.rgb(240, 180, 106); paint.strokeWidth = 2f; canvas.drawRect(1f, 1f, width - 1f, height - 1f, paint)
        }
        private fun point(type: String, x: Float, y: Float, pressure: Float, suffix: String = "") {
            if (width <= 0 || height <= 0) return
            val nx = (x / width).coerceIn(0f, 1f); val ny = (y / height).coerceIn(0f, 1f)
            if (type == "H") link.send(String.format(Locale.ROOT, "H %.5f %.5f", nx, ny))
            else link.send(String.format(Locale.ROOT, "%s %.5f %.5f %.4f%s", type, nx, ny, if (stylus) pressure.coerceIn(0f, 1f) else 1f, suffix))
        }
        override fun onHoverEvent(event: MotionEvent): Boolean {
            if (event.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS && event.actionMasked == MotionEvent.ACTION_HOVER_MOVE) { point("H", event.x, event.y, 0f); return true }
            return super.onHoverEvent(event)
        }
        override fun onTouchEvent(event: MotionEvent): Boolean {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    stylus = event.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS || event.getToolType(0) == MotionEvent.TOOL_TYPE_ERASER
                    blocked = penOnly() && !stylus; pointer = if (blocked) -1 else event.getPointerId(0)
                    if (blocked || stylus || direct()) gesture.cancel()
                    drawing = !blocked && (stylus || direct() || gesture.down(event.eventTime, event.x, event.y))
                    if (drawing) tracePoint(event.x, event.y, true)
                    if (!blocked) point(if (drawing) "D" else "H", event.x, event.y, event.pressure, if (stylus) " S" else " F")
                }
                MotionEvent.ACTION_POINTER_DOWN -> { if (drawing) link.send("C"); gesture.cancel(); pointer = -1; drawing = false; blocked = true }
                MotionEvent.ACTION_MOVE -> if (!blocked) {
                    val i = event.findPointerIndex(pointer)
                    if (i >= 0) {
                        gesture.move(event.getX(i), event.getY(i))
                        for (h in 0 until event.historySize) {
                            if (drawing) tracePoint(event.getHistoricalX(i, h), event.getHistoricalY(i, h))
                            point(if (drawing) "M" else "H", event.getHistoricalX(i, h), event.getHistoricalY(i, h), event.getHistoricalPressure(i, h))
                        }
                        if (drawing) tracePoint(event.getX(i), event.getY(i))
                        point(if (drawing) "M" else "H", event.getX(i), event.getY(i), event.getPressure(i))
                    }
                }
                MotionEvent.ACTION_UP -> {
                    val i = event.findPointerIndex(pointer)
                    if (!blocked && i >= 0) { if (drawing) { tracePoint(event.getX(i), event.getY(i)); point("U", event.getX(i), event.getY(i), event.getPressure(i)) }; if (!stylus && !direct()) gesture.up(event.eventTime, event.getX(i), event.getY(i), drawing) }
                    pointer = -1; blocked = false; drawing = false; performClick()
                }
                MotionEvent.ACTION_CANCEL -> { if (drawing) link.send("C"); gesture.cancel(); pointer = -1; blocked = false; drawing = false }
            }
            return true
        }
    }
}
