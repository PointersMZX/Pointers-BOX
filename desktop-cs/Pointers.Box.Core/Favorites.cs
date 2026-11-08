// 收藏与更新检查（v2.6.0 C# 补齐旧版能力）

using System.IO;
using System.Net.Http;
using System.Text.Json;

namespace Pointers.Box.Core;

/// <summary>收藏持久化（favorites.json，存资源 id 字符串）。</summary>
public static class Favorites
{
    public static List<string> Load(string path)
    {
        try
        {
            if (!File.Exists(path)) return new List<string>();
            return JsonSerializer.Deserialize<List<string>>(File.ReadAllText(path)) ?? new List<string>();
        }
        catch { return new List<string>(); }
    }

    public static void Save(string path, List<string> ids)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonSerializer.Serialize(ids));
    }
}

/// <summary>检查更新结果（对齐旧版 UpdateCheckResult）。</summary>
public class UpdateCheckResult
{
    public string Current { get; set; } = "2.6.0";
    public string? Latest { get; set; }
    public bool HasUpdate { get; set; }
    public string? ReleaseUrl { get; set; }
    public string? ReleaseNotes { get; set; }
    public string? Error { get; set; }
}

/// <summary>检查更新（Gitee/GitHub 双渠道 Release API）。</summary>
public static class UpdateChecker
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };

    public const string GiteeApi = "https://gitee.com/api/v5/repos/PointersMZX/Pointers-BOX/releases/latest";
    public const string GithubApi = "https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/latest";
    public const string GiteePage = "https://gitee.com/PointersMZX/Pointers-BOX/releases";
    public const string GithubPage = "https://github.com/PointersMZX/Pointers-BOX/releases";

    public static async Task<UpdateCheckResult> CheckAsync(string channel, string current)
    {
        var isGitee = channel == "gitee";
        var api = isGitee ? GiteeApi : GithubApi;
        var page = isGitee ? GiteePage : GithubPage;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, api);
            req.Headers.UserAgent.ParseAdd("Pointers-BOX/2.6.0");
            var resp = await Http.SendAsync(req);
            if ((int)resp.StatusCode == 403) throw new Exception("接口访问受限（限流），请稍后再试");
            if ((int)resp.StatusCode == 404) throw new Exception("未找到任何 Release");
            if (!resp.IsSuccessStatusCode) throw new Exception($"HTTP {(int)resp.StatusCode}");
            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var tagName = root.TryGetProperty("tag_name", out var tag) ? tag.GetString() : null;
            if (string.IsNullOrEmpty(tagName)) throw new Exception("Release 数据缺少 tag_name");
            var notes = root.TryGetProperty("body", out var body) ? body.GetString() : null;
            return new UpdateCheckResult
            {
                Current = current,
                Latest = tagName,
                HasUpdate = BoxLogic.IsNewerVersion(tagName, current),
                ReleaseUrl = root.TryGetProperty("html_url", out var html) ? html.GetString() : page,
                ReleaseNotes = notes?.Length > 600 ? notes[..600] : notes
            };
        }
        catch (Exception e)
        {
            return new UpdateCheckResult { Current = current, Error = e.Message };
        }
    }
}
