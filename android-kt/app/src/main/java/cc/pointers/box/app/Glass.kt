// 液态玻璃视觉工具（参考 06-liquid-glass-spec dark 预设 + 05-gradient-flow-bg）
package cc.pointers.box.app

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import kotlin.math.cos
import kotlin.math.sin
import androidx.compose.ui.unit.dp

// 玻璃卡配色：半透明深底 + 高亮描边（dark 预设）
val GlassCardBg = Color(0x6B2a2135)
val GlassCardBorder = Color(0x29FFFFFF)
val GlassAltBg = Color(0x66241c2e)
val GlassRimTop = Color(0x59FFFFFF)

/** 柔光球流动背景层：Canvas 上画三个径向渐变球，慢速漂移（timeScale 低=慢炖） */
@Composable
fun OrbBackground(modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "orb")
    val phase by t.animateFloat(
        initialValue = 0f, targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(90000, easing = LinearEasing), RepeatMode.Restart),
        label = "phase"
    )
    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        fun orb(cx: Float, cy: Float, r: Float, color: Color) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(color.copy(alpha = 0.55f), color.copy(alpha = 0f)),
                    center = Offset(cx, cy), radius = r
                ),
                radius = r, center = Offset(cx, cy)
            )
        }
        // 主紫球（左上漂移）
        orb(
            w * 0.25f + sin(phase) * w * 0.06f,
            h * 0.2f + cos(phase * 0.7f) * h * 0.05f,
            w * 0.55f, Color(0xFF7c5cff)
        )
        // 青球（右下反向漂移）
        orb(
            w * 0.8f + cos(phase * 0.8f) * w * 0.05f,
            h * 0.85f + sin(phase * 0.6f) * h * 0.05f,
            w * 0.5f, Color(0xFF06b6d4)
        )
        // 粉点缀（中部小漂移）
        orb(
            w * 0.55f + sin(phase * 1.3f) * w * 0.04f,
            h * 0.55f + cos(phase * 0.9f) * h * 0.04f,
            w * 0.35f, Color(0xFFec4899)
        )
    }
}

/** 玻璃卡 modifier：圆角 + 半透明底 + 高亮描边 + 顶棱线（inset 边框近似） */
fun Modifier.glassCard(bg: Color = GlassCardBg, corner: Int = 18): Modifier = this
    .background(bg, RoundedCornerShape(corner.dp))
    .border(1.dp, Brush.verticalGradient(listOf(GlassRimTop, GlassCardBorder)), RoundedCornerShape(corner.dp))
