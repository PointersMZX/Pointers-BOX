// Pointers-BOX .mcx 加密容器（v1）——Kotlin 实现
// 规格见 docs/mcx/mcx-algorithm.md；参考实现 src/shared/mcx.ts。
// JS 位运算是 32 位有符号——用 Long 模拟（乘/加后 and 0xFFFFFFFFL）保证逐位一致。

package cc.pointers.box.core

object McxCrypto {
    private const val VERSION = 1
    private const val SALT_LEN = 16
    private val MAGIC = byteArrayOf(0x4d, 0x43, 0x58) // "MCX"

    // 密钥材料（32 字节 = KEY_A[i] xor KEY_B[i]，2026-10-17 首版；与 TS 实现逐字节一致）
    private val KEY_A = byteArrayOf(
        0x5d.toByte(), 0x97.toByte(), 0xfc.toByte(), 0x2e.toByte(), 0xe7.toByte(), 0xfe.toByte(), 0x17.toByte(), 0x40.toByte(),
        0xba.toByte(), 0xf2.toByte(), 0x03.toByte(), 0x0c.toByte(), 0x8a.toByte(), 0x60.toByte(), 0x44.toByte(), 0x63.toByte(),
        0x54.toByte(), 0xa9.toByte(), 0x9f.toByte(), 0x51.toByte(), 0x11.toByte(), 0xf6.toByte(), 0x8c.toByte(), 0xe7.toByte(),
        0x38.toByte(), 0xec.toByte(), 0x9e.toByte(), 0x72.toByte(), 0x2b.toByte(), 0x54.toByte(), 0x3e.toByte(), 0x0d.toByte()
    )
    private val KEY_B = byteArrayOf(
        0x16.toByte(), 0x25.toByte(), 0x5d.toByte(), 0xa7.toByte(), 0xe1.toByte(), 0x61.toByte(), 0xcf.toByte(), 0x01.toByte(),
        0x21.toByte(), 0x1b.toByte(), 0x2b.toByte(), 0xcb.toByte(), 0x71.toByte(), 0x36.toByte(), 0x63.toByte(), 0xec.toByte(),
        0x52.toByte(), 0x01.toByte(), 0x34.toByte(), 0x3b.toByte(), 0x9b.toByte(), 0x79.toByte(), 0xac.toByte(), 0x31.toByte(),
        0x07.toByte(), 0x69.toByte(), 0xf6.toByte(), 0xb6.toByte(), 0x3e.toByte(), 0xdb.toByte(), 0x18.toByte(), 0x31.toByte()
    )

    private fun keyBytes(): ByteArray = ByteArray(KEY_A.size) { i -> (KEY_A[i].toInt() xor KEY_B[i].toInt()).toByte() }

    private fun imul(x: Long, y: Long): Long = (x * y) and 0xFFFFFFFFL

    // FNV-1a 32 位
    private fun fnv1a(bytes: ByteArray): Long {
        var h = 0x811c9dc5L
        for (b in bytes) {
            h = h xor (b.toLong() and 0xFFL)
            h = imul(h, 0x01000193L)
        }
        return h
    }

    // mulberry32：与 JS 实现逐行对应（Long 模拟 32 位环绕）
    private class Mulberry32(seed: Long) {
        private var a: Long = seed and 0xFFFFFFFFL

        fun next(): Long {
            a = (a + 0x6d2b79f5L) and 0xFFFFFFFFL
            var t = imul(a xor (a ushr 15), 1L or a)
            t = ((imul(t xor (t ushr 7), 61L or t) + t) and 0xFFFFFFFFL) xor t
            return (t xor (t ushr 14)) and 0xFFFFFFFFL
        }
    }

    private fun keystream(seed: Long, length: Int): ByteArray {
        val rng = Mulberry32(seed)
        val outs = ByteArray(length)
        var i = 0
        while (i < length) {
            val w = rng.next()
            if (i < length) outs[i++] = ((w ushr 24) and 0xFFL).toByte()
            if (i < length) outs[i++] = ((w ushr 16) and 0xFFL).toByte()
            if (i < length) outs[i++] = ((w ushr 8) and 0xFFL).toByte()
            if (i < length) outs[i++] = (w and 0xFFL).toByte()
        }
        return outs
    }

    // 宽容解码：忽略所有非 base64 字符；清理后为空或非 4 倍数返回 null
    private fun b64Decode(text: String): ByteArray? {
        val clean = text.filter { it.isLetterOrDigit() || it == '+' || it == '/' || it == '=' }
        if (clean.isEmpty() || clean.length % 4 != 0) return null
        return try {
            java.util.Base64.getDecoder().decode(clean)
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    private fun xorWith(data: ByteArray, seed: Long): ByteArray {
        val ks = keystream(seed, data.size)
        return ByteArray(data.size) { i -> (data[i].toInt() xor ks[i].toInt()).toByte() }
    }

    /** 解密 .mcx → 明文；非 mcx/损坏返回 null。 */
    fun decryptMuxed(raw: String?): String? {
        if (raw == null) return null
        val bytes = b64Decode(raw) ?: return null
        if (bytes.size < MAGIC.size + 1 + SALT_LEN + 1) return null
        for (i in MAGIC.indices) if (bytes[i] != MAGIC[i]) return null
        if (bytes[MAGIC.size] != VERSION.toByte()) return null
        val salt = bytes.copyOfRange(MAGIC.size + 1, MAGIC.size + 1 + SALT_LEN)
        val ct = bytes.copyOfRange(MAGIC.size + 1 + SALT_LEN, bytes.size)
        if (ct.isEmpty()) return null
        val keySalt = keyBytes() + salt
        val pt = xorWith(ct, fnv1a(keySalt))
        return String(pt, Charsets.UTF_8)
    }

    /** 是否为 mcx 加密文件。 */
    fun isMuxed(raw: String?): Boolean = decryptMuxed(raw) != null

    /** 统一读取入口：mcx 解密，非 mcx 原样直通。 */
    fun openMuxed(raw: String): String = decryptMuxed(raw) ?: raw
}
