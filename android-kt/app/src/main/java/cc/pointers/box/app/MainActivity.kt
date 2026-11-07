// Pointers-BOX Android（v2.6.0 全原生）：Compose 入口 + 主页（推荐/公告，接 DataStore 真数据）

package cc.pointers.box.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cc.pointers.box.app.data.Announcement
import cc.pointers.box.app.data.DataSnapshot
import cc.pointers.box.app.data.DataStore
import cc.pointers.box.app.data.Resource
import java.io.File

// 液态玻璃暗色基底色（v2.5.0 token 近似；M2 打磨迭代做真玻璃绘制）
private val BgBase = Color(0xFF0d0817)
private val CardBg = Color(0xFF2a2135)
private val CardBorder = Color(0xFF4a3f5c)
private val TextPrimary = Color(0xFFf0eaf8)
private val TextSecondary = Color(0xFFa99cc4)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val cacheDir = File(filesDir, "cache/snapshot.json")
        val embeddedBox = File(filesDir, "box.mcx") // assets 装配在 M4（构建流程复刻）
        val store = DataStore(cacheDir, embeddedBox.takeIf { it.exists() })
        setContent {
            Surface(modifier = Modifier.fillMaxSize(), color = BgBase) {
                HomeScreen(store)
            }
        }
    }
}

@Composable
fun HomeScreen(store: DataStore) {
    var snapshot by remember { mutableStateOf<DataSnapshot?>(null) }
    var recommends by remember { mutableStateOf<List<Resource>>(emptyList()) }

    LaunchedEffect(Unit) {
        val snap = store.getData()
        snapshot = snap
        recommends = snap.resources.orEmpty().shuffled().take(4)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { Text("主页", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = TextPrimary) }
        item { Text("今日推荐", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary) }
        items(recommends) { res -> ResourceCard(res) }
        snapshot?.announcement?.let { ann -> item { AnnouncementCard(ann) } }
    }
}

@Composable
private fun ResourceCard(res: Resource) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(CardBg, RoundedCornerShape(18.dp))
            .padding(20.dp)
    ) {
        Column {
            Text(res.name, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            if (res.introduction.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(res.introduction, fontSize = 13.sp, color = TextSecondary)
            }
        }
    }
}

@Composable
private fun AnnouncementCard(ann: Announcement) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF241c2e), RoundedCornerShape(18.dp))
            .padding(20.dp)
    ) {
        Column {
            Text("公告", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            Spacer(Modifier.height(8.dp))
            Text(ann.content, fontSize = 13.sp, color = TextSecondary)
        }
    }
}
