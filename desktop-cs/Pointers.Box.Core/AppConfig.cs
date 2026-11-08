// 应用配置与用户数据模型（对齐 v2.5.0 shared/types.ts AppConfig/UserLink）

using System.Text.Json.Serialization;

namespace Pointers.Box.Core;

public class AppConfig
{
    [JsonPropertyName("downloadDir")] public string DownloadDir { get; set; } = "";
    [JsonPropertyName("androidBrowser")] public string AndroidBrowser { get; set; } = "builtin";
    [JsonPropertyName("theme")] public string Theme { get; set; } = "zijin";
    [JsonPropertyName("accent")] public string Accent { get; set; } = "#7c5cff";
    [JsonPropertyName("updateChannel")] public string UpdateChannel { get; set; } = "gitee";
    [JsonPropertyName("homeLayout")] public string HomeLayout { get; set; } = "stacked";
    [JsonPropertyName("keepDownloadHistory")] public bool KeepDownloadHistory { get; set; } = true;
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
