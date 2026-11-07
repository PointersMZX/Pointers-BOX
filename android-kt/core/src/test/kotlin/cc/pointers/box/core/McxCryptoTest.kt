// .mcx 三语言测试向量互验（Kotlin 侧）
// 向量：docs/mcx/vectors/<name>/{plain.txt, cipher.txt}（目录结构，零 JSON 解析）
package cc.pointers.box.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class McxCryptoTest {
    private val vectorsDir = File("../../docs/mcx/vectors")

    private fun loadCases(): List<String> {
        val index = File(vectorsDir, "names.txt")
        assertTrue(index.exists(), "未找到向量索引 ../../docs/mcx/vectors/names.txt（相对 core 模块根）")
        return index.readLines().map { it.trim() }.filter { it.isNotEmpty() }
    }

    @Test
    fun decryptMatchesPlain() {
        val cases = loadCases()
        assertTrue(cases.isNotEmpty(), "测试向量列表为空")
        for (name in cases) {
            val plain = File(vectorsDir, "$name/plain.txt").readText(Charsets.UTF_8)
            val cipher = File(vectorsDir, "$name/cipher.txt").readText(Charsets.UTF_8)
            val out = McxCrypto.decryptMuxed(cipher)
            assertNotNull(out, "$name 解密返回 null")
            assertEquals(plain, out, "$name 明文不一致")
        }
    }

    @Test
    fun plainPassthroughAndIsMuxed() {
        // 非 mcx 内容原样直通；明文不应判为 mcx
        val plain = """{ "plain": true }"""
        assertEquals(plain, McxCrypto.openMuxed(plain))
        assertTrue(!McxCrypto.isMuxed(plain))
    }

    @Test
    fun corruptReturnsNull() {
        // 魔数破坏/长度不足/空密文 → null（宽容失败）
        assertTrue(McxCrypto.decryptMuxed("") == null)
        assertTrue(McxCrypto.decryptMuxed("not-base64!!") == null)
        assertTrue(McxCrypto.decryptMuxed("AAAA") == null)
    }
}
