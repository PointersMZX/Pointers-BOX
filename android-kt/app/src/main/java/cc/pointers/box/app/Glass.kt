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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import kotlin.math.cos
import kotlin.math.sin
import androidx.compose.ui.unit.dp

// 玻璃卡配色：半透明深底 + 高亮描边（dark 预设）
val GlassCardBg = Color(0x6B2a2135)
val GlassCardBorder = Color(0x29FFFFFF)
val GlassAltBg = Color(0x66241c2e)
val GlassRimTop = Color(0x59FFFFFF)

/**
 * 柔光球流动背景层：三个径向渐变球慢速漂移，整体做高斯模糊 →
 * 得到弥散的液态光晕（不模糊时球心边缘生硬、观感脏）。
 */
@Composable
fun OrbBackground(modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "orb")
    val phase by t.animateFloat(
        initialValue = 0f, targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(90000, easing = LinearEasing), RepeatMode.Restart),
        label = "phase"
    )
    Canvas(modifier = modifier.fillMaxSize().blur(70.dp)) {
        val w = size.width
        val h = size.height
        fun orb(cx: Float, cy: Float, r: Float, color: Color, alpha: Float) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(color.copy(alpha = alpha), color.copy(alpha = alpha * 0.35f), color.copy(alpha = 0f)),
                    center = Offset(cx, cy), radius = r
                ),
                radius = r, center = Offset(cx, cy)
            )
        }
        orb(w * 0.22f + sin(phase) * w * 0.05f, h * 0.16f + cos(phase * 0.7f) * h * 0.04f,
            w * 0.62f, Color(0xFF7c5cff), 0.42f)
        orb(w * 0.82f + cos(phase * 0.8f) * w * 0.04f, h * 0.88f + sin(phase * 0.6f) * h * 0.04f,
            w * 0.56f, Color(0xFF06b6d4), 0.30f)
        orb(w * 0.58f + sin(phase * 1.3f) * w * 0.03f, h * 0.52f + cos(phase * 0.9f) * h * 0.03f,
            w * 0.40f, Color(0xFFec4899), 0.24f)
    }
}

/**
 * 玻璃面板 modifier：半透明底 + 对角高光 sheen + 顶部棱线描边。
 * 玻璃关时退化为实色卡片（对齐桌面 flatMaterial 语义）。
 */
fun Modifier.glassPanel(palette: ThemePalette, corner: Int = 18, alt: Boolean = false): Modifier {
    val shape = RoundedCornerShape(corner.dp)
    val bg = if (alt) palette.cardBgAlt else palette.cardBg
    if (!palette.glassOn) {
        return this.background(bg, shape).border(1.dp, palette.navBorderBottom, shape)
    }
    return this
        .background(bg, shape)
        // 左上角高光渐变（玻璃的"被照亮"面），右上/底部保持透明
        .background(
            Brush.linearGradient(
                0.0f to Color(0x1FFFFFFF),
                0.30f to Color(0x0AFFFFFF),
                0.62f to Color(0x00FFFFFF)
            ), shape
        )
        .border(
            1.dp,
            Brush.linearGradient(
                0.0f to Color(0x73FFFFFF),
                0.25f to Color(0x24FFFFFF),
                0.60f to Color(0x0FFFFFFF),
                1.0f to Color(0x14FFFFFF)
            ), shape
        )
}

/** 兼容旧调用点。 */
fun Modifier.glassCard(bg: Color = GlassCardBg, corner: Int = 18): Modifier = this
    .background(bg, RoundedCornerShape(corner.dp))
    .border(1.dp, Brush.verticalGradient(listOf(GlassRimTop, GlassCardBorder)), RoundedCornerShape(corner.dp))
