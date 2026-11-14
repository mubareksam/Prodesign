package com.qelem.tablet

import android.app.Activity
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import java.util.Locale

/** A separate controller: the picture stays on the PC, never on this pad. */
class TabletActivity : Activity() {
    private val ui = Handler(Looper.getMainLooper())
    private var link: Link? = null
    private lateinit var root: LinearLayout
    private val ink = Color.rgb(240, 180, 106)

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        pairing()
    }

    private fun column(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(12, 12, 12, 12)
        setBackgroundColor(Color.rgb(24, 24, 24))
        root = this
        setContentView(this)
    }
    private fun label(text: String) = TextView(this).apply { this.text = text; setTextColor(Color.WHITE); textSize = 15f }
    private fun button(text: String, click: () -> Unit) = Button(this).apply { this.text = text; setOnClickListener { click() } }

    private fun pairing(message: String = "") {
        val page = column()
        page.addView(label("Qelem Tablet · connect to your PC" ).apply { textSize = 22f; setTextColor(ink) })
        page.addView(label("On the PC open an artwork, press F8 and start pairing. Find its IPv4 address with ipconfig. Port 48652. Use trusted Wi-Fi only: traffic is not encrypted."))
        val ip = EditText(this).apply { hint = "PC IPv4 (for example 192.168.1.2)"; setSingleLine(); setTextColor(Color.WHITE); setHintTextColor(Color.LTGRAY); inputType = InputType.TYPE_CLASS_PHONE }
        val code = EditText(this).apply { hint = "32-character pairing code"; setSingleLine(); setTextColor(Color.WHITE); setHintTextColor(Color.LTGRAY); inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS }
        val status = label(message)
        page.addView(ip); page.addView(code); page.addView(status)
        page.addView(button("Connect") {
            val host = ip.text.toString().trim()
            val token = code.text.toString().trim().lowercase(Locale.ROOT)
            if (!host.matches(Regex("[0-9.]{7,15}")) || !token.matches(Regex("[0-9a-f]{32}"))) {
                status.text = "Enter the PC's IPv4 address and the full 32-character code."
            } else {
                status.text = "Connecting…"
                val connection = Link(host, token)
                // Callbacks refer to the link identity, so an old connection cannot replace a new screen.
                connection.onState = { ok, error -> ui.post {
                    if (link === connection) {
                        if (ok) drawing(connection) else { link = null; pairing(error ?: "Disconnected") }
                    }
                } }
                link?.close(); link = connection; connection.start()
            }
        })
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
            }, LinearLayout.LayoutParams(0, -2, 1f))
            page.addView(row)
        }
        slider("Size", "SIZE"); slider("Opacity", "OPACITY")
        page.addView(Pad(this, connection), LinearLayout.LayoutParams(-1, 0, 1f))
        page.addView(label("Blank pad → entire PC artwork. Pen pressure if supported; use one pointer. Look at the PC."))
    }

    override fun onPause() { super.onPause(); link?.close(); link = null }
    override fun onResume() { super.onResume(); if (link == null && ::root.isInitialized) pairing() }

    private class Pad(activity: Activity, private val link: Link) : View(activity) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private var pointer = -1
        private var blocked = false
        private var stylus = false
        override fun performClick(): Boolean { super.performClick(); return true }
        override fun onDraw(canvas: Canvas) {
            canvas.drawColor(Color.rgb(39, 39, 39))
            paint.color = Color.rgb(240, 180, 106); paint.style = Paint.Style.STROKE; paint.strokeWidth = 2f
            canvas.drawRect(1f, 1f, width - 1f, height - 1f, paint)
        }
        private fun send(type: String, x: Float, y: Float, pressure: Float, suffix: String = "") {
            if (width <= 0 || height <= 0) return
            val nx = (x / width).coerceIn(0f, 1f)
            val ny = (y / height).coerceIn(0f, 1f)
            val p = if (stylus) pressure.coerceIn(0f, 1f) else 1f
            link.send(String.format(Locale.ROOT, "%s %.5f %.5f %.4f%s", type, nx, ny, p, suffix))
        }
        override fun onTouchEvent(event: MotionEvent): Boolean {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    blocked = false; pointer = event.getPointerId(0)
                    stylus = event.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS || event.getToolType(0) == MotionEvent.TOOL_TYPE_ERASER
                    send("D", event.x, event.y, event.pressure, if (stylus) " S" else " F")
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
