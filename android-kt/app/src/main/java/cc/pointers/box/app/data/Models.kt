// Pointers-BOX Android 数据模型（对齐 docs/protocol.md；与桌面 Models.cs 字段一致）

package cc.pointers.box.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive

@Serializable
data class ShareItem(val name: String = "", val url: String = "")

@Serializable
data class Resource(
    // number | string 混合动态类型——用 JsonPrimitive 收（取值 .content）
    val id: JsonPrimitive? = null,
    val name: String = "",
    val introduction: String = "",
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("last_modified") val lastModified: String? = null,
    val category: String = "",
    val links: List<String> = emptyList(),
    val shares: List<ShareItem>? = null
) {
    val idText: String get() = id?.content ?: ""
}

@Serializable
data class Announcement(val date: String = "", val content: String = "")

@Serializable
data class VersionLog(val version: String = "", val log: String = "")

@Serializable
data class BoxInfo(
    @SerialName("app_name") val appName: String = "",
    @SerialName("app_introduction") val appIntroduction: String = "",
    @SerialName("general_key") val generalKey: String? = null,
    val developer: String = "",
    @SerialName("community_qq") val communityQq: String = "",
    val copyright: String = ""
)

/** 4 路拉取快照：任一路失败以 null 占位（UI 对应卡降级）。 */
@Serializable
data class DataSnapshot(
    val resources: List<Resource>? = null,
    val announcement: Announcement? = null,
    val box: BoxInfo? = null,
    val versionLogs: List<VersionLog>? = null,
    val offline: Boolean = false,
    val warnings: List<String> = emptyList()
)
