// Pointers-BOX Android（v2.6.0 全原生）：主导航 + 主页完整 + 资源库 + 链接 + 设置

package cc.pointers.box.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cc.pointers.box.app.data.DataSnapshot
import cc.pointers.box.app.data.AppConfig
import cc.pointers.box.app.data.DataStore
import cc.pointers.box.app.data.Resource
import cc.pointers.box.app.data.UserLink
import java.io.File
import kotlinx.serialization.encodeToString

private val BgBase = Color(0xFF0d0817)
private val CardBg = Color(0xFF2a2135)
private val CardBgAlt = Color(0xFF241c2e)
private val TextPrimary = Color(0xFFf0eaf8)
private val TextSecondary = Color(0xFFa99cc4)
private val Accent = Color(0xFF7c5cff)
private val Green = Color(0xFF7ee787)
private val Amber = Color(0xFFd29922)

enum class Page { Home, Resources, Links, Settings }

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
            Surface(modifier = Modifier.fillMaxSize(), color = BgBase) {
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

    LaunchedEffect(Unit) {
        val snap = store.getData()
        snapshot = snap
        recommends = snap.resources.orEmpty().shuffled().take(4)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Box(modifier = Modifier.weight(1f)) {
            when (page) {
                Page.Home -> HomeContent(snapshot, recommends) {
                    recommends = snapshot?.resources.orEmpty().shuffled().take(4)
                }
                Page.Resources -> ResourcesContent(snapshot)
                Page.Links -> LinksContent(linksFile, links) { links = it }
                Page.Settings -> SettingsContent(config) { config = it; ConfigStore.save(configFile, config) }
            }
        }
        BottomNav(page) { page = it }
    }
}

@Composable
fun BottomNav(current: Page, onSelect: (Page) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp)
            .background(Color(0xFF1a1425), RoundedCornerShape(24.dp))
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        for ((label, p) in listOf("首页" to Page.Home, "资源" to Page.Resources, "链接" to Page.Links, "设置" to Page.Settings)) {
            Text(
                text = label,
                fontSize = 14.sp,
                fontWeight = if (current == p) FontWeight.Bold else FontWeight.Normal,
                color = if (current == p) Accent else TextSecondary,
                modifier = Modifier
                    .clickable { onSelect(p) }
                    .padding(horizontal = 12.dp, vertical = 4.dp)
            )
        }
    }
}

