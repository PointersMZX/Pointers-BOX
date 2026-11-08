// 设置页：关于应用（简介/通用密钥/QQ群/版权）/ 版本日志 / 主题 / 更新检查 / 下载设置
using System.Linq;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Threading;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class SettingsPage : UserControl
{
    private readonly AppConfig _config;
    private readonly MainWindow _main;
    private DataSnapshot? _snapshot;
    private UpdateCheckResult? _lastCheck;

    public SettingsPage(AppConfig config, MainWindow main)
    {
        InitializeComponent();
        _config = config;
        _main = main;
        ChannelGithub.IsChecked = _config.UpdateChannel == "github";
        ChannelGitee.IsChecked = _config.UpdateChannel != "github";
        KeepHistoryCheck.IsChecked = _config.KeepDownloadHistory;
        HighlightTheme();
    }

    public void UpdateSnapshot(DataSnapshot? snapshot)
    {
        _snapshot = snapshot;
        var box = _snapshot?.Box;
        if (box != null)
        {
            AboutIntro.Text = box.AppIntroduction;
            AboutGeneralKey.Text = string.IsNullOrEmpty(box.GeneralKey) ? "" : $"通用密钥：{box.GeneralKey}";
            QQGroupBtn.Content = string.IsNullOrEmpty(box.CommunityQq) ? "" : box.CommunityQq;
            QQGroupBtn.IsVisible = !string.IsNullOrEmpty(box.CommunityQq);
            AboutCopyright.Text = string.IsNullOrEmpty(box.Copyright) ? "" : box.Copyright;
        }
        var logs = _snapshot?.VersionLogs ?? new System.Collections.Generic.List<VersionLog>();
        NoLogsText.IsVisible = logs.Count == 0;
        VersionLogsFull.ItemsSource = logs;
    }

    private void HighlightTheme()
    {
        foreach (var (btn, key) in new System.Collections.Generic.Dictionary<Button, string>
                 {
                     { ThemeZijin, "zijin" }, { ThemeBlack, "black" }, { ThemeBlue, "blue" }
                 })
        {
            btn.Background = new SolidColorBrush(Color.Parse(_config.Theme == key ? "#33ffffff" : "#14ffffff"));
        }
    }

    // 主题切换（当前玻璃配色仅紫金黑一套，切主题换强调色）
    private void ThemeClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button b || b.Tag is not string key) return;
        _config.Theme = key;
        _main.SaveConfig();
        HighlightTheme();
    }

    private void ChannelChanged(object? sender, RoutedEventArgs e)
    {
        _config.UpdateChannel = ChannelGithub.IsChecked == true ? "github" : "gitee";
        _main.SaveConfig();
    }

    private void KeepHistoryChanged(object? sender, RoutedEventArgs e)
    {
        _config.KeepDownloadHistory = KeepHistoryCheck.IsChecked == true;
        _main.SaveConfig();
    }

    // 社区 QQ 群（对齐旧版 QQ_GROUP_LINK 跳群邀请页）
    private void QQGroupClick(object? sender, RoutedEventArgs e)
    {
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("https://qm.qq.com/q/Y3C8nWKqME") { UseShellExecute = true });
        }
        catch { }
    }

    private async void CheckUpdateClick(object? sender, RoutedEventArgs e)
    {
        UpdateResult.Text = "检查中…";
        OpenReleaseBtn.IsVisible = false;
        var result = await UpdateChecker.CheckAsync(_config.UpdateChannel, "2.6.0");
        _lastCheck = result;
        if (result.Error != null)
        {
            UpdateResult.Text = $"检查更新失败：{result.Error}";
            UpdateResult.Foreground = new SolidColorBrush(Color.Parse("#f87171"));
            return;
        }
        if (result.HasUpdate)
        {
            UpdateResult.Text = $"发现新版本 {result.Latest}（当前 v2.6.0）";
            UpdateResult.Foreground = new SolidColorBrush(Color.Parse("#7ee787"));
            OpenReleaseBtn.IsVisible = true;
        }
        else
        {
            UpdateResult.Text = $"已是最新版本（{result.Latest ?? result.Current}）";
            UpdateResult.Foreground = new SolidColorBrush(Color.Parse("#a99cc4"));
        }
    }

    private void OpenReleaseClick(object? sender, RoutedEventArgs e)
    {
        var url = _lastCheck?.ReleaseUrl ?? (_config.UpdateChannel == "gitee" ? UpdateChecker.GiteePage : UpdateChecker.GithubPage);
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { }
    }
}
