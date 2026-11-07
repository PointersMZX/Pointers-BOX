// Pointers-BOX Android 数据层（v2.6.0）：4 路并发拉取 + .mcx 解密（core）+ 缓存兜底
// 协议见 docs/protocol.md；语义对齐桌面 DataStore.cs。

package cc.pointers.box.app.data

import cc.pointers.box.core.McxCrypto
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object RemoteUrls {
    const val Resources = "https://api.pointers-box.cc.cd/box/resources.mcx"
    const val Announcement = "https://api.pointers-box.cc.cd/box/announcement.mcx"
    const val Box = "https://api.pointers-box.cc.cd/box/box.mcx"
    const val VersionLogs = "https://api.pointers-box.cc.cd/box/boxbbgxrz.mcx"
}

class DataStore(
    private val cacheFile: File,
    private val embeddedBox: File?
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private fun fetchText(url: String, force: Boolean): String {
        val target = if (force) "$url?t=${System.currentTimeMillis()}" else url
        val conn = URL(target).openConnection() as HttpURLConnection
        conn.connectTimeout = 30_000
        conn.readTimeout = 30_000
        try {
            val code = conn.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            return conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    private inline fun <reified T> parseLoose(raw: String): T? =
        json.decodeFromString<T>(McxCrypto.openMuxed(raw))

    /** 4 路并发拉取；全失败走缓存/嵌入兜底（offline=true）。 */
    suspend fun getData(force: Boolean = false): DataSnapshot = coroutineScope {
        val pool = Dispatchers.IO
        val rResources = async(pool) { runCatching { parseLoose<List<Resource>>(fetchText(RemoteUrls.Resources, force)) } }
        val rAnnouncement = async(pool) { runCatching { parseLoose<Announcement>(fetchText(RemoteUrls.Announcement, force)) } }
        val rBox = async(pool) { runCatching { parseLoose<BoxInfo>(fetchText(RemoteUrls.Box, force)) } }
        val rLogs = async(pool) { runCatching { parseLoose<List<VersionLog>>(fetchText(RemoteUrls.VersionLogs, force)) } }

        val warnings = mutableListOf<String>()
        val resources = rResources.await().getOrElse { warnings.add("资源数据获取失败：${it.message}"); null }
        val announcement = rAnnouncement.await().getOrElse { warnings.add("公告获取失败：${it.message}"); null }
        val remoteBox = rBox.await().getOrElse { warnings.add("应用信息获取失败：${it.message}"); null }
        val versionLogs = rLogs.await().getOrElse { warnings.add("版本日志获取失败：${it.message}"); null }

        val offline = resources == null && announcement == null
        var snapshot = DataSnapshot(
            resources = resources,
            announcement = announcement,
            box = mergeBoxInfo(embeddedBoxInfo(), remoteBox),
            versionLogs = versionLogs,
            offline = offline,
            warnings = warnings
        )

        if (!offline) {
            withContext(pool) {
                runCatching {
                    cacheFile.parentFile?.mkdirs()
                    cacheFile.writeText(json.encodeToString(snapshot))
                }
            }
        } else {
            loadCache()?.let { cached ->
                snapshot = cached.copy(offline = true)
            }
        }
        snapshot
    }

    private fun loadCache(): DataSnapshot? = runCatching {
        if (!cacheFile.exists()) return null
        json.decodeFromString<DataSnapshot>(cacheFile.readText())
            .let { it.copy(box = mergeBoxInfo(embeddedBoxInfo(), it.box)) }
    }.getOrNull()

    private fun embeddedBoxInfo(): BoxInfo? = runCatching {
        if (embeddedBox == null || !embeddedBox.exists()) return null
        parseLoose<BoxInfo>(embeddedBox.readText())
    }.getOrNull()

    companion object {
        /** 嵌入为底，远程覆盖（远程字段非空才覆盖）。 */
        fun mergeBoxInfo(embedded: BoxInfo?, remote: BoxInfo?): BoxInfo {
            val base = embedded ?: remote ?: return BoxInfo()
            if (embedded == null || remote == null) return base
            return base.copy(
                appName = remote.appName.ifEmpty { embedded.appName },
                appIntroduction = remote.appIntroduction.ifEmpty { embedded.appIntroduction },
                generalKey = remote.generalKey ?: embedded.generalKey,
                developer = remote.developer.ifEmpty { embedded.developer },
                communityQq = remote.communityQq.ifEmpty { embedded.communityQq },
                copyright = remote.copyright.ifEmpty { embedded.copyright }
            )
        }
    }
}