@Composable
fun HomeContent(snapshot: DataSnapshot?, recommends: List<Resource>, onShuffle: () -> Unit) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text("主页", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = TextPrimary) }
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("今日推荐", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                Button(onClick = onShuffle) { Text("换一批") }
            }
        }
        if (recommends.isEmpty()) {
            item { Text("加载中…（线路重试中）", fontSize = 13.sp, color = TextSecondary) }
        }
        items(recommends) { res ->
            Box(modifier = Modifier.fillMaxWidth().background(CardBg, RoundedCornerShape(18.dp)).padding(20.dp)) {
                Column {
                    Text(res.name, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    if (res.introduction.isNotEmpty()) {
                        Spacer(Modifier.height(6.dp))
                        Text(res.introduction, fontSize = 13.sp, color = TextSecondary)
                    }
                }
            }
        }
        snapshot?.announcement?.let { ann ->
            item {
                Box(modifier = Modifier.fillMaxWidth().background(CardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                    Column {
                        Text("公告", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                        Spacer(Modifier.height(8.dp))
                        Text(ann.content, fontSize = 13.sp, color = TextSecondary)
                    }
                }
            }
        }
        item {
            Box(modifier = Modifier.fillMaxWidth().background(CardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
                Column {
                    Text("数据状态", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    Spacer(Modifier.height(8.dp))
                    val offline = snapshot?.offline ?: false
                    Text(if (offline) "离线（展示本地缓存）" else "在线", fontSize = 13.sp, color = if (offline) Amber else Green)
                }
            }
        }
    }
}

@Composable
fun ResourcesContent(snapshot: DataSnapshot?) {
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
        Text("资源", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        Spacer(Modifier.height(10.dp))
        TextField(
            value = keyword, onValueChange = { keyword = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("搜索资源名称/简介", color = TextSecondary) },
            colors = TextFieldDefaults.colors(
                focusedContainerColor = CardBg, unfocusedContainerColor = CardBg,
                focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
            ), singleLine = true
        )
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (c in categories) {
                Text(
                    text = c, fontSize = 13.sp,
                    color = if (category == c) TextPrimary else TextSecondary,
                    fontWeight = if (category == c) FontWeight.Bold else FontWeight.Normal,
                    modifier = Modifier
                        .background(if (category == c) Accent else CardBg, RoundedCornerShape(12.dp))
                        .clickable { category = c }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(filtered) { res ->
                Box(modifier = Modifier.fillMaxWidth().background(CardBg, RoundedCornerShape(18.dp)).padding(18.dp)) {
                    Column {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(res.name, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                            if (res.category.isNotEmpty()) Text(res.category, fontSize = 12.sp, color = Accent)
                        }
                        if (res.introduction.isNotEmpty()) {
                            Spacer(Modifier.height(6.dp))
                            Text(res.introduction, fontSize = 13.sp, color = TextSecondary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LinksContent(linksFile: File, links: List<UserLink>, onUpdate: (List<UserLink>) -> Unit) {
    var name by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("链接", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        Spacer(Modifier.height(10.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextField(
                value = name, onValueChange = { name = it }, modifier = Modifier.weight(1f),
                placeholder = { Text("链接名称", color = TextSecondary) },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = CardBg, unfocusedContainerColor = CardBg,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
                ), singleLine = true
            )
            TextField(
                value = url, onValueChange = { url = it }, modifier = Modifier.weight(1.4f),
                placeholder = { Text("https://…", color = TextSecondary) },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = CardBg, unfocusedContainerColor = CardBg,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
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
                Box(modifier = Modifier.fillMaxWidth().background(CardBgAlt, RoundedCornerShape(14.dp)).padding(14.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(link.name, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                            Text(link.url, fontSize = 12.sp, color = Accent, maxLines = 1)
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

@Composable
fun SettingsContent(config: AppConfig, onUpdate: (AppConfig) -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("设置", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        Box(modifier = Modifier.fillMaxWidth().background(CardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
            Column {
                Text("更新渠道", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = config.updateChannel == "gitee", onClick = { onUpdate(config.copy(updateChannel = "gitee")) })
                    Text("国内镜像（Gitee）", color = TextPrimary, modifier = Modifier.clickable { onUpdate(config.copy(updateChannel = "gitee")) })
                    Spacer(Modifier.padding(6.dp))
                    RadioButton(selected = config.updateChannel == "github", onClick = { onUpdate(config.copy(updateChannel = "github")) })
                    Text("全球官方（GitHub）", color = TextPrimary, modifier = Modifier.clickable { onUpdate(config.copy(updateChannel = "github")) })
                }
                Spacer(Modifier.height(6.dp))
                Text("国内网络建议选 Gitee；移动端检测到新版本后请到发布页下载对应安装包", fontSize = 12.sp, color = TextSecondary)
            }
        }
        Box(modifier = Modifier.fillMaxWidth().background(CardBgAlt, RoundedCornerShape(18.dp)).padding(20.dp)) {
            Column {
                Text("关于应用", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                Spacer(Modifier.height(6.dp))
                Text("Pointers-BOX v2.6.0", color = TextSecondary)
                Text("开发者：Pointers", fontSize = 12.sp, color = TextSecondary)
                Text("Copyright © 2026 Pointers-BOX All Rights Reserved", fontSize = 12.sp, color = TextSecondary)
            }
        }
    }
}
