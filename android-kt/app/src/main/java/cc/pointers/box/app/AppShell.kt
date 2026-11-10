// Pointers-BOX Android（v2.6.0 全原生）：主导航 + 主页 + 资源库 + 链接 + 浏览器 + 下载 + 设置
// 四主题（紫金黑/自定义/纯黑/纯白）+ 液态玻璃面板 + 资源详情页内切换 + 版本日志折叠
// 首页推荐卡支持「堆叠 / 平铺」两种布局；链接添加走弹窗

package cc.pointers.box.app

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.zIndex
import cc.pointers.box.app.data.AppConfig
import cc.pointers.box.app.data.DataSnapshot
import cc.pointers.box.app.data.DataStore
import cc.pointers.box.app.data.Resource
import cc.pointers.box.app.data.UserLink
import cc.pointers.box.app.data.VersionLog
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

enum class Page { Home, Resources, Links, Browser, Downloads, Settings }

object ConfigStore {
    private val json = Json { ignoreUnknownKeys = true }

    fun load(file: File): AppConfig = runCatching {
        if (file.exists()) json.decodeFromString<AppConfig>(file.readText()) else AppConfig()
    }.getOrDefault(AppConfig())

    fun save(file: File, config: AppConfig) = runCatching {
        file.parentFile?.mkdirs()
        file.writeText(json.encodeToString(config))
    }
}

object LinkStore {
    private val json = Json { ignoreUnknownKeys = true }

    fun load(file: File): List<UserLink> = runCatching {
        if (file.exists()) json.decodeFromString<List<UserLink>>(file.readText()) else emptyList()
    }.getOrDefault(emptyList())

    fun save(file: File, links: List<UserLink>) = runCatching {
        file.parentFile?.mkdirs()
        file.writeText(json.encodeToString(links))
    }
}

/** 下载历史（保留下载历史偏好开启时落盘）。 */
object HistoryStore {
    private val json = Json { ignoreUnknownKeys = true }

    fun load(file: File): List<String> = runCatching {
        if (file.exists()) json.decodeFromString<List<String>>(file.readText()) else emptyList()
    }.getOrDefault(emptyList())

    fun save(file: File, list: List<String>) = runCatching {
        file.parentFile?.mkdirs()
        file.writeText(json.encodeToString(list))
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = DataStore(File(filesDir, "cache/snapshot.json"), File(filesDir, "box.mcx").takeIf { it.exists() })
        val linksFile = File(filesDir, "user-links.json")
        val configFile = File(filesDir, "config.json")

        setContent {
            val initialConfig = ConfigStore.load(configFile)
            val initialPalette = buildPalette(initialConfig.theme, initialConfig.accent, initialConfig.liquidGlass)
            Surface(modifier = Modifier.fillMaxSize(), color = initialPalette.appBg) {
                AppShell(store, linksFile, configFile)
            }
        }
    }
}

