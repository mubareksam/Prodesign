package com.qelem.tablet

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PairingTest {
    private val token = "0123456789abcdef0123456789abcdef"
    @Test fun wifiAndUsbPayloads() {
        assertEquals(Pairing("192.168.1.2", token, false), Pairing.parse("QELEMPAIR1|WIFI|192.168.1.2|48652|$token"))
        assertEquals(Pairing("127.0.0.1", token, true), Pairing.parse("QELEMPAIR1|USB|127.0.0.1|48652|$token"))
    }
    @Test fun rejectsUnexpectedTargetsAndMalformedData() {
        for (s in listOf(
            "QELEMPAIR1|WIFI|8.8.8.8|48652|$token", "QELEMPAIR1|WIFI|127.0.0.1|48652|$token",
            "QELEMPAIR1|USB|192.168.1.2|48652|$token", "QELEMPAIR1|WIFI|192.168.1.2|80|$token",
            "QELEMPAIR1|WIFI|192.168.999.2|48652|$token", "QELEMPAIR1|WIFI|192.168.1.2|48652|$token|extra",
            "QELEMPAIR1|WIFI|192.168.1.2|48652|wrong", "${"A".repeat(200)}",
        )) assertNull(s, Pairing.parse(s))
    }
}
