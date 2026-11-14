package com.qelem.tablet

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/** Secure Bluetooth Classic RFCOMM SPP. The PC connects using an outgoing COM port. */
@SuppressLint("MissingPermission") // permission is requested by TabletActivity before constructing this
internal class BluetoothTransport(private val adapter: BluetoothAdapter, private val trustedAddress: String) : Transport {
    @Volatile private var closed = false
    @Volatile private var listener: BluetoothServerSocket? = null
    @Volatile private var socket: BluetoothSocket? = null
    override fun open(): Pair<InputStream, OutputStream> {
        val server = adapter.listenUsingRfcommWithServiceRecord("Qelem Tablet", UUID.fromString("00001101-0000-1000-8000-00805f9b34fb"))
        listener = server
        if (closed) { server.close(); throw IOException("Closed") }
        var connection: BluetoothSocket
        while (true) {
            connection = server.accept()
            if (closed) { connection.close(); throw IOException("Closed") }
            if (connection.remoteDevice.address == trustedAddress) break
            connection.close()
        }
        socket = connection
        server.close(); listener = null
        if (closed) { connection.close(); throw IOException("Closed") }
        return connection.inputStream to connection.outputStream
    }
    override fun close() {
        closed = true
        try { listener?.close() } catch (_: Exception) { }
        try { socket?.close() } catch (_: Exception) { }
    }
}