@Composable
fun AppShell(store: DataStore, linksFile: File, configFile: File) {
    val ctx = LocalContext.current
    var page by remember { mutableStateOf(Page.Home) }
    var snapshot by remember { mutableStateOf<DataSnapshot?>(null) }
    var config by remember { mutableStateOf(ConfigStore.load(configFile)) }
    var links by remember { mutableStateOf(LinkStore.load(linksFile)) }
    var recommends by remember { mutableStateOf<List<Resource>>(emptyList()) }
    // 资源详情页内切换：null=列表视图，非 null=详情视图
    var detailRes by remember { mutableStateOf<Resource?>(null) }
    // 内置浏览器待打开地址（链接/领取等入口带入）
    var browserTarget by remember { mutableStateOf<String?>(null) }

    val historyFile = remember(configFile) { File(configFile.parentFile, "download-history.json") }
    var downloadHistory by remember { mutableStateOf(HistoryStore.load(historyFile)) }

    fun updateConfig(c: AppConfig) {
        config = c
        ConfigStore.save(configFile, c)
    }

    // 统一打开链接：按「浏览器偏好」走内置浏览器页或系统浏览器
    fun openUrl(url: String) {
        if (url.isBlank()) return
        if (config.androidBrowser == "builtin") {
            browserTarget = url
            detailRes = null
            page = Page.Browser
        } else {
            runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        }
    }

    fun recordDownload(url: String) {
        if (!config.keepDownloadHistory) return
        val updated = (listOf(url) + downloadHistory.filterNot { it == url }).take(50)
        downloadHistory = updated
        HistoryStore.save(historyFile, updated)
    }

    val palette = buildPalette(config.theme, config.accent, config.liquidGlass)

    LaunchedEffect(Unit) {
        val snap = store.getData()
        snapshot = snap
        recommends = pickRecommends(snap.resources.orEmpty(), layoutCount(config.homeLayout))
    }

    Surface(modifier = Modifier.fillMaxSize(), color = palette.appBg) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.weight(1f)) {
                if (palette.glassOn) OrbBackground(Modifier.matchParentSize())
                when (page) {
                    Page.Home -> HomeContent(
                        snapshot = snapshot,
                        recommends = recommends,
                        config = config,
                        palette = palette,
                        onShuffle = { recommends = pickRecommends(snapshot?.resources.orEmpty(), layoutCount(config.homeLayout)) },
                        onOpenDetail = { res -> detailRes = res; page = Page.Resources },
                        onToggleFav = { r -> toggleFav(r, config, ::updateConfig) },
                        onLayoutChange = { key ->
                            updateConfig(config.copy(homeLayout = key))
                            recommends = pickRecommends(snapshot?.resources.orEmpty(), layoutCount(key))
                        },
                        onNavigate = { p -> page = p }
                    )
                    Page.Resources -> {
                        val res = detailRes
                        if (res != null) {
                            ResourceDetail(res, config, palette,
                                onBack = { detailRes = null },
                                onToggleFav = { r -> toggleFav(r, config, ::updateConfig) },
                                onOpenUrl = ::openUrl)
                        } else {
                            ResourcesContent(snapshot, config, palette,
                                onOpenDetail = { res -> detailRes = res },
                                onNavigate = { p -> page = p })
                        }
                    }
                    Page.Links -> LinksContent(linksFile, links, palette,
                        onUpdate = { links = it },
                        onOpenUrl = ::openUrl)
                    Page.Browser -> BrowserContent(browserTarget, palette, onExternal = { u ->
                        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u))) }
                    })
                    Page.Downloads -> DownloadsContent(snapshot, config, downloadHistory, palette, onEnqueued = ::recordDownload)
                    Page.Settings -> SettingsContent(config, snapshot, palette,
                        onUpdate = ::updateConfig,
                        onClearHistory = {
                            downloadHistory = emptyList()
                            HistoryStore.save(historyFile, emptyList())
                        },
                        onOpenUrl = ::openUrl)
                }
            }
            if (detailRes == null || page != Page.Resources) {
                BottomNav(page, palette) { p ->
                    page = p
                    if (p != Page.Resources) detailRes = null
                    if (p != Page.Browser) browserTarget = null
                }
            }
        }
    }
}

private fun layoutCount(layout: String) = if (layout == "stacked") 3 else 4

/** 随机挑推荐（对齐桌面 PickRecommends 语义）。 */
private fun pickRecommends(all: List<Resource>, count: Int): List<Resource> =
    all.shuffled().take(count)

private fun toggleFav(res: Resource, config: AppConfig, update: (AppConfig) -> Unit) {
    val id = res.idText
    val cur = config.favorites.toMutableList()
    if (cur.contains(id)) cur.remove(id) else cur.add(id)
    update(config.copy(favorites = cur))
}

@Composable
fun BottomNav(current: Page, palette: ThemePalette, onSelect: (Page) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp)
            .background(palette.navBg, RoundedCornerShape(24.dp))
            .border(1.dp, Brush.verticalGradient(listOf(palette.navBorderTop, palette.navBorderBottom)), RoundedCornerShape(24.dp))
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        for ((label, p) in listOf("首页" to Page.Home, "资源" to Page.Resources, "链接" to Page.Links, "浏览器" to Page.Browser, "下载" to Page.Downloads, "设置" to Page.Settings)) {
            Text(
                text = label,
                fontSize = 13.sp,
                fontWeight = if (current == p) FontWeight.Bold else FontWeight.Normal,
                color = if (current == p) palette.accent else palette.textSecondary,
                modifier = Modifier
                    .clickable { onSelect(p) }
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
    }
}

// ───────────────────────── 首页 ─────────────────────────

