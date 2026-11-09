// Pointers-BOX Android（v2.6.0 全原生）：主导航 + 主页完整 + 资源库 + 链接 + 浏览器 + 下载 + 设置
// 四主题（紫金黑/自定义/纯黑/纯白）+ 资源详情页内切换 + 版本日志折叠

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import cc.pointers.box.app.data.AppConfig
import cc.pointers.box.app.data.DataSnapshot
import cc.pointers.box.app.data.DataStore
import cc.pointers.box.app.data.Resource
import cc.pointers.box.app.data.UserLink
import java.io.File
import kotlinx.serialization.encodeToString

enum class Page { Home, Resources, Links, Browser, Downloads, Settings }

object ConfigStore {
    private val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    fun load(file: File): AppConfig = runCatching {
        if (file.exists()) json.decodeFromString<AppConfig>(file.readText()) else AppConfig()
    }.getOrDefault(AppConfig())

    fun save(file: File, config: AppConfig) = runCatching {
        file.parentFile?.mkdirs()
        file.writeText(json.encodeToString(config))
    }
}

object LinkStore {
    private val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    fun load(file: File): List<UserLink> = runCatching {
        if (file.exists()) json.decodeFromString<List<UserLink>>(file.readText()) else emptyList()
    }.getOrDefault(emptyList())

    fun save(file: File, links: List<UserLink>) = runCatching {
        file.parentFile?.mkdirs()
        file.writeText(json.encodeToString(links))
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
    var page by remember { mutableStateOf(Page.Home) }
    var snapshot by remember { mutableStateOf<DataSnapshot?>(null) }
    var config by remember { mutableStateOf(ConfigStore.load(configFile)) }
    var links by remember { mutableStateOf(LinkStore.load(linksFile)) }
    var recommends by remember { mutableStateOf<List<Resource>>(emptyList()) }
    // 资源详情页内切换：null=列表视图，非 null=详情视图
    var detailRes by remember { mutableStateOf<Resource?>(null) }

    fun updateConfig(c: AppConfig) {
        config = c
        ConfigStore.save(configFile, c)
    }

    val palette = buildPalette(config.theme, config.accent, config.liquidGlass)

    LaunchedEffect(Unit) {
        val snap = store.getData()
        snapshot = snap
        recommends = snap.resources.orEmpty().shuffled().take(4)
    }

    Surface(modifier = Modifier.fillMaxSize(), color = palette.appBg) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.weight(1f)) {
                if (palette.glassOn) OrbBackground(Modifier.matchParentSize())
                when (page) {
                Page.Home -> HomeContent(snapshot, recommends, palette,
                    onShuffle = { recommends = snapshot?.resources.orEmpty().shuffled().take(4) },
                    onOpenDetail = { res -> detailRes = res; page = Page.Resources })
                Page.Resources -> {
                    val res = detailRes
                    if (res != null) {
                        ResourceDetail(res, config, palette, onBack = { detailRes = null },
                            onToggleFav = { r -> toggleFav(r, config, ::updateConfig) })
                    } else {
                        ResourcesContent(snapshot, palette,
                            onOpenDetail = { res -> detailRes = res })
                    }
                }
                Page.Links -> LinksContent(linksFile, links, palette) { links = it }
                Page.Browser -> BrowserContent(snapshot, palette)
                Page.Downloads -> DownloadsContent(snapshot, palette)
                Page.Settings -> SettingsContent(config, snapshot, palette, ::updateConfig)
                }
            }
            if (detailRes == null || page != Page.Resources) {
                BottomNav(page, palette) { page = it; if (it != Page.Resources) detailRes = null }
            }
        }
    }
}

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

