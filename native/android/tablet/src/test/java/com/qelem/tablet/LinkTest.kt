package com.qelem.tablet

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.ServerSocket
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class LinkTest {
    @Test fun authenticatedConnectionSendsPointsInOrderAndCloses() {
        ServerSocket(0).use { server ->
            server.soTimeout = 5000
            val lines = ArrayBlockingQueue<String>(4)
            val accepted = CountDownLatch(1)
            val worker = Thread {
                server.accept().use { socket ->
                    socket.soTimeout = 5000
                    val reader = socket.getInputStream().bufferedReader()
                    lines.put(reader.readLine())
                    socket.getOutputStream().write("OK\n".toByteArray())
                    socket.getOutputStream().flush()
                    accepted.countDown()
                    repeat(3) { lines.put(reader.readLine()) }
                }
            }
            worker.start()
            val connection = Link("127.0.0.1", "0123456789abcdef0123456789abcdef", server.localPort, true)
            val connected = CountDownLatch(1)
            connection.onState = { yes, _ -> if (yes) connected.countDown() }
            connection.start()
            assertTrue(accepted.await(5, TimeUnit.SECONDS))
            assertTrue(connected.await(5, TimeUnit.SECONDS))
            connection.send("D 0 0 1 F")
            connection.send("M 0.5 0.5 1")
            connection.send("U 1 1 1")
            assertEquals("QELEM1 0123456789abcdef0123456789abcdef", lines.poll(5, TimeUnit.SECONDS))
            assertEquals("D 0 0 1 F", lines.poll(5, TimeUnit.SECONDS))
            assertEquals("M 0.5 0.5 1", lines.poll(5, TimeUnit.SECONDS))
            assertEquals("U 1 1 1", lines.poll(5, TimeUnit.SECONDS))
            connection.close()
            worker.join(5000)
            assertFalse(worker.isAlive)
        }
    }

    @Test fun publicAddressesAreRejectedWithoutConnecting() {
        val finished = CountDownLatch(1)
        var result = true
        val link = Link("8.8.8.8", "0123456789abcdef0123456789abcdef")
        link.onState = { connected, _ -> result = connected; finished.countDown() }
        link.start()
        assertTrue(finished.await(5, TimeUnit.SECONDS))
        assertFalse(result)
    }
}
