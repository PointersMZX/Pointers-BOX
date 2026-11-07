// Pointers-BOX 数据层（v2.6.0 C#）：4 路并发拉取 + .mcx 解密 + 缓存兜底
// 协议见 docs/protocol.md；语义对齐 v2.5.0 src/shared/types.ts REMOTE_URLS + harmony/capacitor 数据层。

using System.Net.Http;
using System.Text.Json;

namespace Pointers.Box.Core;

public static class RemoteUrls
{
    public const string Resources = "https://api.pointers-box.cc.cd/box/resources.mcx";
    public const string Announcement = "https://api.pointers-box.cc.cd/box/announcement.mcx";
    public const string Box = "https://api.pointers-box.cc.cd/box/box.mcx";
    public const string VersionLogs = "https://api.pointers-box.cc.cd/box/boxbbgxrz.mcx";
}

public class DataStore
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(30) };

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    private readonly string _cachePath;
    private readonly string _embeddedBox; // 包内嵌入 box.mcx（构建时随包分发）

    public DataStore(string cachePath, string embeddedBox)
    {
        _cachePath = cachePath;
        _embeddedBox = embeddedBox;
    }

    private static async Task<string?> FetchTextAsync(string url, bool force)
    {
        var target = force ? $"{url}?t={DateTimeOffset.Now.ToUnixTimeMilliseconds()}" : url;
        using var resp = await Http.GetAsync(target);
        if (!resp.IsSuccessStatusCode) throw new HttpRequestException($"HTTP {(int)resp.StatusCode}");
        return await resp.Content.ReadAsStringAsync();
    }

    private static T? ParseLoose<T>(string raw) where T : class
    {
        // .mcx 解密；明文 JSON 直通（防御兜底）
        var json = McxCrypto.OpenMuxed(raw);
        return JsonSerializer.Deserialize<T>(json, JsonOpts);
    }

    /// <summary>4 路并发拉取；全失败走缓存/嵌入兜底（offline=true）。</summary>
    public async Task<DataSnapshot> GetDataAsync(bool force = false)
    {
        var tResources = FetchTextAsync(RemoteUrls.Resources, force);
        var tAnnouncement = FetchTextAsync(RemoteUrls.Announcement, force);
        var tBox = FetchTextAsync(RemoteUrls.Box, force);
        var tLogs = FetchTextAsync(RemoteUrls.VersionLogs, force);

        var snapshot = new DataSnapshot();
        var warnings = new List<string>();

        try { snapshot.Resources = ParseLoose<List<Resource>>(await tResources); }
        catch (Exception e) { warnings.Add($"资源数据获取失败：{e.Message}"); }

        try { snapshot.Announcement = ParseLoose<Announcement>(await tAnnouncement); }
        catch (Exception e) { warnings.Add($"公告获取失败：{e.Message}"); }

        try
        {
            var remote = ParseLoose<BoxInfo>(await tBox);
            snapshot.Box = MergeBoxInfo(EmbeddedBoxInfo(), remote);
        }
        catch (Exception e) { warnings.Add($"应用信息获取失败：{e.Message}"); snapshot.Box ??= EmbeddedBoxInfo(); }

        try { snapshot.VersionLogs = ParseLoose<List<VersionLog>>(await tLogs); }
        catch (Exception e) { warnings.Add($"版本日志获取失败：{e.Message}"); }

        snapshot.Warnings = warnings;
        snapshot.Offline = snapshot.Resources == null && snapshot.Announcement == null;

        if (!snapshot.Offline)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_cachePath)!);
                File.WriteAllText(_cachePath, JsonSerializer.Serialize(snapshot, JsonOpts));
            }
            catch { /* 缓存写入失败不影响主流程 */ }
        }
        else
        {
            var cached = LoadCache();
            if (cached != null)
            {
                cached.Offline = true;
                return cached;
            }
        }
        return snapshot;
    }

    private DataSnapshot? LoadCache()
    {
        try
        {
            if (!File.Exists(_cachePath)) return null;
            var cached = JsonSerializer.Deserialize<DataSnapshot>(File.ReadAllText(_cachePath), JsonOpts);
            if (cached != null) cached.Box = MergeBoxInfo(EmbeddedBoxInfo(), cached.Box);
            return cached;
        }
        catch { return null; }
    }

    private BoxInfo? EmbeddedBoxInfo()
    {
        try
        {
            if (_embeddedBox.Length == 0 || !File.Exists(_embeddedBox)) return null;
            return ParseLoose<BoxInfo>(File.ReadAllText(_embeddedBox));
        }
        catch { return null; }
    }

    /// <summary>嵌入为底，远程覆盖（远程字段非空才覆盖）。</summary>
    public static BoxInfo MergeBoxInfo(BoxInfo? embedded, BoxInfo? remote)
    {
        if (embedded == null) return remote ?? new BoxInfo();
        if (remote == null) return embedded;
        if (!string.IsNullOrEmpty(remote.AppName)) embedded.AppName = remote.AppName;
        if (!string.IsNullOrEmpty(remote.AppIntroduction)) embedded.AppIntroduction = remote.AppIntroduction;
        if (!string.IsNullOrEmpty(remote.GeneralKey)) embedded.GeneralKey = remote.GeneralKey;
        if (!string.IsNullOrEmpty(remote.Developer)) embedded.Developer = remote.Developer;
        if (!string.IsNullOrEmpty(remote.CommunityQq)) embedded.CommunityQq = remote.CommunityQq;
        if (!string.IsNullOrEmpty(remote.Copyright)) embedded.Copyright = remote.Copyright;
        return embedded;
    }
}
