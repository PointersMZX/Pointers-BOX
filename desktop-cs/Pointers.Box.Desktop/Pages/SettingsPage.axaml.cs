// 设置页：关于应用（简介/通用密钥/QQ群/版权）/ 版本日志（可折叠）/ 主题（四套+玻璃开关+自定义颜色）/ 更新检查 / 下载设置
using System.Linq;
using Avalonia.Controls;
using Avalonia.Input;
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
    private bool _fullLogsExpanded = true;

    // 自定义主题预设色（对齐旧版 ACCENT_PRESETS）
    private static readonly string[] AccentPresets =
    {
        "#7c5cff", "#e659a8", "#c084fc", "#3182ce", "#00b3a4", "#f59e0b", "#64748b", "#94a3b8"
    };

    public SettingsPage(AppConfig config, MainWindow main)
    {
        InitializeComponent();
        _config = config;
        _main = main;
        ChannelGithub.IsChecked = _config.UpdateChannel == "github";
        ChannelGitee.IsChecked = _config.UpdateChannel != "github";
        KeepHistoryCheck.IsChecked = _config.KeepDownloadHistory;
        HighlightTheme();
        RefreshAccentPanel();
        BuildPresetRow();
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
        VersionLogsFull.IsVisible = logs.Count > 0 && _fullLogsExpanded;
        FullLogsToggle.Text = _fullLogsExpanded ? "收起 ▴" : "展开 ▾";
    }

    // 版本日志折叠
    private void ToggleFullLogsClick(object? sender, PointerPressedEventArgs e)
    {
        _fullLogsExpanded = !_fullLogsExpanded;
        var logs = _snapshot?.VersionLogs ?? new System.Collections.Generic.List<VersionLog>();
        VersionLogsFull.IsVisible = logs.Count > 0 && _fullLogsExpanded;
        FullLogsToggle.Text = _fullLogsExpanded ? "收起 ▴" : "展开 ▾";
    }

    private void HighlightTheme()
    {
        foreach (var (btn, key) in new System.Collections.Generic.Dictionary<Button, string>
                 {
                     { ThemeZijin, "zijin" }, { ThemeCustom, "custom" },
                     { ThemeBlack, "black" }, { ThemeWhite, "white" }
                 })
        {
            btn.Background = new SolidColorBrush(Color.Parse(_config.Theme == key ? "#33ffffff" : "#14ffffff"));
        }
        // 玻璃开关（紫金黑锁死开，禁用勾选）
        GlassToggle.IsChecked = _config.GlassOn;
        GlassToggle.IsEnabled = _config.Theme != "zijin";
        GlassHint.Text = _config.Theme == "zijin" ? "（紫金黑主题锁死开启，不可关闭）" : "（切玻璃可开关液态玻璃质感）";
    }

    // 主题切换（对齐旧版 setAppearance：紫金黑玻璃锁死开；纯黑/纯白玻璃默认关）
    private void ThemeClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button b || b.Tag is not string key) return;
        _config.Theme = key;
        // 按主题默认值带玻璃开关（纯黑/纯白=关；紫金黑=锁死开；自定义=保留用户选择）
        if (key == "black" || key == "white") _config.LiquidGlass = false;
        else if (key == "zijin") _config.LiquidGlass = true;
        _main.SaveConfig();
        ThemeManager.Instance.Apply(_config);
        _main.ApplyChrome(_config);
        HighlightTheme();
        RefreshAccentPanel();
    }

    // 液态玻璃开关（按主题记忆；紫金黑禁用）
    private void GlassToggleClick(object? sender, RoutedEventArgs e)
    {
        if (_config.Theme == "zijin") { GlassToggle.IsChecked = true; return; }
        _config.LiquidGlass = GlassToggle.IsChecked == true;
        _main.SaveConfig();
        ThemeManager.Instance.Apply(_config);
        _main.ApplyChrome(_config);
    }

    private void RefreshAccentPanel()
    {
        AccentPanel.IsVisible = _config.Theme == "custom";
        if (_config.Theme == "custom") AccentHex.Text = _config.Accent;
        AccentSwatch.Background = new SolidColorBrush(Color.Parse(_config.Accent.Length >= 4 ? _config.Accent : "#7c5cff"));
    }

    private void BuildPresetRow()
    {
        PresetRow.Children.Clear();
        foreach (var c in AccentPresets)
        {
            var color = c;
            var btn = new Button
            {
                Width = 30, Height = 30,
                CornerRadius = new Avalonia.CornerRadius(15),
                Background = new SolidColorBrush(Color.Parse(c)),
                BorderBrush = new SolidColorBrush(Color.Parse(color == _config.Accent ? "#ffffff" : "#44ffffff")),
                BorderThickness = new Avalonia.Thickness(color == _config.Accent ? 2 : 1),
                Padding = new Avalonia.Thickness(0),
                Tag = c
            };
            btn.Click += PresetClick;
            PresetRow.Children.Add(btn);
        }
    }

    private void PresetClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button b || b.Tag is not string c) return;
        SetAccent(c);
    }

    private void AccentHexKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter) return;
        var v = (AccentHex.Text ?? "").Trim();
        if (System.Text.RegularExpressions.Regex.IsMatch(v, @"^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$"))
            SetAccent(v);
    }

    private void SetAccent(string hex)
    {
        _config.Accent = hex;
        _main.SaveConfig();
        ThemeManager.Instance.Apply(_config);
        _main.ApplyChrome(_config);
        RefreshAccentPanel();
        BuildPresetRow();
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