@Composable
fun HomeContent(
    snapshot: DataSnapshot?,
    recommends: List<Resource>,
    config: AppConfig,
    palette: ThemePalette,
    onShuffle: () -> Unit,
    onOpenDetail: (Resource) -> Unit,
    onToggleFav: (Resource) -> Unit,
    onLayoutChange: (String) -> Unit,
    onNavigate: (Page) -> Unit
) {
    val favorites = remember(snapshot, config.favorites) {
        snapshot?.resources.orEmpty().filter { config.favorites.contains(it.idText) }
    }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text("主页", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary) }

        // 今日推荐 + 布局切换（堆叠 / 平铺）+ 换一批
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("今日推荐", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = palette.textSecondary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    for ((label, key) in listOf("堆叠" to "stacked", "平铺" to "flat")) {
                        val selected = config.homeLayout == key
                        Text(
                            text = label, fontSize = 12.sp,
                            color = if (selected) palette.textPrimary else palette.textSecondary,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            modifier = Modifier
                                .background(if (selected) palette.accent else palette.cardBg, RoundedCornerShape(10.dp))
                                .clickable { onLayoutChange(key) }
                                .padding(horizontal = 10.dp, vertical = 5.dp)
                        )
                    }
                    Button(onClick = onShuffle, colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary)) { Text("换一批") }
                }
            }
        }
        if (recommends.isEmpty()) {
            item { Text("加载中…（线路重试中）", fontSize = 13.sp, color = palette.textSecondary) }
        } else if (config.homeLayout == "stacked") {
            item {
                StackedCards(recommends.take(3), palette, config.favorites,
                    onOpen = onOpenDetail, onToggleFav = onToggleFav)
            }
        } else {
            items(recommends.take(4)) { res ->
                RecommendCard(res, palette, config.favorites.contains(res.idText),
                    onOpen = { onOpenDetail(res) }, onToggleFav = { onToggleFav(res) })
            }
        }

        // 公告 + 数据状态
        if (snapshot?.announcement != null) {
            item {
                Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                    Text("公告", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                    Spacer(Modifier.height(8.dp))
                    Text("${snapshot.announcement!!.date}\n${snapshot.announcement!!.content}", fontSize = 13.sp, color = palette.textSecondary)
                }
            }
        }
        item {
            Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                Text("数据状态", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                Spacer(Modifier.height(8.dp))
                val offline = snapshot?.offline ?: false
                Text(if (offline) "离线（展示本地缓存）" else "在线", fontSize = 13.sp,
                    color = if (offline) Color(0xFFd29922) else Color(0xFF7ee787))
                Spacer(Modifier.height(4.dp))
                Text("更新渠道：${if (config.updateChannel == "gitee") "国内镜像（Gitee）" else "全球官方（GitHub）"}",
                    fontSize = 12.sp, color = palette.accent)
            }
        }

        // 版本日志（折叠：收起=1 条摘要，展开=最近 3 条完整）
        val logs = snapshot?.versionLogs.orEmpty()
        if (logs.isNotEmpty()) {
            item { VersionLogsCard(logs, palette) }
        }

        // 我的收藏（横滑）
        if (favorites.isNotEmpty()) {
            item {
                Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                    Text("我的收藏", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                    Spacer(Modifier.height(10.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(favorites.take(8)) { res ->
                            Column(modifier = Modifier
                                .width(190.dp)
                                .glassPanel(palette)
                                .clickable { onOpenDetail(res) }
                                .padding(12.dp)) {
                                Text(res.name, fontWeight = FontWeight.SemiBold, color = palette.textPrimary, maxLines = 1)
                                if (res.introduction.isNotEmpty()) {
                                    Spacer(Modifier.height(4.dp))
                                    Text(res.introduction, fontSize = 12.sp, color = palette.textSecondary, maxLines = 2)
                                }
                            }
                        }
                    }
                }
            }
        }

        // 快捷入口
        item {
            Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                Text("快捷入口", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    for ((label, p) in listOf("资源库" to Page.Resources, "链接" to Page.Links, "浏览器" to Page.Browser, "下载" to Page.Downloads)) {
                        Text(label, fontSize = 13.sp, color = palette.textPrimary,
                            modifier = Modifier
                                .background(palette.cardBg, RoundedCornerShape(12.dp))
                                .clickable { onNavigate(p) }
                                .padding(horizontal = 14.dp, vertical = 8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun RecommendCard(res: Resource, palette: ThemePalette, faved: Boolean, onOpen: () -> Unit, onToggleFav: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().glassPanel(palette).clickable { onOpen() }.padding(20.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Text(res.name, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary, modifier = Modifier.weight(1f))
            Text(if (faved) "★" else "☆", fontSize = 18.sp, color = Color(0xFFd29922),
                modifier = Modifier.clickable { onToggleFav() }.padding(start = 8.dp))
        }
        if (res.introduction.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            Text(res.introduction, fontSize = 13.sp, color = palette.textSecondary)
        }
    }
}

/** 堆叠卡：后面几张只露出底部一条边（错位叠放），最前一张完整可点。 */
@Composable
private fun StackedCards(list: List<Resource>, palette: ThemePalette, favorites: List<String>,
                         onOpen: (Resource) -> Unit, onToggleFav: (Resource) -> Unit) {
    if (list.isEmpty()) return
    val step = 14.dp
    val cardHeight = 148.dp
    Box(modifier = Modifier.fillMaxWidth().height(cardHeight + step * (list.size - 1))) {
        // 从最底层画到最前层（Compose 后绘制在上）
        for (depth in list.size - 1 downTo 0) {
            val res = list[depth]
            Box(modifier = Modifier
                .fillMaxWidth()
                .height(cardHeight)
                .padding(start = (depth * 10).dp, end = (depth * 10).dp, top = (depth * 14).dp)
                .zIndex((list.size - depth).toFloat())) {
                if (depth == 0) {
                    Column(modifier = Modifier
                        .fillMaxSize()
                        .glassPanel(palette)
                        .clickable { onOpen(res) }
                        .padding(20.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                            Text(res.name, fontSize = 18.sp, fontWeight = FontWeight.SemiBold,
                                color = palette.textPrimary, modifier = Modifier.weight(1f), maxLines = 1)
                            Text(if (favorites.contains(res.idText)) "★" else "☆", fontSize = 18.sp, color = Color(0xFFd29922),
                                modifier = Modifier.clickable { onToggleFav(res) }.padding(start = 8.dp))
                        }
                        if (res.introduction.isNotEmpty()) {
                            Spacer(Modifier.height(6.dp))
                            Text(res.introduction, fontSize = 13.sp, color = palette.textSecondary, maxLines = 3)
                        }
                    }
                } else {
                    // 底层卡：只画玻璃面板露出边缘，避免文字透过半透明玻璃与顶层重叠
                    Box(modifier = Modifier.fillMaxSize().glassPanel(palette))
                }
            }
        }
    }
}

@Composable
fun VersionLogsCard(logs: List<VersionLog>, palette: ThemePalette, defaultExpanded: Boolean = false) {
    var expanded by remember { mutableStateOf(defaultExpanded) }
    Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
        Row(modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded },
            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("版本日志", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
            Text(if (expanded) "收起 ▴" else "展开 ▾", fontSize = 12.sp, color = palette.textSecondary)
        }
        Spacer(Modifier.height(8.dp))
        if (expanded) {
            logs.forEach { v ->
                Column(modifier = Modifier.padding(bottom = 10.dp)) {
                    Box(modifier = Modifier.background(palette.accent.copy(alpha = 0.2f), RoundedCornerShape(10.dp)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                        Text(v.version, fontSize = 11.sp, color = palette.accent)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(v.log, fontSize = 12.sp, color = palette.textSecondary)
                }
            }
        } else {
            Text("${logs[0].version}  ${logs[0].log}", fontSize = 12.sp, color = palette.textSecondary, maxLines = 2)
        }
    }
}

// ───────────────────────── 资源库 ─────────────────────────

@Composable
fun ResourcesContent(snapshot: DataSnapshot?, config: AppConfig, palette: ThemePalette,
                     onOpenDetail: (Resource) -> Unit, onNavigate: (Page) -> Unit) {
    val all = snapshot?.resources.orEmpty()
    var keyword by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("全部") }
    val categories = remember(all) {
        (listOf("全部") + all.map { it.category }.filter { it.isNotEmpty() }.distinct().sorted())
    }
    val filtered = all
        .filter { category == "全部" || it.category == category }
        .filter { keyword.isEmpty() || it.name.contains(keyword) || it.introduction.contains(keyword) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("资源", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary)
        Spacer(Modifier.height(10.dp))
        TextField(
            value = keyword, onValueChange = { keyword = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("搜索资源名称/简介", color = palette.textSecondary) },
            colors = TextFieldDefaults.colors(
                focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
            ), singleLine = true
        )
        Spacer(Modifier.height(10.dp))
        // 分类横滑（可拖动，全部可见）
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(categories) { c ->
                Text(
                    text = c, fontSize = 13.sp,
                    color = if (category == c) palette.textPrimary else palette.textSecondary,
                    fontWeight = if (category == c) FontWeight.Bold else FontWeight.Normal,
                    modifier = Modifier
                        .background(if (category == c) palette.accent else palette.cardBg, RoundedCornerShape(12.dp))
                        .clickable { category = c }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        if (filtered.isEmpty() && all.isNotEmpty()) {
            Text("没有匹配的资源", fontSize = 13.sp, color = palette.textSecondary)
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(filtered) { res ->
                Column(modifier = Modifier
                    .fillMaxWidth()
                    .glassPanel(palette)
                    .clickable { onOpenDetail(res) }
                    .padding(18.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(res.name, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                        if (res.category.isNotEmpty()) Text(res.category, fontSize = 12.sp, color = palette.accent)
                    }
                    if (res.introduction.isNotEmpty()) {
                        Spacer(Modifier.height(6.dp))
                        Text(res.introduction, fontSize = 13.sp, color = palette.textSecondary)
                    }
                }
            }
        }
    }
}

@Composable
fun ResourceDetail(res: Resource, config: AppConfig, palette: ThemePalette,
                   onBack: () -> Unit, onToggleFav: (Resource) -> Unit, onOpenUrl: (String) -> Unit) {
    val shares = res.shares.orEmpty()
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(res.name, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary, modifier = Modifier.weight(1f))
            Text("✕ 返回", fontSize = 14.sp, color = palette.textPrimary,
                modifier = Modifier
                    .background(palette.cardBg, RoundedCornerShape(12.dp))
                    .clickable { onBack() }
                    .padding(horizontal = 14.dp, vertical = 8.dp))
        }
        Column(modifier = Modifier.fillMaxWidth().glassPanel(palette).padding(20.dp)) {
            val meta = listOfNotNull(
                res.category.takeIf { it.isNotEmpty() },
                res.releaseDate?.takeIf { it.isNotEmpty() },
                "序号 ${res.idText}".takeIf { res.idText.isNotEmpty() }
            ).joinToString(" · ")
            if (meta.isNotEmpty()) Text(meta, fontSize = 12.sp, color = palette.accent)
            Spacer(Modifier.height(8.dp))
            Text(if (res.introduction.isNotEmpty()) res.introduction else "（暂无介绍）",
                fontSize = 13.sp, color = palette.textSecondary)
        }
        // 分享项（领取=打开链接，不露明文）
        val shareNames = if (shares.isNotEmpty()) shares.map { it.name }
            else res.links.mapIndexed { i, _ -> "分享项 ${i + 1}" }
        if (shareNames.isNotEmpty()) {
            Text("分享项", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                shareNames.forEachIndexed { i, name ->
                    Row(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(name, fontSize = 13.sp, color = palette.textPrimary, modifier = Modifier.weight(1f), maxLines = 1)
                        Button(onClick = {
                            val url = if (shares.isNotEmpty() && i < shares.size) shares[i].url
                                else res.links.getOrNull(i)
                            if (!url.isNullOrBlank()) onOpenUrl(url)
                        }, colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary)) { Text("领取") }
                    }
                }
            }
        }
        val faved = config.favorites.contains(res.idText)
        Button(onClick = { onToggleFav(res) },
            colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary),
            modifier = Modifier.fillMaxWidth()) {
            Text(if (faved) "★ 已收藏" else "☆ 收藏")
        }
    }
}

// ───────────────────────── 链接 ─────────────────────────

@Composable
fun LinksContent(linksFile: File, links: List<UserLink>, palette: ThemePalette,
                 onUpdate: (List<UserLink>) -> Unit, onOpenUrl: (String) -> Unit) {
    var showAdd by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("链接", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary)
            Button(onClick = { showAdd = true }) { Text("+ 添加") }
        }
        Spacer(Modifier.height(12.dp))
        if (links.isEmpty()) {
            Text("还没有链接，点右上「+ 添加」新建一条", fontSize = 13.sp, color = palette.textSecondary)
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(links) { link ->
                Row(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true)
                    .clickable { onOpenUrl(link.url) }
                    .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(link.name, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                        Text(link.url, fontSize = 12.sp, color = palette.accent, maxLines = 1)
                        if (link.remark.isNotBlank()) Text(link.remark, fontSize = 12.sp, color = palette.textSecondary, maxLines = 1)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("打开", color = palette.accent, fontSize = 13.sp,
                            modifier = Modifier.clickable { onOpenUrl(link.url) }.padding(8.dp))
                        Text("删除", color = Color(0xFFFF7b72), fontSize = 13.sp,
                            modifier = Modifier.clickable {
                                val updated = links.filterNot { it.id == link.id }
                                LinkStore.save(linksFile, updated)
                                onUpdate(updated)
                            }.padding(8.dp))
                    }
                }
            }
        }
    }

    if (showAdd) {
        AddLinkDialog(palette,
            onDismiss = { showAdd = false },
            onAdd = { name, url, remark ->
                val updated = listOf(UserLink(
                    id = java.util.UUID.randomUUID().toString().replace("-", ""),
                    name = name, url = url, remark = remark,
                    createdAt = System.currentTimeMillis()
                )) + links
                LinkStore.save(linksFile, updated)
                onUpdate(updated)
                showAdd = false
            })
    }
}

/** 添加链接弹窗：名称/网址（自动补 https://，不强制手写协议）/备注；校验失败就地提示。 */
@Composable
private fun AddLinkDialog(palette: ThemePalette, onDismiss: () -> Unit, onAdd: (String, String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    var remark by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.cardBgAlt,
        title = { Text("添加链接", color = palette.textPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                TextField(value = name, onValueChange = { name = it; error = "" },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("名称，例如 官方网站", color = palette.textSecondary) },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                        focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                    ), singleLine = true)
                Spacer(Modifier.height(8.dp))
                TextField(value = url, onValueChange = { url = it; error = "" },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("网址，例如 pointers-box.cc.cd（自动补 https://）", color = palette.textSecondary) },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                        focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                    ), singleLine = true)
                Spacer(Modifier.height(8.dp))
                TextField(value = remark, onValueChange = { remark = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("备注（可选）", color = palette.textSecondary) },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                        focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                    ), singleLine = true)
                if (error.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(error, fontSize = 12.sp, color = Color(0xFFFF7b72))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val n = name.trim()
                val u = url.trim()
                when {
                    n.isEmpty() -> error = "请填写名称"
                    u.isEmpty() -> error = "请填写网址"
                    else -> onAdd(n, normalizeHttp(u), remark.trim())
                }
            }) { Text("添加", color = palette.accent) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("取消", color = palette.textSecondary) }
        }
    )
}

