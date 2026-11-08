// 主页：7 张标签卡（今日推荐/公告/数据状态/版本日志/我的收藏/快捷入口）+ 堆叠/紧凑/宽展布局
// + 资源详情弹窗（点开卡片）+ 收藏切换（☆/★）

using System;
using System.Collections.Generic;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia;
using Avalonia.Media;
using Avalonia.Controls.Shapes;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class HomePage : UserControl
{
    private DataSnapshot? _snapshot;
    private AppConfig _config = new();
    private List<Resource> _recommends = new();
    private List<string> _favorites = new();
    private MainWindow _main = null!;

    public HomePage()
    {
        InitializeComponent();
    }

    public void UpdateSnapshot(DataSnapshot? snapshot, AppConfig config, List<string> favorites, MainWindow main)
    {
        _snapshot = snapshot;
        _config = config;
        _favorites = favorites;
        _main = main;
        _recommends = BoxLogic.PickRecommends(snapshot?.Resources ?? new List<Resource>(), 4);
        Bind();
    }

    private void Bind()
    {
        // 布局按钮选中态
        LayoutStacked.Background = new SolidColorBrush(Color.Parse(_config.HomeLayout == "stacked" ? "#33ffffff" : "#14ffffff"));
        LayoutCompact.Background = new SolidColorBrush(Color.Parse(_config.HomeLayout == "compact" ? "#33ffffff" : "#14ffffff"));
        LayoutWide.Background = new SolidColorBrush(Color.Parse(_config.HomeLayout == "wide" ? "#33ffffff" : "#14ffffff"));

        // 推荐卡数量：堆叠=2、其他=4
        var count = _config.HomeLayout == "stacked" ? 2 : 4;
        if (_recommends.Count > count) _recommends = _recommends.Take(count).ToList();
        RecommendList.ItemsSource = _recommends;

        // 公告
        if (_snapshot?.Announcement != null)
        {
            AnnouncementText.Text = $"{_snapshot.Announcement.Date}\n{_snapshot.Announcement.Content}";
            AnnouncementCard.IsVisible = true;
        }
        else AnnouncementCard.IsVisible = false;

        // 数据状态 + 渠道
        if (_snapshot != null)
        {
            StatusText.Text = _snapshot.Offline ? "离线（展示本地缓存）" : "在线";
            StatusText.Foreground = new SolidColorBrush(Color.Parse(_snapshot.Offline ? "#d29922" : "#7ee787"));
        }
        ChannelText.Text = $"更新渠道：{(_config.UpdateChannel == "gitee" ? "国内镜像（Gitee）" : "全球官方（GitHub）")}";

        // 版本日志（最近 2 条）
        var logs = _snapshot?.VersionLogs ?? new List<VersionLog>();
        VersionLogsCard.IsVisible = logs.Count > 0;
        if (logs.Count > 0)
        {
            VersionLogsCount.Text = $"共 {logs.Count} 条 · 完整日志见设置页";
            VersionLogsList.Children.Clear();
            foreach (var v in logs.Take(2))
            {
                var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Margin = new Thickness(0, 0, 0, 6) };
                var badge = new Border
                {
                    Background = new SolidColorBrush(Color.Parse("#337c5cff")),
                    CornerRadius = new CornerRadius(10),
                    Padding = new Thickness(8, 2, 8, 2),
                    VerticalAlignment = VerticalAlignment.Top,
                    Child = new TextBlock { Text = v.Version, FontSize = 11, Foreground = new SolidColorBrush(Color.Parse("#c9bfe0")) }
                };
                var text = new TextBlock { Text = v.Log, FontSize = 12, Foreground = new SolidColorBrush(Color.Parse("#a99cc4")), TextWrapping = TextWrapping.Wrap, MaxHeight = 56, TextTrimming = TextTrimming.CharacterEllipsis };
                row.Children.Add(badge);
                row.Children.Add(text);
                VersionLogsList.Children.Add(row);
            }
        }

        // 我的收藏
        var favResources = (_snapshot?.Resources ?? new List<Resource>())
            .Where(r => _favorites.Contains(IdStr(r))).ToList();
        FavoritesCard.IsVisible = favResources.Count > 0;
        if (favResources.Count > 0) FavoritesList.ItemsSource = favResources.Take(8).ToList();
    }

    internal static string IdStr(Resource r) => r.Id?.ToString() ?? "";

    // ── 详情弹窗（功3：资源点得开） ──
    private void ResourceClick(object? sender, PointerPressedEventArgs e)
    {
        Resource? r = null;
        if (sender is Border b)
        {
            r = b.DataContext as Resource;
        }
        if (r == null) return;
        _ = new ResourceDetailWindow(r, _favorites, this).ShowDialog(App.MainWindow);
    }

    public void ToggleFav(Resource r)
    {
        var id = IdStr(r);
        if (_favorites.Contains(id)) _favorites.Remove(id);
        else _favorites.Add(id);
        _main.SaveFavorites();
        // 刷新星标（重新绑定推荐列表；Avalonia 12 坑：ItemsSource 置 null 再赋会崩，直接换新集合）
        RecommendList.ItemsSource = _recommends.ToList();
    }

    // 收藏星标点击（在推荐卡内）
    public void FavClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Button b && b.Tag is Resource r) ToggleFav(r);
        e.Handled = true;
    }

    private void ShuffleClick(object? sender, RoutedEventArgs e)
    {
        _recommends = BoxLogic.PickRecommends(_snapshot?.Resources ?? new List<Resource>(), _config.HomeLayout == "stacked" ? 2 : 4);
        RecommendList.ItemsSource = _recommends;
    }

    // 布局切换
    private void LayoutClick(object? sender, RoutedEventArgs e)
    {
        var key = sender == LayoutStacked ? "stacked" : sender == LayoutCompact ? "compact" : "wide";
        _config.HomeLayout = key;
        _main.SaveConfig();
        _recommends = BoxLogic.PickRecommends(_snapshot?.Resources ?? new List<Resource>(), key == "stacked" ? 2 : 4);
        Bind();
    }

    // 快捷入口
    private void QuickResources(object? sender, RoutedEventArgs e) => _main.Navigate("NavResources");
    private void QuickLinks(object? sender, RoutedEventArgs e) => _main.Navigate("NavLinks");
    private void QuickBrowser(object? sender, RoutedEventArgs e) => _main.Navigate("NavBrowser");
    private void QuickDownloads(object? sender, RoutedEventArgs e) => _main.Navigate("NavDownloads");
}
