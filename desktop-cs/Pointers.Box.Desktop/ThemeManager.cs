// 主题引擎：四套主题（紫金黑/自定义/纯黑/纯白）+ 液态玻璃开关
// 色板对齐旧版 buildTheme.ts SURFACES；App.axaml 动态资源消费（TextBlock/Border 等绑 DynamicResource）
using System;
using Avalonia;
using Avalonia.Media;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop;

public class ThemeManager
{
    public static ThemeManager Instance { get; } = new();

    // 色板资源键（App 级 DynamicResource）
    public static readonly string[] ResourceKeys =
    {
        "TAppBg", "TText", "TTextMuted", "TTitle", "TAccent", "TNavIdle", "TCardBorder",
        "TGlassBg", "TGlassBorder", "TGlassShadow", "TGlassAltBg", "TGlassAltBorder",
        "TBtnBg", "TBtnOver", "TBtnBorder", "TInputBg", "TInputBorder", "TRowBg"
    };

    // ── 应用主题（对齐旧版 setAppearance 语义：紫金黑玻璃锁死开） ──
    public void Apply(AppConfig config)
    {
        var app = Application.Current!;
        var res = app.Resources;
        var key = config.Theme;
        var glass = config.GlassOn;

        // 默认 = 紫金黑（对齐旧版 zj SURFACES + material）
        var appBg = "#0d0817";
        var text = "#f0eaf8";
        var textMuted = "#a99cc4";
        var accent = key == "custom" ? NormalizeAccent(config.Accent) : "#7c5cff";
        var navIdle = "#a99cc4";
        var glassBg = "#5C2A2135";
        var glassBorder = "#29FFFFFF";
        var glassAltBg = "#52241C2E";
        var glassAltBorder = "#22FFFFFF";
        var btnBg = "#1FFFFFFF";
        var btnOver = "#2EFFFFFF";
        var btnBorder = "#29FFFFFF";
        var inputBg = "#1FFFFFFF";
        var inputBorder = "#29FFFFFF";
        var rowBg = "#14241c2e";
        var cardBorder = "#1affffff";

        if (key == "custom")
        {
            // 自定义：深色蓝底 + 强调色晕（对齐旧版 custom SURFACES）
            appBg = "#0a1428";
            glassBg = "#5C20292F";
            glassAltBg = "#521C2430";
            navIdle = "#8fa3c0";
            textMuted = "#8fa3c0";
        }
        else if (key == "black")
        {
            // 纯黑（对齐旧版 black SURFACES）
            appBg = "#000000";
            text = "#ededed";
            textMuted = "#8f8f8f";
            navIdle = "#8f8f8f";
            glassBg = "#85101010";
            glassBorder = "#232323";
            glassAltBg = "#850a0a0a";
            glassAltBorder = "#1f232323";
            btnBg = "#FF101010";
            btnOver = "#FF1c1c1c";
            btnBorder = "#FF232323";
            inputBg = "#FF111111";
            inputBorder = "#FF232323";
            rowBg = "#FF141414";
            cardBorder = "#FF232323";
        }
        else if (key == "white")
        {
            // 纯白（浅色，对齐旧版 white SURFACES）
            appBg = "#ffffff";
            text = "#171717";
            textMuted = "#6b6b6b";
            navIdle = "#6b6b6b";
            glassBg = "#F2FFFFFF";
            glassBorder = "#e2e2e2";
            glassAltBg = "#F2fafafa";
            glassAltBorder = "#e6e6e6";
            btnBg = "#FFF0f0f0";
            btnOver = "#FFe6e6e6";
            btnBorder = "#e2e2e2";
            inputBg = "#FFFFFFFF";
            inputBorder = "#e6e6e6";
            rowBg = "#FFF5f5f5";
            cardBorder = "#FFe6e6e6";
        }

        // 玻璃关：面板退化实色（对齐旧版 flatMaterial）
        if (!glass && key != "black" && key != "white")
        {
            glassBg = key == "custom" ? "#FF14202f" : "#FF1a1026";
            glassAltBg = key == "custom" ? "#FF101a28" : "#FF150e20";
            glassBorder = key == "custom" ? "#2b3b52" : "#3a2b52";
            glassAltBorder = glassBorder;
        }
        if (!glass && key == "custom")
        {
            btnBg = "#FF182636";
            btnOver = "#FF223248";
            btnBorder = "#2b3b52";
            inputBg = "#FF101c2c";
        }

        Set(res, "TAppBgBrush", appBg); // MainWindow.Background（XAML DynamicResource 要 Brush）
        Set(res, "TText", text);
        Set(res, "TTextMuted", textMuted);
        Set(res, "TTitle", text);
        Set(res, "TAccent", accent);
        Set(res, "TNavIdle", navIdle);
        Set(res, "TCardBorder", cardBorder);
        Set(res, "TGlassBg", glassBg);
        Set(res, "TGlassBorder", glassBorder);
        Set(res, "TGlassAltBg", glassAltBg);
        Set(res, "TGlassAltBorder", glassAltBorder);
        Set(res, "TBtnBg", btnBg);
        Set(res, "TBtnOver", btnOver);
        Set(res, "TBtnBorder", btnBorder);
        Set(res, "TInputBg", inputBg);
        Set(res, "TInputBorder", inputBorder);
        Set(res, "TRowBg", rowBg);
        // 玻璃投影（白/纯黑关玻璃时弱化）
        Set(res, "TGlassShadow", glass
            ? "inset 0 1 0 0 #4DFFFFFF, inset 0 -1 0 0 #14FFFFFF, inset 0 0 28 0 #0DFFFFFF, 0 10 34 0 #59030014"
            : "inset 0 1 0 0 #26FFFFFF, 0 6 18 0 #33000000");

        // 请求侧栏柔光球/背景层联动（MainWindow 订阅）
        ThemeApplied?.Invoke(this, config);
    }

    public event EventHandler<AppConfig>? ThemeApplied;

    // 全部塞强类型对象（DynamicResource 消费方要 IBrush/BoxShadows；字符串会让绑定崩溃）
    private static void Set(Avalonia.Controls.IResourceDictionary res, string key, string value)
    {
        res[key] = key.EndsWith("Shadow") ? (object)BoxShadows.Parse(value) : new SolidColorBrush(Color.Parse(value));
    }

    private static string NormalizeAccent(string? accent)
    {
        if (!string.IsNullOrEmpty(accent) &&
            accent.Length >= 4 && accent[0] == '#' &&
            System.Text.RegularExpressions.Regex.IsMatch(accent, @"^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$"))
            return accent;
        return "#7c5cff";
    }
}