// ───────────────────────── 浏览器 ─────────────────────────

private fun normalizeHttp(raw: String): String {
    var u = raw.trim()
    if (u.isEmpty()) return u
    if (!u.contains("://")) u = "https://" + u
    return u
}

@Composable
fun BrowserContent(initialUrl: String?, palette: ThemePalette, onExternal: (String) -> Unit) {
    var url by remember { mutableStateOf(initialUrl.orEmpty()) }
    var target by remember { mutableStateOf<String?>(initialUrl?.takeIf { it.isNotBlank() }) }
    LaunchedEffect(initialUrl) {
        if (!initialUrl.isNullOrBlank()) {
            val u = normalizeHttp(initialUrl)
            url = u
            target = u
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("浏览器", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary)
        Spacer(Modifier.height(10.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextField(
                value = url, onValueChange = { url = it }, modifier = Modifier.weight(1f),
                placeholder = { Text("https://…", color = palette.textSecondary) },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                    focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                ), singleLine = true
            )
            Button(onClick = { if (url.isNotBlank()) target = normalizeHttp(url) }) { Text("打开") }
        }
        if (target != null) {
            Spacer(Modifier.height(10.dp))
            key(target) {
                AndroidView(
                    factory = { c ->
                        WebView(c).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                    val scheme = request.url?.scheme
                                    if (scheme == "http" || scheme == "https") {
                                        view.loadUrl(request.url.toString())
                                        return false
                                    }
                                    return true // 其它 scheme 交系统
                                }
                            }
                            loadUrl(target!!)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().weight(1f).background(palette.cardBg, RoundedCornerShape(18.dp))
                )
            }
            Spacer(Modifier.height(8.dp))
            Button(onClick = { target?.let(onExternal) },
                colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary),
                modifier = Modifier.fillMaxWidth()) {
                Text("用外部浏览器打开")
            }
        } else {
            Spacer(Modifier.height(12.dp))
            Text("输入网址后点「打开」，或从资源详情/链接页进入会自动加载", fontSize = 13.sp, color = palette.textSecondary)
        }
    }
}