@Composable
fun HomeContent(
    snapshot: DataSnapshot?,
    recommends: List<Resource>,
    palette: ThemePalette,
    onShuffle: () -> Unit,
    onOpenDetail: (Resource) -> Unit
) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text("主页", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary) }
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("今日推荐", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = palette.textSecondary)
                Button(onClick = onShuffle, colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary)) { Text("换一批") }
            }
        }
        if (recommends.isEmpty()) {
            item { Text("加载中…（线路重试中）", fontSize = 13.sp, color = palette.textSecondary) }
        }
        items(recommends) { res ->
            Box(modifier = Modifier
                .fillMaxWidth()
                .background(palette.cardBg, RoundedCornerShape(18.dp))
                .clickable { onOpenDetail(res) }
                .padding(20.dp)) {
                Column {
                    Text(res.name, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                    if (res.introduction.isNotEmpty()) {
                        Spacer(Modifier.height(6.dp))
                        Text(res.introduction, fontSize = 13.sp, color = palette.textSecondary)
                    }
                }
            }
        }
        snapshot?.announcement?.let { ann ->
            item {
                Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                    Column {
                        Text("公告", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                        Spacer(Modifier.height(8.dp))
                        Text("${ann.date}\n${ann.content}", fontSize = 13.sp, color = palette.textSecondary)
                    }
                }
            }
        }
        item {
            Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                Column {
                    Text("数据状态", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                    Spacer(Modifier.height(8.dp))
                    val offline = snapshot?.offline ?: false
                    Text(if (offline) "离线（展示本地缓存）" else "在线", fontSize = 13.sp,
                        color = if (offline) Color(0xFFd29922) else Color(0xFF7ee787))
                }
            }
        }
        // 版本日志（可折叠：默认收起=1 条摘要，展开=最近 3 条完整）
        val logs = snapshot?.versionLogs.orEmpty()
        if (logs.isNotEmpty()) {
            item {
                var expanded by remember { mutableStateOf(false) }
                Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                    Column {
                        Row(modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded },
                            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("版本日志", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                            Text(if (expanded) "收起 ▴" else "展开 ▾", fontSize = 12.sp, color = palette.textSecondary)
                        }
                        Spacer(Modifier.height(8.dp))
                        if (expanded) {
                            logs.take(3).forEach { v ->
                                Row(modifier = Modifier.padding(bottom = 6.dp)) {
                                    Box(modifier = Modifier.background(palette.accent.copy(alpha = 0.2f), RoundedCornerShape(10.dp)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                                        Text(v.version, fontSize = 11.sp, color = palette.accent)
                                    }
                                    Spacer(Modifier.padding(4.dp))
                                    Text(v.log, fontSize = 12.sp, color = palette.textSecondary, modifier = Modifier.weight(1f))
                                }
                            }
                        } else {
                            Text("${logs[0].version}  ${logs[0].log}", fontSize = 12.sp,
                                color = palette.textSecondary, maxLines = 2)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ResourcesContent(snapshot: DataSnapshot?, palette: ThemePalette, onOpenDetail: (Resource) -> Unit) {
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
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (c in categories) {
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
                // 点卡切页内详情（不弹窗）
                Box(modifier = Modifier
                    .fillMaxWidth()
                    .background(palette.cardBg, RoundedCornerShape(18.dp))
                    .clickable { onOpenDetail(res) }
                    .padding(18.dp)) {
                    Column {
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
}

@Composable
fun ResourceDetail(res: Resource, config: AppConfig, palette: ThemePalette, onBack: () -> Unit, onToggleFav: (Resource) -> Unit) {
    val ctx = LocalContext.current
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
        Box(modifier = Modifier.fillMaxWidth().background(palette.cardBg, RoundedCornerShape(18.dp)).padding(20.dp)) {
            Column {
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
        }
        // 分享项（领取=打开链接，不露明文）
        val shareNames = if (shares.isNotEmpty()) shares.map { it.name }
            else res.links.mapIndexed { i, _ -> "分享项 ${i + 1}" }
        if (shareNames.isNotEmpty()) {
            Text("分享项", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                shareNames.forEachIndexed { i, name ->
                    Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 8.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(name, fontSize = 13.sp, color = palette.textPrimary, modifier = Modifier.weight(1f), maxLines = 1)
                            Button(onClick = {
                                val url = if (shares.isNotEmpty() && i < shares.size) shares[i].url
                                    else res.links.getOrNull(i)
                                if (!url.isNullOrBlank()) runCatching {
                                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                }
                            }, colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary)) { Text("领取") }
                        }
                    }
                }
            }
        }
        // 收藏
        val faved = config.favorites.contains(res.idText)
        Button(onClick = { onToggleFav(res) },
            colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary),
            modifier = Modifier.fillMaxWidth()) {
            Text(if (faved) "★ 已收藏" else "☆ 收藏")
        }
    }
}

@Composable
fun LinksContent(linksFile: File, links: List<UserLink>, palette: ThemePalette, onUpdate: (List<UserLink>) -> Unit) {
    var name by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("链接", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary)
        Spacer(Modifier.height(10.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextField(
                value = name, onValueChange = { name = it }, modifier = Modifier.weight(1f),
                placeholder = { Text("链接名称", color = palette.textSecondary) },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                    focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                ), singleLine = true
            )
            TextField(
                value = url, onValueChange = { url = it }, modifier = Modifier.weight(1.4f),
                placeholder = { Text("https://…", color = palette.textSecondary) },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                    focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                ), singleLine = true
            )
            Button(onClick = {
                if (name.isNotBlank() && url.startsWith("http")) {
                    val updated = links + UserLink(
                        id = java.util.UUID.randomUUID().toString().replace("-", ""),
                        name = name.trim(), url = url.trim(),
                        createdAt = System.currentTimeMillis()
                    )
                    LinkStore.save(linksFile, updated)
                    onUpdate(updated)
                    name = ""; url = ""
                }
            }) { Text("添加") }
        }
        Spacer(Modifier.height(10.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(links) { link ->
                Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(14.dp)).padding(14.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(link.name, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                            Text(link.url, fontSize = 12.sp, color = palette.accent, maxLines = 1)
                        }
                        Text(
                            "删除", color = Color(0xFFFF7b72), fontSize = 13.sp,
                            modifier = Modifier.clickable {
                                val updated = links.filterNot { it.id == link.id }
                                LinkStore.save(linksFile, updated)
                                onUpdate(updated)
                            }
                        )
                    }
                }
            }
        }
    }
}

private fun normalizeHttp(raw: String): String {
    var u = raw.trim()
    if (u.isEmpty()) return u
    if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u
    return u
}

@Composable
fun BrowserContent(snapshot: DataSnapshot?, palette: ThemePalette) {
    val ctx = LocalContext.current
    var url by remember { mutableStateOf("") }
    var target by remember { mutableStateOf<String?>(null) }
    val quickLinks = remember(snapshot) {
        snapshot?.resources.orEmpty().flatMap { res -> res.links.map { l -> res.name to l } }
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
            Button(onClick = { target = normalizeHttp(url) }) { Text("打开") }
        }
        if (target != null) {
            Spacer(Modifier.height(10.dp))
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
            Spacer(Modifier.height(8.dp))
            Button(onClick = { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target!!))) } },
                colors = ButtonDefaults.buttonColors(containerColor = palette.cardBg, contentColor = palette.textPrimary),
                modifier = Modifier.fillMaxWidth()) {
                Text("用外部浏览器打开")
            }
        }
        if (quickLinks.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text("资源快捷链接", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
            Spacer(Modifier.height(8.dp))
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(quickLinks) { (resName, linkUrl) ->
                    Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(14.dp)).padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(resName, fontSize = 13.sp, color = palette.textPrimary, maxLines = 1)
                                Text(linkUrl, fontSize = 12.sp, color = palette.accent, maxLines = 1)
                            }
                            Button(onClick = { target = linkUrl }) { Text("打开") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DownloadsContent(snapshot: DataSnapshot?, palette: ThemePalette) {
    val ctx = LocalContext.current
    var url by remember { mutableStateOf("") }
    var queued by remember { mutableStateOf<List<String>>(emptyList()) }
    val quickLinks = remember(snapshot) {
        snapshot?.resources.orEmpty().flatMap { res -> res.links.map { l -> res.name to l } }
    }

    fun enqueue(u: String) {
        runCatching {
            val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val file = u.substringAfterLast('/').ifEmpty { "download" }
            val req = DownloadManager.Request(Uri.parse(u))
                .setTitle(file) // 通知默认可见，落到系统「下载」目录
            dm.enqueue(req)
        }
        queued = queued + u
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
            Button(onClick = { if (url.isNotBlank()) enqueue(normalizeHttp(url)) }) { Text("下载") }
        }
        Spacer(Modifier.height(10.dp))
        Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(18.dp)).padding(18.dp)) {
            Column {
                Text("本次会话", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                Spacer(Modifier.height(6.dp))
                if (queued.isEmpty()) Text("暂无任务", fontSize = 12.sp, color = palette.textSecondary)
                else queued.forEach { Text(it, fontSize = 12.sp, color = palette.textPrimary) }
                Spacer(Modifier.height(6.dp))
                Text("文件保存到系统「下载」目录，完成后有通知", fontSize = 12.sp, color = palette.textSecondary)
            }
        }
        if (quickLinks.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text("从资源链接下载", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
            Spacer(Modifier.height(8.dp))
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(quickLinks) { (resName, linkUrl) ->
                    Box(modifier = Modifier.fillMaxWidth().background(palette.cardBg, RoundedCornerShape(14.dp)).padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
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
}

@Composable
fun SettingsContent(config: AppConfig, snapshot: DataSnapshot?, palette: ThemePalette, onUpdate: (AppConfig) -> Unit) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text("设置", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = palette.textPrimary) }
        // 主题外观（四主题 + 玻璃开关 + 自定义颜色）
        item {
            Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                Column {
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
                                        // 切主题时按旧版语义联动玻璃开关（紫金黑锁死开，纯黑/纯白默认关）
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
                        Spacer(Modifier.padding(6.dp))
                        Switch(
                            checked = config.liquidGlass,
                            onCheckedChange = { onUpdate(config.copy(liquidGlass = it)) },
                            enabled = config.theme != "zijin", // 紫金黑玻璃锁死
                            colors = SwitchDefaults.colors(checkedTrackColor = palette.accent)
                        )
                        Text(
                            if (config.theme == "zijin") "（紫金黑主题玻璃锁死开启，不可关闭）" else "（切换开关可开关液态玻璃质感）",
                            fontSize = 11.sp, color = palette.textSecondary, modifier = Modifier.padding(start = 6.dp)
                        )
                    }
                    // 主题颜色（仅自定义主题）：预设色圆点 + 色值输入
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
                            var hex by remember(config.accent) { mutableStateOf(config.accent) }
                            TextField(
                                value = hex, onValueChange = { hex = it },
                                modifier = Modifier.weight(1f),
                                placeholder = { Text("#7c5cff", color = palette.textSecondary) },
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = palette.cardBg, unfocusedContainerColor = palette.cardBg,
                                    focusedTextColor = palette.textPrimary, unfocusedTextColor = palette.textPrimary
                                ), singleLine = true,
                                trailingIcon = {
                                    Text("确定", fontSize = 13.sp, color = palette.accent,
                                        modifier = Modifier.clickable {
                                            if (Regex("^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$").matches(hex.trim())) onUpdate(config.copy(accent = hex.trim()))
                                        })
                                }
                            )
                        }
                    }
                }
            }
        }
        // 更新渠道
        item {
            Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                Column {
                    Text("更新渠道", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                    Spacer(Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = config.updateChannel == "gitee", onClick = { onUpdate(config.copy(updateChannel = "gitee")) })
                        Text("国内镜像（Gitee）", color = palette.textPrimary, modifier = Modifier.clickable { onUpdate(config.copy(updateChannel = "gitee")) })
                        Spacer(Modifier.padding(6.dp))
                        RadioButton(selected = config.updateChannel == "github", onClick = { onUpdate(config.copy(updateChannel = "github")) })
                        Text("全球官方（GitHub）", color = palette.textPrimary, modifier = Modifier.clickable { onUpdate(config.copy(updateChannel = "github")) })
                    }
                    Spacer(Modifier.height(6.dp))
                    Text("国内网络建议选 Gitee；移动端检测到新版本后请到发布页下载对应安装包", fontSize = 12.sp, color = palette.textSecondary)
                }
            }
        }
        // 关于应用（简介/通用密钥/QQ 群来自 box 数据）
        item {
            Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                Column {
                    Text("关于应用", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = palette.textPrimary)
                    Spacer(Modifier.height(6.dp))
                    val box = snapshot?.box
                    Text(box?.appName?.takeIf { it.isNotEmpty() } ?: "Pointers-BOX", color = palette.textSecondary)
                    if (!box?.appIntroduction.isNullOrBlank()) Text(box!!.appIntroduction, fontSize = 12.sp, color = palette.textSecondary)
                    if (!box?.generalKey.isNullOrBlank()) Text("通用密钥：${box!!.generalKey}", fontSize = 12.sp, color = palette.textSecondary)
                    if (!box?.communityQq.isNullOrBlank()) Text("社区 QQ 群：${box!!.communityQq}", fontSize = 12.sp, color = palette.textSecondary)
                    Text(box?.copyright?.takeIf { it.isNotEmpty() } ?: "Copyright © 2026 Pointers-BOX All Rights Reserved",
                        fontSize = 12.sp, color = palette.textSecondary)
                }
            }
        }
        // 版本日志（完整列表，可折叠）
        val logs = snapshot?.versionLogs.orEmpty()
        if (logs.isNotEmpty()) {
            item {
                var expanded by remember { mutableStateOf(true) }
                Box(modifier = Modifier.fillMaxWidth().background(palette.cardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                    Column {
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
                            Text("${logs[0].version}  ${logs[0].log}", fontSize = 12.sp,
                                color = palette.textSecondary, maxLines = 2)
                        }
                    }
                }
            }
        }
    }
}
