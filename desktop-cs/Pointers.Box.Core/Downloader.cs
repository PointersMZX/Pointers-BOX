// Pointers-BOX 下载器（v2.6.0 C#）：任务模型 + 带进度下载 + 历史持久化

using System.ComponentModel;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Pointers.Box.Core;

/// <summary>一个下载任务（活动列表行）。INPC 供 UI 进度绑定。</summary>
public class DownloadTask : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    public string Url { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Dir { get; set; } = "";
    public long DoneBytes
    {
        get => doneBytes;
        set { if (doneBytes != value) { doneBytes = value; RaiseProgress(); } }
    }
    public long? TotalBytes { get; set; }
    /// <summary>0..1；-1 = 大小未知。</summary>
    public double Progress { get; set; } = -1;
    /// <summary>0..1，未知时为 0（配合 Indeterminate 显示）。</summary>
    public double ProgressView => Progress < 0 ? 0 : Progress;
    public bool Indeterminate => Progress < 0;
    /// <summary>downloading | done | failed</summary>
    public string Status { get => status; set { status = value; RaiseStatus(); } }
    public string? Error { get => error; set { error = value; RaiseStatus(); } }
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }

    private long doneBytes;
    private string status = "downloading";
    private string? error;
    private void RaiseProgress()
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(DoneBytes)));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(ProgressView)));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Indeterminate)));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(SizeText)));
    }
    private void RaiseStatus()
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Status)));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Error)));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(StatusText)));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(StatusBrush)));
    }

    public string SizeText
    {
        get
        {
            if (Progress < 0) return TotalBytes is { } t ? $"{Human(t)}（总量未知中）" : "下载中…";
            return $"{DoneBytes}/{Human(TotalBytes ?? 0)} {Progress:P0}";
        }
    }

    public string StatusText => Status switch
    {
        "done" => "完成",
        "failed" => Error ?? "失败",
        _ => "下载中"
    };

    /// <summary>状态文字颜色（UI 绑定）。</summary>
    public string StatusBrush => Status switch
    {
        "done" => "#7ee787",
        "failed" => "#f87171",
        _ => "#7c5cff"
    };

    internal static string Human(long bytes) => bytes switch
    {
        < 1024 => $"{bytes} B",
        < 1024 * 1024 => $"{bytes / 1024.0:0.#} KB",
        < 1024 * 1024 * 1024 => $"{bytes / 1024.0 / 1024.0:0.#} MB",
        _ => $"{bytes / 1024.0 / 1024.0 / 1024.0:0.##} GB"
    };
}

/// <summary>历史条目（持久化到 downloads.json）。</summary>
public class DownloadRecord
{
    [JsonPropertyName("url")] public string Url { get; set; } = "";
    [JsonPropertyName("fileName")] public string FileName { get; set; } = "";
    [JsonPropertyName("size")] public long Size { get; set; }
    [JsonPropertyName("completedAt")] public DateTime CompletedAtUtc { get; set; }
}

public static class Downloader
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(30) };

    /// <summary>URL 推导文件名（剥 query、清洗非法字符）。</summary>
    public static string DefaultFileName(string url)
    {
        try
        {
            var u = new Uri(url, UriKind.RelativeOrAbsolute);
            if (!u.IsAbsoluteUri) return "download";
            var name = Path.GetFileName(Uri.UnescapeDataString(u.AbsolutePath));
            if (name.Length == 0) name = Path.GetFileName(Uri.UnescapeDataString(u.Query));
            if (name.Length == 0) return "download";
            foreach (var c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '_');
            return name;
        }
        catch { return "download"; }
    }

    /// <summary>已存在则追加 (n) 后缀。</summary>
    public static string UniquePath(string path)
    {
        if (!File.Exists(path)) return path;
        var dir = Path.GetDirectoryName(path)!;
        var name = Path.GetFileNameWithoutExtension(path);
        var ext = Path.GetExtension(path);
        for (var i = 1; ; i++)
        {
            var candidate = Path.Combine(dir, $"{name}({i}){ext}");
            if (!File.Exists(candidate)) return candidate;
        }
    }

    /// <summary>进度下载；成功返回落盘路径，失败置 Status/Error 并返回 null。</summary>
    public static async Task<string?> SaveToDirectoryAsync(string url, string dir, DownloadTask task, CancellationToken ct)
    {
        try
        {
            using var resp = await Http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!resp.IsSuccessStatusCode)
            {
                task.Status = "failed";
                task.Error = $"HTTP {(int)resp.StatusCode}";
                return null;
            }
            task.TotalBytes = resp.Content.Headers.ContentLength;
            Directory.CreateDirectory(dir);
            var path = UniquePath(Path.Combine(dir, task.FileName));
            await using var outStream = File.Create(path);
            await using var inStream = await resp.Content.ReadAsStreamAsync(ct);
            var buf = new byte[64 * 1024];
            int n;
            while ((n = await inStream.ReadAsync(buf.AsMemory(), ct)) > 0)
            {
                await outStream.WriteAsync(buf.AsMemory(0, n), ct);
                task.DoneBytes += n;
                task.Progress = task.TotalBytes is > 0 ? (double)task.DoneBytes / task.TotalBytes.Value : -1;
            }
            task.Status = "done";
            task.CompletedAtUtc = DateTime.UtcNow;
            return path;
        }
        catch (Exception ex)
        {
            task.Status = "failed";
            task.Error = ex.Message;
            return null;
        }
    }

    public static List<DownloadRecord> LoadHistory(string path)
    {
        try
        {
            if (!File.Exists(path)) return new();
            return JsonSerializer.Deserialize<List<DownloadRecord>>(File.ReadAllText(path)) ?? new();
        }
        catch { return new(); }
    }

    public static void SaveHistory(string path, List<DownloadRecord> history)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonSerializer.Serialize(history,
            new JsonSerializerOptions { WriteIndented = true }));
    }
}