// ───────────────────────── 下载 ─────────────────────────

@Composable
fun DownloadsContent(snapshot: DataSnapshot?, config: AppConfig, history: List<String>, palette: ThemePalette,
                     onEnqueued: (String) -> Unit) {
    val ctx = LocalContext.current
    var url by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    val quickLinks = remember(snapshot) {
        snapshot?.resources.orEmpty().flatMap { res -> res.links.map { l -> res.name to l } }
    }

    fun enqueue(u: String) {
        val real = normalizeHttp(u)
        val ok = runCatching {
            val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val file = real.substringAfterLast('/').substringBefore('?').ifEmpty { "download" }
            dm.enqueue(DownloadManager.Request(Uri.parse(real)).setTitle(file))
        }.isSuccess
        message = if (ok) "已加入下载队列：$real" else "下载失败：链接无法识别"
        if (ok) onEnqueued(real)
        url = ""
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("下载", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary)
        Spacer(Modifier.height(10.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextField(
                value = url, onValueChange = { url = it }, modifier = Modifier.weight(1f),
                placeholder = { Text("粘贴下载链接（.mcx 等直链）", color = palette.textSecondary) },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                    focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                ), singleLine = true
            )
            Button(onClick = { if (url.isNotBlank()) enqueue(url) }) { Text("下载") }
        }
        if (message.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Text(message, fontSize = 12.sp, color = palette.textSecondary)
        }
        Spacer(Modifier.height(10.dp))
        Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(18.dp)) {
            Text(if (config.keepDownloadHistory) "下载历史" else "本次会话", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
            Spacer(Modifier.height(6.dp))
            if (history.isEmpty()) Text("暂无任务", fontSize = 12.sp, color = palette.textSecondary)
            else history.take(20).forEach { Text(it, fontSize = 12.sp, color = palette.textPrimary, maxLines = 1) }
            Spacer(Modifier.height(6.dp))
            Text(
                if (config.keepDownloadHistory) "文件保存到系统「下载」目录，完成后有通知"
                else "未开启「保留下载历史」，切换页面后记录不保留",
                fontSize = 12.sp, color = palette.textSecondary
            )
        }
        if (quickLinks.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text("从资源链接下载", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
            Spacer(Modifier.height(8.dp))
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(quickLinks) { (resName, linkUrl) ->
                    Row(modifier = Modifier.fillMaxWidth().glassPanel(palette).padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(resName, fontSize = 13.sp, color = palette.textPrimary, maxLines = 1)
                            Text(linkUrl, fontSize = 12.sp, color = palette.accent, maxLines = 1)
                        }
                        Button(onClick = { enqueue(linkUrl) }) { Text("下载") }
                    }
                }
            }
        }
    }
}

