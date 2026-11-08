// Pointers-BOX 业务逻辑（v2.6.0 C#）：推荐抽取/semver/收藏与链接持久化

using System.IO;
using System.Text.Json;

namespace Pointers.Box.Core;

public static class BoxLogic
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
    };

    /// <summary>今日推荐：随机抽 count 张（换一批=重新抽）。</summary>
    public static List<Resource> PickRecommends(List<Resource> resources, int count)
    {
        var rnd = new Random();
        return resources.OrderBy(_ => rnd.Next()).Take(count).ToList();
    }

    /// <summary>semver 新版判定（v 前缀剥离、分段数值比较）：latest > current。</summary>
    public static bool IsNewerVersion(string latest, string current)
    {
        var l = Normalize(latest);
        var c = Normalize(current);
        for (var i = 0; i < Math.Max(l.Count, c.Count); i++)
        {
            var li = i < l.Count ? l[i] : 0;
            var ci = i < c.Count ? c[i] : 0;
            if (li != ci) return li > ci;
        }
        return false;
    }

    private static List<int> Normalize(string v)
    {
        var digits = new string(v.TrimStart('v', 'V').TakeWhile(ch => char.IsDigit(ch) || ch == '.').ToArray());
        var parts = digits.Split('.', StringSplitOptions.RemoveEmptyEntries);
        return parts.Select(p => int.TryParse(p, out var n) ? n : 0).ToList();
    }

    /// <summary>用户链接持久化（存本地 json）。</summary>
    public static List<UserLink> LoadUserLinks(string path)
    {
        try
        {
            if (!File.Exists(path)) return new List<UserLink>();
            return JsonSerializer.Deserialize<List<UserLink>>(File.ReadAllText(path), JsonOpts) ?? new List<UserLink>();
        }
        catch { return new List<UserLink>(); }
    }

    public static void SaveUserLinks(string path, List<UserLink> links)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonSerializer.Serialize(links, JsonOpts));
    }
}
