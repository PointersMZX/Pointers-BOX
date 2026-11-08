// 应用配置与用户数据模型（对齐 v2.5.0 shared/types.ts AppConfig/UserLink）

using System.Text.Json.Serialization;

namespace Pointers.Box.Core;

public class AppConfig
{
    [JsonPropertyName("downloadDir")] public string DownloadDir { get; set; } = "";
    [JsonPropertyName("androidBrowser")] public string AndroidBrowser { get; set; } = "builtin";
    // 主题：zijin 紫金黑（玻璃锁死）/ custom 自定义（玻璃可关）/ black 纯黑 / white 纯白（对齐旧版 ThemeKey）
    [JsonPropertyName("theme")] public string Theme { get; set; } = "zijin";
    [JsonPropertyName("accent")] public string Accent { get; set; } = "#7c5cff";
    // 液态玻璃开关（按主题记忆；紫金黑锁死开启）
    [JsonPropertyName("liquidGlass")] public bool LiquidGlass { get; set; } = true;
    [JsonPropertyName("updateChannel")] public string UpdateChannel { get; set; } = "gitee";
    [JsonPropertyName("homeLayout")] public string HomeLayout { get; set; } = "stacked";
    [JsonPropertyName("keepDownloadHistory")] public bool KeepDownloadHistory { get; set; } = true;

    /// <summary>当前主题下玻璃是否生效（紫金黑锁死开）。</summary>
    [JsonIgnore]
    public bool GlassOn => Theme == "zijin" || (Theme == "custom" && LiquidGlass);
}

public class UserLink
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("url")] public string Url { get; set; } = "";
    [JsonPropertyName("remark")] public string Remark { get; set; } = "";
    [JsonPropertyName("createdAt")] public long CreatedAt { get; set; }

    /// <summary>备注非空（UI 绑定用）。</summary>
    [JsonIgnore]
    public bool HasRemark => !string.IsNullOrWhiteSpace(Remark);
}