// ───────────────────────── 设置 ─────────────────────────

private const val APP_VERSION = "3.0.0-Beta.1"

data class UpdateState(val checking: Boolean = false, val message: String = "", val releaseUrl: String? = null)

private fun isNewerVersion(latest: String, current: String): Boolean {
    fun parts(v: String) = v.trim().trimStart('v', 'V').takeWhile { it.isDigit() || it == '.' }
        .split('.').mapNotNull { it.toIntOrNull() }
    val l = parts(latest)
    val c = parts(current)
    for (i in 0 until maxOf(l.size, c.size)) {
        val a = l.getOrElse(i) { 0 }
        val b = c.getOrElse(i) { 0 }
        if (a != b) return a > b
    }
    return false
}

private suspend fun checkUpdate(channel: String): UpdateState = withContext(Dispatchers.IO) {
    val isGitee = channel == "gitee"
    val api = if (isGitee) "https://gitee.com/api/v5/repos/PointersMZX/Pointers-BOX/releases/latest"
    else "https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/latest"
    runCatching {
        val conn = URL(api).openConnection() as HttpURLConnection
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.setRequestProperty("User-Agent", "Pointers-BOX/$APP_VERSION")
        try {
            when (val code = conn.responseCode) {
                403 -> return@withContext UpdateState(message = "接口访问受限（限流），请稍后再试")
                404 -> return@withContext UpdateState(message = "未找到任何发布版本")
                !in 200..299 -> return@withContext UpdateState(message = "检查失败：HTTP $code")
            }
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            val root = Json.parseToJsonElement(text).jsonObject
            val tag = root["tag_name"]?.jsonPrimitive?.contentOrNull
                ?: return@withContext UpdateState(message = "发布数据缺少版本号")
            val page = root["html_url"]?.jsonPrimitive?.contentOrNull
                ?: if (isGitee) "https://gitee.com/PointersMZX/Pointers-BOX/releases"
                else "https://github.com/PointersMZX/Pointers-BOX/releases"
            if (isNewerVersion(tag, APP_VERSION))
                UpdateState(message = "发现新版本 $tag（当前 v$APP_VERSION）", releaseUrl = page)
            else UpdateState(message = "已是最新版本（v$APP_VERSION）", releaseUrl = page)
        } finally {
            conn.disconnect()
        }
    }.getOrElse { UpdateState(message = "检查失败：${it.message}") }
}

