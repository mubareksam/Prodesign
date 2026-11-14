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
    private var preparedBluetooth: BluetoothTransport? = null
    private var scanning = false
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
            "Wi-Fi" to { pendingBluetoothToken = null; preparedBluetooth?.close(); preparedBluetooth = null; mode = "WIFI"; ip.isEnabled = true; status.text = "Private Wi-Fi or offline hotspot" },
            "USB" to { pendingBluetoothToken = null; preparedBluetooth?.close(); preparedBluetooth = null; mode = "USB"; ip.setText("127.0.0.1"); ip.isEnabled = false; status.text = "USB: connect cable and set up ADB reverse" },
            "Bluetooth" to { mode = "BT"; ip.isEnabled = false; status.text = "Bluetooth: use the paired phone's outgoing Windows COM port" })
        gap(page)
        ip = field("PC IPv4 · e.g. 192.168.1.2", InputType.TYPE_CLASS_PHONE)
        code = field("32-character pairing code", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS)
        page.addView(ip, LinearLayout.LayoutParams(-1, dp(48))); gap(page)
        page.addView(code, LinearLayout.LayoutParams(-1, dp(48))); gap(page)
        page.addView(button("Prepare Bluetooth service") { prepareBluetooth() }, LinearLayout.LayoutParams(-1, dp(46))); gap(page)
        page.addView(button("Scan QR & connect") { scan() }, LinearLayout.LayoutParams(-1, dp(50))); gap(page)
        page.addView(button("Connect manually") {
            val token = code.text.toString().trim().lowercase(Locale.ROOT)
            if (mode == "BT") {
                if (!token.matches(Regex("[0-9a-f]{32}"))) status.text = "Enter the 32-character Windows pairing code." else connectBluetooth(token)
            } else {
                val host = if (mode == "USB") "127.0.0.1" else ip.text.toString().trim()
                val p = Pairing.parse("QELEMPAIR1|$mode|$host|48652|$token")
                if (p == null) status.text = "Enter a private PC IPv4 and a 32-character code." else connect(Link(p.host, p.token, allowUsbLoopback = p.usb))
            }
        }, LinearLayout.LayoutParams(-1, dp(50))); gap(page)
        page.addView(button("Cancel connection") { pendingBluetoothToken = null; link?.close(); link = null; preparedBluetooth?.close(); preparedBluetooth = null; status.text = "Connection cancelled" }, LinearLayout.LayoutParams(-1, dp(46))); gap(page)
        page.addView(label("USB requires ADB reverse. Bluetooth is experimental and needs a paired phone and Windows outgoing SPP COM port. Wi-Fi and QR codes are not encrypted.").apply { textSize = 13f; setTextColor(Color.LTGRAY); gravity = Gravity.CENTER })
        if (mode != "WIFI") ip.isEnabled = false
    }

    private fun scan() {
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) { status.text = "No camera available. Use manual pairing."; return }
        // The Bluetooth listener must survive the scanner activity and camera permission prompt.
        scanning = true
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) { requestPermissions(arrayOf(Manifest.permission.CAMERA), 20); return }
        try {
            // Explicit capture intent avoids the legacy IntentIntegrator's fragment dependency.
            val intent = Intent(this, CaptureActivity::class.java).setAction(Intents.Scan.ACTION)
            intent.putExtra(Intents.Scan.FORMATS, "QR_CODE"); intent.putExtra(Intents.Scan.PROMPT_MESSAGE, "Scan Qelem's pairing QR")
            intent.putExtra(Intents.Scan.BEEP_ENABLED, false); intent.putExtra(Intents.Scan.ORIENTATION_LOCKED, false)
            startActivityForResult(intent, 21)
        } catch (e: Exception) { scanning = false; status.text = "Scanner unavailable. Use manual pairing. ${e.message ?: ""}" }
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 20) { if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) scan() else { scanning = false; status.text = "Camera permission denied. Use manual pairing." } }
        if (requestCode == 22) { if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) prepareBluetooth() else { pendingBluetoothToken = null; status.text = "Bluetooth permission denied." } }
    }
    @Deprecated("CaptureActivity result")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 21) return
        scanning = false
        if (resultCode != RESULT_OK) { status.text = "Scan cancelled. You can scan again or connect manually."; return }
        val pair = Pairing.parse(data?.getStringExtra(Intents.Scan.RESULT) ?: "")
        if (pair == null) { status.text = "Invalid Qelem pairing QR."; return }
        code.setText(pair.token)
        if (pair.bluetooth) {
            mode = "BT"; ip.isEnabled = false
            if (preparedBluetooth != null) connectBluetooth(pair.token)
            else { pendingBluetoothToken = pair.token; prepareBluetooth() }
        } else {
            preparedBluetooth?.close(); preparedBluetooth = null
            mode = if (pair.usb) "USB" else "WIFI"; ip.setText(pair.host); ip.isEnabled = !pair.usb
            connect(Link(pair.host, pair.token, allowUsbLoopback = pair.usb))
        }
    }
    @SuppressLint("MissingPermission")
    private fun prepareBluetooth() {
        if (mode != "BT") { status.text = "Select Bluetooth first."; return }
        if (Build.VERSION.SDK_INT >= 31) {
            val missing = listOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            if (missing.isNotEmpty()) { requestPermissions(missing.toTypedArray(), 22); return }
        }
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null || !adapter.isEnabled) { pendingBluetoothToken = null; status.text = "Enable Bluetooth on both devices and pair them in system settings first."; return }
        val devices = adapter.bondedDevices.sortedBy { it.name ?: it.address }
        if (devices.isEmpty()) { pendingBluetoothToken = null; status.text = "Pair the Windows PC in Android Bluetooth settings first."; return }
        AlertDialog.Builder(this).setTitle("Choose your paired Windows PC")
            .setItems(devices.map { "${it.name ?: "Device"}  (${it.address})" }.toTypedArray()) { _, index ->
                preparedBluetooth?.close()
                val transport = BluetoothTransport(adapter, devices[index].address)
                preparedBluetooth = transport
                // A prepared but unused listener should not be left open indefinitely.
                ui.postDelayed({
                    if (preparedBluetooth === transport) {
                        preparedBluetooth = null; pendingBluetoothToken = null; transport.close()
                        if (::status.isInitialized) status.text = "Bluetooth preparation expired. Prepare it again."
                    }
                }, 300_000)
                status.text = "Preparing Bluetooth service…"
                Thread {
                    try {
                        transport.prepare()
                        ui.post {
                            if (preparedBluetooth === transport) {
                                val token = pendingBluetoothToken
                                pendingBluetoothToken = null
                                if (token != null) connectBluetooth(token)
                                else status.text = "Bluetooth ready. Configure Windows outgoing COM, start pairing, then scan its QR."
                            }
                        }
                    } catch (e: Exception) {
                        transport.close(); ui.post { if (preparedBluetooth === transport) { preparedBluetooth = null; pendingBluetoothToken = null; status.text = "Bluetooth unavailable: ${e.message ?: "unknown error"}" } }
                    }
                }.start()
            }.setNegativeButton("Cancel") { _, _ -> pendingBluetoothToken = null }.setOnCancelListener { pendingBluetoothToken = null }.show()
    }
    private fun connectBluetooth(token: String) {
        val transport = preparedBluetooth
        if (transport == null) { status.text = "Select Bluetooth, then prepare the service and select your PC first."; return }
        preparedBluetooth = null
        connect(Link("", token, transport = transport))
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
        page.addView(label("Choose Qelem canvas or Windows tablet mode in the PC pairing panel to match your remote. App detection is not automatic.").apply { setTextColor(Color.LTGRAY) }); gap(page, 16)
        page.addView(button("Disconnect") { link = null; connection.close(); pairing("Disconnected") }, LinearLayout.LayoutParams(-1, dp(48)))
    }
    private fun drawing(connection: Link, qelem: Boolean) {
        val page = column()
        row(page, "‹ Remotes" to { connection.send("C"); profiles(connection) }, "Undo" to { connection.send("UNDO") }, "Redo" to { connection.send("REDO") })
        gap(page, 4)
        if (!qelem) { row(page, "Save" to { connection.send("SAVE") }, "Esc" to { connection.send("ESCAPE") }, "Zoom −" to { connection.send("ZOOMOUT") }, "Zoom +" to { connection.send("ZOOMIN") }); gap(page, 4) }
        if (qelem) { row(page, "Brush" to { connection.send("PAINT") }, "Erase" to { connection.send("ERASE") }, "Smudge" to { connection.send("SMUDGE") }, "Pick" to { connection.send("PICK") }); gap(page, 4) }
        var direct = false
        val hint = label("Move: slide to position · double-tap & hold to draw") .apply { textSize = 12f; setTextColor(Color.LTGRAY) }
        val drawToggle = Switch(this).apply { text = "Direct draw"; setTextColor(Color.WHITE); setOnCheckedChangeListener { _, checked -> direct = checked; connection.send("C"); hint.text = if (checked) "Draw: touch to paint · turn off to move" else "Move: slide to position · double-tap & hold to draw" } }
        val onlyPen = Switch(this).apply { text = "Stylus only"; setTextColor(Color.WHITE) }
        val switches = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }; switches.addView(drawToggle, LinearLayout.LayoutParams(0, -2, 1f)); switches.addView(onlyPen, LinearLayout.LayoutParams(0, -2, 1f)); page.addView(switches); page.addView(hint)
        page.addView(Pad(this, connection, { onlyPen.isChecked }, { direct }), LinearLayout.LayoutParams(-1, 0, 1f))
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
    override fun onPause() { super.onPause(); if (!scanning) { preparedBluetooth?.close(); preparedBluetooth = null }; if (link != null) { returnToPairing = true; link?.close(); link = null } }
    override fun onDestroy() { preparedBluetooth?.close(); preparedBluetooth = null; super.onDestroy() }
    override fun onResume() { super.onResume(); if (returnToPairing && ::root.isInitialized) { returnToPairing = false; pairing("Disconnected while away") } }

    private class Pad(activity: Activity, private val link: Link, private val penOnly: () -> Boolean, private val direct: () -> Boolean) : View(activity) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val gesture = PadGesture((48 * resources.displayMetrics.density))
        private var pointer = -1; private var blocked = false; private var stylus = false; private var drawing = false
        override fun performClick(): Boolean { super.performClick(); return true }
        override fun onDraw(canvas: Canvas) { canvas.drawColor(Color.rgb(27, 27, 30)); paint.color = Color.rgb(240, 180, 106); paint.style = Paint.Style.STROKE; paint.strokeWidth = 2f; canvas.drawRect(1f, 1f, width - 1f, height - 1f, paint) }
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
                    if (!blocked) point(if (drawing) "D" else "H", event.x, event.y, event.pressure, if (stylus) " S" else " F")
                }
                MotionEvent.ACTION_POINTER_DOWN -> { if (drawing) link.send("C"); gesture.cancel(); pointer = -1; drawing = false; blocked = true }
                MotionEvent.ACTION_MOVE -> if (!blocked) {
                    val i = event.findPointerIndex(pointer)
                    if (i >= 0) {
                        gesture.move(event.getX(i), event.getY(i))
                        for (h in 0 until event.historySize) point(if (drawing) "M" else "H", event.getHistoricalX(i, h), event.getHistoricalY(i, h), event.getHistoricalPressure(i, h))
                        point(if (drawing) "M" else "H", event.getX(i), event.getY(i), event.getPressure(i))
                    }
                }
                MotionEvent.ACTION_UP -> {
                    val i = event.findPointerIndex(pointer)
                    if (!blocked && i >= 0) { if (drawing) point("U", event.getX(i), event.getY(i), event.getPressure(i)); if (!stylus && !direct()) gesture.up(event.eventTime, event.getX(i), event.getY(i), drawing) }
                    pointer = -1; blocked = false; drawing = false; performClick()
                }
                MotionEvent.ACTION_CANCEL -> { if (drawing) link.send("C"); gesture.cancel(); pointer = -1; blocked = false; drawing = false }
            }
            return true
        }
    }
}
