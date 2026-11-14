package com.qelem.tablet

import java.util.Locale

internal data class Pairing(val host: String, val token: String, val usb: Boolean, val bluetooth: Boolean = false) {
    companion object {
        /** Parse only our own fixed-port, private-network, ADB loopback, or explicit Bluetooth QR payloads. */
        fun parse(raw: String): Pairing? {
            if (raw.length > 128) return null
            val parts = raw.split('|')
            if (parts.size != 5 || parts[0] != "QELEMPAIR1" || parts[3] != "48652") return null
            val type = parts[1]
            if (type !in listOf("WIFI", "USB", "BT")) return null
            val usb = type == "USB"
            val bluetooth = type == "BT"
            val host = parts[2]
            when (type) {
                "USB" -> if (host != "127.0.0.1") return null
                "BT" -> if (host != "-") return null
                "WIFI" -> if (!isPrivateIpv4(host)) return null
            }
            val token = parts[4].lowercase(Locale.ROOT)
            if (!token.matches(Regex("[0-9a-f]{32}"))) return null
            return Pairing(host, token, usb, bluetooth)
        }
        fun isPrivateIpv4(host: String): Boolean {
            val parts = host.split('.')
            if (parts.size != 4 || parts.any { it.isEmpty() || it.length > 3 || it.any { c -> c !in '0'..'9' } }) return false
            val n = parts.map { it.toIntOrNull() ?: return false }
            if (n.any { it !in 0..255 }) return false
            return n[0] == 10 || (n[0] == 172 && n[1] in 16..31) || (n[0] == 192 && n[1] == 168) || (n[0] == 169 && n[1] == 254)
        }
    }
}
