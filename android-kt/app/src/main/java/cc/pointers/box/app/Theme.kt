// 主题引擎：四套主题（紫金黑/自定义/纯黑/纯白）+ 液态玻璃开关（对齐桌面 ThemeManager.cs）
package cc.pointers.box.app

import androidx.compose.ui.graphics.Color

data class ThemePalette(
    val appBg: Color,
    val cardBg: Color,
    val cardBgAlt: Color,
    val navBg: Color,
    val navBorderTop: Color,
    val navBorderBottom: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val accent: Color,
    val glassOn: Boolean
)

/** 自定义主题预设色（对齐桌面 ACCENT_PRESETS） */
val ACCENT_PRESETS = listOf(
    "#7c5cff", "#e659a8", "#c084fc", "#3182ce",
    "#00b3a4", "#f59e0b", "#64748b", "#94a3b8"
)

fun normalizeAccent(accent: String?): String {
    val v = accent?.trim().orEmpty()
    if (v.length >= 4 && v[0] == '#' && Regex("^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$").matches(v)) return v
    return "#7c5cff"
}

/** 玻璃关：面板退化实色（对齐桌面 flatMaterial 语义） */
fun buildPalette(theme: String, accent: String, liquidGlass: Boolean): ThemePalette {
    val glassOn = if (theme == "zijin") true else liquidGlass
    return when (theme) {
        "custom" -> ThemePalette(
            appBg = Color(0xFF0a1428),
            cardBg = if (glassOn) Color(0x5C20292F) else Color(0xFF14202f),
            cardBgAlt = if (glassOn) Color(0x521C2430) else Color(0xFF101a28),
            navBg = if (glassOn) Color(0xCC14202f) else Color(0xF214202f),
            navBorderTop = Color(0x59FFFFFF),
            navBorderBottom = Color(0x1AFFFFFF),
            textPrimary = Color(0xFFf0eaf8),
            textSecondary = Color(0xFF8fa3c0),
            accent = Color(android.graphics.Color.parseColor(normalizeAccent(accent))),
            glassOn = glassOn
        )
        "black" -> ThemePalette(
            appBg = Color(0xFF000000),
            cardBg = Color(0x85101010),
            cardBgAlt = Color(0x850a0a0a),
            navBg = Color(0xCC0a0a0a),
            navBorderTop = Color(0x33232323),
            navBorderBottom = Color(0x1F232323),
            textPrimary = Color(0xFFededed),
            textSecondary = Color(0xFF8f8f8f),
            accent = Color(0xFF7c5cff),
            glassOn = glassOn
        )
        "white" -> ThemePalette(
            appBg = Color(0xFFffffff),
            cardBg = Color(0xF2FFFFFF),
            cardBgAlt = Color(0xF2fafafa),
            navBg = Color(0xE6F0F0F5),
            navBorderTop = Color(0x66e2e2e2),
            navBorderBottom = Color(0x4De2e2e2),
            textPrimary = Color(0xFF171717),
            textSecondary = Color(0xFF6b6b6b),
            accent = Color(0xFF7c5cff),
            glassOn = glassOn
        )
        else -> ThemePalette( // zijin 紫金黑（默认）
            appBg = Color(0xFF0d0817),
            cardBg = if (glassOn) Color(0x5C2A2135) else Color(0xFF1a1026),
            cardBgAlt = if (glassOn) Color(0x52241C2E) else Color(0xFF150e20),
            navBg = Color(0xCC1a1425),
            navBorderTop = Color(0x59FFFFFF),
            navBorderBottom = Color(0x1AFFFFFF),
            textPrimary = Color(0xFFf0eaf8),
            textSecondary = Color(0xFFa99cc4),
            accent = Color(0xFF7c5cff),
            glassOn = glassOn
        )
    }
}
