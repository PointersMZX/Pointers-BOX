// Pointers-BOX 数据模型（对齐 docs/protocol.md；与 v2.5.0 shared/types.ts 字段一致）

using System.Text.Json.Serialization;

namespace Pointers.Box.Core;

public class ShareItem
{
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("url")] public string Url { get; set; } = "";
}

public class Resource
{
    [JsonPropertyName("id")] public object? Id { get; set; } // number | string
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("introduction")] public string Introduction { get; set; } = "";
    [JsonPropertyName("release_date")] public string? ReleaseDate { get; set; }
    [JsonPropertyName("last_modified")] public string? LastModified { get; set; }
    [JsonPropertyName("category")] public string Category { get; set; } = "";
    [JsonPropertyName("links")] public List<string> Links { get; set; } = new();
    [JsonPropertyName("shares")] public List<ShareItem>? Shares { get; set; }
}

public class Announcement
{
    [JsonPropertyName("date")] public string Date { get; set; } = "";
    [JsonPropertyName("content")] public string Content { get; set; } = "";
}

public class VersionLog
{
    [JsonPropertyName("version")] public string Version { get; set; } = "";
    [JsonPropertyName("log")] public string Log { get; set; } = "";
}

public class BoxInfo
{
    [JsonPropertyName("app_name")] public string AppName { get; set; } = "";
    [JsonPropertyName("app_introduction")] public string AppIntroduction { get; set; } = "";
    [JsonPropertyName("general_key")] public string? GeneralKey { get; set; }
    [JsonPropertyName("developer")] public string Developer { get; set; } = "";
    [JsonPropertyName("community_qq")] public string CommunityQq { get; set; } = "";
    [JsonPropertyName("copyright")] public string Copyright { get; set; } = "";
}

/// <summary>4 路拉取快照：任一路失败以 null 占位（UI 对应卡降级）。</summary>
public class DataSnapshot
{
    public List<Resource>? Resources { get; set; }
    public Announcement? Announcement { get; set; }
    public BoxInfo? Box { get; set; }
    public List<VersionLog>? VersionLogs { get; set; }
    public bool Offline { get; set; }
    public List<string> Warnings { get; set; } = new();
}
