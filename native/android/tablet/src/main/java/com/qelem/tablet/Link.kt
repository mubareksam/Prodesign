package com.qelem.tablet

import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit

/** One explicit pairing. All socket I/O stays off the Android UI thread. */
internal class Link(private val host: String, private val token: String) {
    @Volatile var onState: (Boolean, String?) -> Unit = { _, _ -> }
    @Volatile private var closed = false
    @Volatile private var ready = false
    @Volatile private var socket: Socket? = null
    private val outgoing = ArrayBlockingQueue<String>(1024)

    fun start() {
        Thread({ run() }, "qelem-tablet-link").start()
    }
    fun send(message: String) {
        if (!ready || closed) return
        // Never silently lose a down or up; tear down rather than leave a stroke stuck.
        if (!outgoing.offer(message)) close()
    }
    fun close() {
        closed = true; ready = false
        try { socket?.close() } catch (_: Exception) { }
    }
    private fun run() {
        var message = "Disconnected from PC."
        try {
            val address = InetAddress.getByName(host)
            require(address is Inet4Address && (address.isSiteLocalAddress || address.isLinkLocalAddress)) {
                "Enter a private local-network IPv4 address."
            }
            val s = Socket()
            socket = s
            if (closed) return
            s.connect(InetSocketAddress(address, 48652), 5000)
            s.tcpNoDelay = true
            s.soTimeout = 5000
            val input = s.getInputStream()
            val output = s.getOutputStream()
            output.write("QELEM1 $token\n".toByteArray(Charsets.US_ASCII)); output.flush()
            val reply = StringBuilder()
            while (reply.length < 16) {
                val b = input.read()
                if (b == -1 || b == 10) break
                require(b in 32..126) { "Invalid PC response." }
                reply.append(b.toChar())
            }
            require(reply.toString() == "OK") { "Pairing rejected; check the code." }
            if (closed) return
            ready = true; onState(true, null)
            while (!closed) {
                val command = outgoing.poll(2, TimeUnit.SECONDS) ?: "PING"
                output.write("$command\n".toByteArray(Charsets.US_ASCII))
                output.flush()
            }
        } catch (e: Exception) {
            if (!closed) message = e.message ?: "Could not connect to PC."
        } finally {
            close()
            onState(false, message)
        }
    }
}
