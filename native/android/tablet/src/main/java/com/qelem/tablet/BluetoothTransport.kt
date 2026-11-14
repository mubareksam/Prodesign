package com.qelem.tablet

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/** Encrypted RFCOMM connection to the PC explicitly selected from the paired devices list. */
@SuppressLint("MissingPermission") // TabletActivity checks BLUETOOTH_CONNECT first
internal class BluetoothTransport(private val pc: BluetoothDevice) : Transport {
    @Volatile private var closed = false
    @Volatile private var socket: BluetoothSocket? = null
    override fun open(): Pair<InputStream, OutputStream> {
        val connection = pc.createRfcommSocketToServiceRecord(UUID.fromString("6db5d3d1-d2a8-4d56-b8c0-87ecb7ea843e"))
        socket = connection
        if (closed) { connection.close(); throw IOException("Closed") }
        connection.connect()
        if (closed) { connection.close(); throw IOException("Closed") }
        return connection.inputStream to connection.outputStream
    }
    override fun close() {
        closed = true
        try { socket?.close() } catch (_: Exception) { }
    }
}
