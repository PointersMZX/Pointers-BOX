// 下载页：下载目录选择 + 任务进度 + 历史（对齐规格：桌面=原路径选择+历史）

using System.Collections.ObjectModel;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class DownloadsPage : UserControl
{
    private readonly AppConfig _config;
    private readonly MainWindow _main;
    private readonly string _historyPath;
    private readonly ObservableCollection<DownloadTask> _active = new();
    private readonly List<DownloadRecord> _history;
    private string _dir;

    public DownloadsPage(AppConfig config, MainWindow main, string historyPath)
    {
        InitializeComponent();
        _config = config;
        _main = main;
        _historyPath = historyPath;
        _history = Downloader.LoadHistory(historyPath);
        _dir = string.IsNullOrWhiteSpace(config.DownloadDir)
            ? System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads")
            : config.DownloadDir;

        DirText.Text = _dir;
        TaskList.ItemsSource = _active;
        RefreshHistory();
    }

    private void ApplyDirClick(object? sender, RoutedEventArgs e)
    {
        var dir = (DirBox.Text ?? "").Trim();
        if (dir.Length == 0) return;
        _dir = dir;
        _config.DownloadDir = dir;
        _main.SaveConfig();
        DirText.Text = dir;
        DirBox.Clear();
    }

    private void StartClick(object? sender, RoutedEventArgs e)
    {
        var url = (UrlBox.Text ?? "").Trim();
        if (url.Length == 0) return;
        if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            url = "https://" + url;

        var task = new DownloadTask
        {
            Url = url,
            FileName = Downloader.DefaultFileName(url),
            Dir = _dir
        };
        _active.Insert(0, task);
        NoTaskText.IsVisible = false;
        UrlBox.Clear();
        _ = DownloadAsync(task);
    }

    private async Task DownloadAsync(DownloadTask task)
    {
        var path = await Downloader.SaveToDirectoryAsync(task.Url, task.Dir, task, CancellationToken.None);
        Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(() =>
        {
            if (path != null && _config.KeepDownloadHistory)
            {
                _history.Insert(0, new DownloadRecord
                {
                    Url = task.Url,
                    FileName = task.FileName,
                    Size = task.DoneBytes,
                    CompletedAtUtc = task.CompletedAtUtc ?? DateTime.UtcNow
                });
                Downloader.SaveHistory(_historyPath, _history);
                RefreshHistory();
            }
            // 活动列表只留最近 10 条（完成/失败行保留可见）
            while (_active.Count > 10) _active.RemoveAt(_active.Count - 1);
        });
    }

    private void RefreshHistory()
    {
        HistoryList.ItemsSource = _history;
        NoHistoryText.IsVisible = _history.Count == 0;
    }

    private void OpenDirClick(object? sender, RoutedEventArgs e)
    {
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = OperatingSystem.IsWindows() ? "explorer.exe" : OperatingSystem.IsMacOS() ? "open" : "xdg-open",
                Arguments = _dir,
                UseShellExecute = true
            });
        }
        catch { }
    }

    private void DeleteRecordClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Control c && c.Tag is DownloadRecord r && _history.Remove(r))
        {
            Downloader.SaveHistory(_historyPath, _history);
            RefreshHistory();
        }
    }

    private void ClearHistoryClick(object? sender, RoutedEventArgs e)
    {
        _history.Clear();
        Downloader.SaveHistory(_historyPath, _history);
        RefreshHistory();
    }
}
