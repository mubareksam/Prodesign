package com.qelem.tablet

import java.util.ArrayDeque

/** Bounded queue: under pressure coalesce only adjacent absolute motion, never down/up/keys. */
internal class CommandQueue(private val capacity: Int = 1024, private val coalesceAt: Int = 128) {
    private val items = ArrayDeque<String>()
    private val lock = Object()
    private var stopped = false
    private fun motion(s: String) = s.startsWith("M ") || s.startsWith("H ")
    private fun sameMotion(a: String, b: String) = motion(a) && a[0] == b[0]
    fun offer(s: String): Boolean = synchronized(lock) {
        if (stopped) return@synchronized false
        if (items.size >= coalesceAt && items.isNotEmpty() && sameMotion(items.peekLast(), s)) {
            items.removeLast(); items.addLast(s); lock.notifyAll(); return@synchronized true
        }
        if (items.size >= capacity) {
            if (motion(s)) return@synchronized true // a later move or up carries the final position
            val it = items.iterator()
            var removed = false
            while (it.hasNext()) { if (motion(it.next())) { it.remove(); removed = true; break } }
            if (!removed) return@synchronized false // never silently drop down/up/cancel/relative motion
        }
        items.addLast(s); lock.notifyAll(); true
    }
    fun take(timeoutMs: Long): String? = synchronized(lock) {
        if (items.isEmpty() && !stopped) lock.wait(timeoutMs)
        if (items.isEmpty()) null else items.removeFirst()
    }
    fun stop() = synchronized(lock) { stopped = true; items.clear(); lock.notifyAll() }
}
