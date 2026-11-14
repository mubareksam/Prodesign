package com.qelem.tablet

import android.app.Activity
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
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
import com.google.zxing.integration.android.IntentIntegrator
import java.util.Locale

/** A separate controller: the picture stays on the PC, never on this pad. */
class TabletActivity : Activity() {
    private val ui = Handler(Looper.getMainLooper())
    private var link: Link? = null
    private var returnToPairing = false
    private var usb = false
    private lateinit var root: LinearLayout
    private lateinit var ip: EditText
    private lateinit var code: EditText
    private lateinit var status: TextView
    private val ink = Color.rgb(240, 180, 106)
    private val dark = Color.rgb(16, 16, 18)
    private val card = Color.rgb(38, 38, 42)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        pairing()
    }
    private fun background(color: Int, radius: Int = 14) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat() }
    private fun column(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(12), dp(16), dp(12)); setBackgroundColor(dark)
        root = this; setContentView(this)
    }
    private fun label(text: String) = TextView(this).apply { this.text = text; setTextColor(Color.WHITE); textSize = 15f }
    private fun button(text: String, click: () -> Unit) = Button(this).apply {
        this.text = text; isAllCaps = false; setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD
        background = background(Color.rgb(171, 79, 16)); setOnClickListener { click() }
    }
    private fun field(hintText: String, input: Int) = EditText(this).apply {
        hint = hintText; setSingleLine(); setTextColor(Color.WHITE); setHintTextColor(Color.LTGRAY); inputType = input
        setPadding(dp(14), dp(8), dp(14), dp(8)); background = background(card, 10)
    }
    private fun addGap(page: LinearLayout, height: Int = 10) { page.addView(View(this), LinearLayout.LayoutParams(1, dp(height))) }

    private fun pairing(message: String = "") {
        val container = column()
        val scroll = ScrollView(this).apply { isFillViewport = true }
        val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; setPadding(dp(4), dp(12), dp(4), dp(12)) }
        container.addView(scroll, LinearLayout.LayoutParams(-1, -1)); scroll.addView(page)
        page.addView(label("Qelem Tablet").apply { textSize = 34f; typeface = Typeface.DEFAULT_BOLD; setTextColor(ink); gravity = Gravity.CENTER })
        addGap(page, 20)
        status = label(message.ifEmpty { "READY TO CONNECT" }).apply { gravity = Gravity.CENTER; background = background(card); setPadding(dp(20), dp(16), dp(20), dp(16)) }
        page.addView(status, LinearLayout.LayoutParams(-1, -2)); addGap(page, 16)
        page.addView(label("Start pairing on Qelem for Windows (F8). Use private Wi-Fi or USB without internet. Wi-Fi traffic and QR codes are not encrypted.").apply { gravity = Gravity.CENTER })
        addGap(page)
        val modes = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val wifi = button("Wi-Fi / hotspot") { usb = false; ip.isEnabled = true; status.text = "Wi-Fi selected · same private network" }
        val cable = button("USB · ADB") { usb = true; ip.setText("127.0.0.1"); ip.isEnabled = false; status.text = "USB selected · enable debugging and run adb reverse" }
        modes.addView(wifi, LinearLayout.LayoutParams(0, dp(48), 1f)); modes.addView(View(this), LinearLayout.LayoutParams(dp(8), 1)); modes.addView(cable, LinearLayout.LayoutParams(0, dp(48), 1f))
        page.addView(modes, LinearLayout.LayoutParams(-1, -2)); addGap(page)
        ip = field("PC IPv4 · e.g. 192.168.1.2", InputType.TYPE_CLASS_PHONE)
        code = field("32-character pairing code", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS)
        page.addView(ip, LinearLayout.LayoutParams(-1, dp(48))); addGap(page, 8)
        page.addView(code, LinearLayout.LayoutParams(-1, dp(48))); addGap(page)
        page.addView(button("Scan QR & connect") {
            IntentIntegrator(this).setDesiredBarcodeFormats(IntentIntegrator.QR_CODE).setPrompt("Scan the QR shown on Qelem for Windows").setBeepEnabled(false).setOrientationLocked(false).initiateScan()
        }, LinearLayout.LayoutParams(-1, dp(52)))
        addGap(page, 8)
        page.addView(button("Connect manually") {
            val host = if (usb) "127.0.0.1" else ip.text.toString().trim()
            val token = code.text.toString().trim().lowercase(Locale.ROOT)
            val p = Pairing.parse("QELEMPAIR1|${if (usb) "USB" else "WIFI"}|$host|48652|$token")
            if (p == null) status.text = "Enter a private PC IPv4 and a 32-character code." else connect(p)
        }, LinearLayout.LayoutParams(-1, dp(52)))
        addGap(page)
        page.addView(label("USB: enable Android USB debugging and run adb reverse tcp:48652 tcp:48652 on the PC. Bluetooth and automatic Wi-Fi Direct are not yet available.").apply { textSize = 13f; setTextColor(Color.LTGRAY); gravity = Gravity.CENTER })
    }

    @Deprecated("Used by ZXing IntentIntegrator")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result == null) { super.onActivityResult(requestCode, resultCode, data); return }
        val raw = result.contents ?: return
        val pairing = Pairing.parse(raw)
        if (pairing == null) { status.text = "Invalid Qelem pairing QR."; return }
        usb = pairing.usb; ip.setText(pairing.host); ip.isEnabled = !usb; code.setText(pairing.token)
        connect(pairing)
    }

    private fun connect(pairing: Pairing) {
        status.text = "Connecting…"
        val connection = Link(pairing.host, pairing.token, allowUsbLoopback = pairing.usb)
        connection.onState = { ok, error -> ui.post {
            if (link === connection) {
                if (ok) drawing(connection) else { link = null; this@TabletActivity.pairing(error ?: "Disconnected") }
            }
        } }
        link?.close(); link = connection; connection.start()
    }

    private fun drawing(connection: Link) {
        val page = column()
        val controls = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        controls.addView(button("Undo") { connection.send("UNDO") })
        controls.addView(button("Redo") { connection.send("REDO") })
        controls.addView(button("Disconnect") { link = null; connection.close(); pairing("Disconnected") })
        page.addView(controls)
        fun slider(title: String, command: String) {
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            row.addView(label(title))
            row.addView(SeekBar(this).apply {
                max = 100; progress = 50
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(bar: SeekBar?, value: Int, fromUser: Boolean) { if (fromUser) connection.send("$command ${value / 100f}") }
                    override fun onStartTrackingTouch(bar: SeekBar?) {}
                    override fun onStopTrackingTouch(bar: SeekBar?) {}
                })
            }, LinearLayout.LayoutParams(0, -2, 1f)); page.addView(row)
        }
        slider("Size", "SIZE"); slider("Opacity", "OPACITY")
        val onlyPen = Switch(this).apply { text = "Stylus only"; setTextColor(Color.WHITE) }
        page.addView(onlyPen)
        page.addView(Pad(this, connection) { onlyPen.isChecked }, LinearLayout.LayoutParams(-1, 0, 1f))
        page.addView(label("Blank pad → PC. Controls apply to Qelem canvas mode; Windows tablet mode uses pen input.").apply { textSize = 12f })
    }
    override fun onPause() { super.onPause(); if (link != null) { returnToPairing = true; link?.close(); link = null } }
    override fun onResume() { super.onResume(); if (returnToPairing && ::root.isInitialized) { returnToPairing = false; pairing("Disconnected while away") } }

    private class Pad(activity: Activity, private val link: Link, private val penOnly: () -> Boolean) : View(activity) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private var pointer = -1; private var blocked = false; private var stylus = false
        override fun performClick(): Boolean { super.performClick(); return true }
        override fun onDraw(canvas: Canvas) {
            canvas.drawColor(Color.rgb(27, 27, 30)); paint.color = Color.rgb(240, 180, 106); paint.style = Paint.Style.STROKE; paint.strokeWidth = 2f
            canvas.drawRect(1f, 1f, width - 1f, height - 1f, paint)
        }
        private fun send(type: String, x: Float, y: Float, pressure: Float, suffix: String = "") {
            if (width <= 0 || height <= 0) return
            val nx = (x / width).coerceIn(0f, 1f); val ny = (y / height).coerceIn(0f, 1f)
            val p = if (stylus) pressure.coerceIn(0f, 1f) else 1f
            link.send(String.format(Locale.ROOT, "%s %.5f %.5f %.4f%s", type, nx, ny, p, suffix))
        }
        override fun onTouchEvent(event: MotionEvent): Boolean {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    stylus = event.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS || event.getToolType(0) == MotionEvent.TOOL_TYPE_ERASER
                    blocked = penOnly() && !stylus; pointer = if (blocked) -1 else event.getPointerId(0)
                    if (!blocked) send("D", event.x, event.y, event.pressure, if (stylus) " S" else " F")
                }
                MotionEvent.ACTION_POINTER_DOWN -> { if (pointer >= 0) link.send("C"); pointer = -1; blocked = true }
                MotionEvent.ACTION_MOVE -> if (!blocked) {
                    val i = event.findPointerIndex(pointer)
                    if (i >= 0) {
                        for (h in 0 until event.historySize) send("M", event.getHistoricalX(i, h), event.getHistoricalY(i, h), event.getHistoricalPressure(i, h))
                        send("M", event.getX(i), event.getY(i), event.getPressure(i))
                    }
                }
                MotionEvent.ACTION_UP -> {
                    val i = event.findPointerIndex(pointer)
                    if (!blocked && i >= 0) send("U", event.getX(i), event.getY(i), event.getPressure(i))
                    pointer = -1; blocked = false; performClick()
                }
                MotionEvent.ACTION_CANCEL -> { if (pointer >= 0) link.send("C"); pointer = -1; blocked = false }
            }
            return true
        }
    }
}