@Composable
fun SettingsContent(config: AppConfig, snapshot: DataSnapshot?, palette: ThemePalette,
                    onUpdate: (AppConfig) -> Unit, onClearHistory: () -> Unit, onOpenUrl: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var updateState by remember { mutableStateOf(UpdateState()) }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text("设置", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary) }

        // 关于应用（置顶）
        item {
            Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                Text("关于应用", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                Spacer(Modifier.height(6.dp))
                val box = snapshot?.box
                Text(box?.appName?.takeIf { it.isNotEmpty() } ?: "Pointers-BOX", color = palette.textSecondary)
                Text("v$APP_VERSION", fontSize = 12.sp, color = palette.textSecondary)
                if (!box?.appIntroduction.isNullOrBlank()) Text(box!!.appIntroduction, fontSize = 12.sp, color = palette.textSecondary)
                if (!box?.generalKey.isNullOrBlank()) Text("通用密钥：${box!!.generalKey}", fontSize = 12.sp, color = palette.textSecondary)
                if (!box?.communityQq.isNullOrBlank()) Text("社区 QQ 群：${box!!.communityQq}", fontSize = 12.sp, color = palette.textSecondary)
                Text(box?.copyright?.takeIf { it.isNotEmpty() } ?: "Copyright © 2026 Pointers-BOX All Rights Reserved",
                    fontSize = 12.sp, color = palette.textSecondary)
            }
        }

        // 版本日志（完整列表，默认收起，避免把小屏设置项挤到最下面）
        val logs = snapshot?.versionLogs.orEmpty()
        if (logs.isNotEmpty()) {
            item { VersionLogsCard(logs, palette, defaultExpanded = false) }
        }

        // 主题外观
        item {
            Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                Text("主题外观", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                Spacer(Modifier.height(4.dp))
                Text("默认「紫金黑」（液态玻璃锁死开启），「自定义」支持自选颜色与玻璃开关，「纯黑 / 纯白」玻璃默认关闭",
                    fontSize = 12.sp, color = palette.textSecondary)
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((label, key) in listOf("紫金黑" to "zijin", "自定义" to "custom", "纯黑" to "black", "纯白" to "white")) {
                        val selected = config.theme == key
                        Text(
                            text = label, fontSize = 13.sp,
                            color = if (selected) palette.textPrimary else palette.textSecondary,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            modifier = Modifier
                                .background(if (selected) palette.accent else palette.cardBg, RoundedCornerShape(12.dp))
                                .clickable {
                                    val glass = when (key) {
                                        "zijin" -> true
                                        "black", "white" -> false
                                        else -> config.liquidGlass
                                    }
                                    onUpdate(config.copy(theme = key, liquidGlass = glass))
                                }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("液态玻璃", fontSize = 13.sp, color = palette.textPrimary)
                    Spacer(Modifier.width(6.dp))
                    Switch(
                        checked = config.liquidGlass,
                        onCheckedChange = { onUpdate(config.copy(liquidGlass = it)) },
                        enabled = config.theme != "zijin",
                        colors = SwitchDefaults.colors(checkedTrackColor = palette.accent)
                    )
                    Text(
                        if (config.theme == "zijin") "（紫金黑主题玻璃锁死开启，不可关闭）" else "（切换开关可开关液态玻璃质感）",
                        fontSize = 11.sp, color = palette.textSecondary, modifier = Modifier.padding(start = 6.dp)
                    )
                }
                // 主题颜色（仅自定义主题）：预设色圆点 + 色值输入（合法即生效，无需确定按钮）
                if (config.theme == "custom") {
                    Spacer(Modifier.height(12.dp))
                    Text("主题颜色", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        for (preset in ACCENT_PRESETS) {
                            Box(modifier = Modifier
                                .size(26.dp)
                                .background(Color(android.graphics.Color.parseColor(preset)), CircleShape)
                                .border(2.dp,
                                    if (normalizeAccent(config.accent).equals(preset, ignoreCase = true)) palette.textPrimary else Color.Transparent,
                                    CircleShape)
                                .clickable { onUpdate(config.copy(accent = preset)) })
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    var hex by remember(config.accent) { mutableStateOf(config.accent) }
                    TextField(
                        value = hex, onValueChange = { v ->
                            hex = v
                            val t = v.trim()
                            if (Regex("^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$").matches(t)) onUpdate(config.copy(accent = t))
                        },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("自定义色值，输入 #RRGGBB 即时生效", color = palette.textSecondary) },
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                            focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                        ), singleLine = true
                    )
                }
            }
        }

        // 更新检查（渠道 + 检查更新 + 打开发布页）
        item {
            Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                Text("更新检查", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = config.updateChannel == "gitee", onClick = { onUpdate(config.copy(updateChannel = "gitee")) })
                    Text("国内镜像（Gitee）", color = palette.textPrimary, modifier = Modifier.clickable { onUpdate(config.copy(updateChannel = "gitee")) })
                    Spacer(Modifier.width(6.dp))
                    RadioButton(selected = config.updateChannel == "github", onClick = { onUpdate(config.copy(updateChannel = "github")) })
                    Text("全球官方（GitHub）", color = palette.textPrimary, modifier = Modifier.clickable { onUpdate(config.copy(updateChannel = "github")) })
                }
                Spacer(Modifier.height(6.dp))
                Text("国内网络建议选 Gitee；检测到新版本后请到发布页下载对应安装包", fontSize = 12.sp, color = palette.textSecondary)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = {
                        if (updateState.checking) return@Button
                        updateState = UpdateState(checking = true, message = "检查中…")
                        scope.launch { updateState = checkUpdate(config.updateChannel) }
                    }) { Text(if (updateState.checking) "检查中…" else "检查更新") }
                    if (updateState.message.isNotEmpty() && !updateState.checking)
                        Text(updateState.message, fontSize = 12.sp, color = palette.textSecondary, modifier = Modifier.weight(1f))
                }
                updateState.releaseUrl?.let { url ->
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { onOpenUrl(url) },
                        colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary)) {
                        Text("打开发布页")
                    }
                }
            }
        }

        // 浏览器偏好（链接/领取走内置浏览器还是系统浏览器）
        item {
            Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                Text("浏览器偏好", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                Spacer(Modifier.height(6.dp))
                Text("影响资源「领取」与链接页点击的打开方式", fontSize = 12.sp, color = palette.textSecondary)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = config.androidBrowser != "external", onClick = { onUpdate(config.copy(androidBrowser = "builtin")) })
                    Text("内置浏览器", color = palette.textPrimary, modifier = Modifier.clickable { onUpdate(config.copy(androidBrowser = "builtin")) })
                    Spacer(Modifier.width(6.dp))
                    RadioButton(selected = config.androidBrowser == "external", onClick = { onUpdate(config.copy(androidBrowser = "external")) })
                    Text("系统浏览器", color = palette.textPrimary, modifier = Modifier.clickable { onUpdate(config.copy(androidBrowser = "external")) })
                }
            }
        }

        // 下载设置
        item {
            Column(modifier = Modifier.fillMaxWidth().glassPanel(palette, alt = true).padding(20.dp)) {
                Text("下载设置", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("保留下载历史", fontSize = 13.sp, color = palette.textPrimary)
                    Spacer(Modifier.width(10.dp))
                    Switch(
                        checked = config.keepDownloadHistory,
                        onCheckedChange = { on ->
                            onUpdate(config.copy(keepDownloadHistory = on))
                            if (!on) onClearHistory()
                        },
                        colors = SwitchDefaults.colors(checkedTrackColor = palette.accent)
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text("关闭后下载记录仅在本次会话内可见", fontSize = 11.sp, color = palette.textSecondary)
            }
        }
    }
}
