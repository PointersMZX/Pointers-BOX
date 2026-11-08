// 资源详情弹窗（对齐旧版 ResourceDetailModal v2.4.0 行为）：
// 名称/序号/介绍/分类/日期 + 分享项「领取」入口（不展示明文链接）+ 收藏切换
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Interactivity;
using Avalonia.Media;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class ResourceDetailWindow : Window
{
    private readonly Resource _resource;
    private readonly HomePage _home;

    public ResourceDetailWindow(Resource resource, System.Collections.Generic.List<string> favorites, HomePage home)
    {
        InitializeComponent();
        _resource = resource;
        _home = home;
        Title = $"资源详情 - {resource.Name}";

        var shares = resource.Shares?.Count > 0
            ? resource.Shares.Select(s => s.Name).ToList()
            : resource.Links.Select((_, i) => $"分享项 {i + 1}").ToList();

        DetailName.Text = resource.Name;
        DetailMeta.Text = string.Join(" · ",
            new[] {
                string.IsNullOrEmpty(resource.Category) ? null : resource.Category,
                string.IsNullOrEmpty(resource.ReleaseDate) ? null : resource.ReleaseDate,
                $"序号 {IdText(resource)}"
            }.Where(s => !string.IsNullOrEmpty(s)));
        DetailIntro.Text = string.IsNullOrEmpty(resource.Introduction) ? "（暂无介绍）" : resource.Introduction;

        // 分享行：代码构建（带索引 Tag，领取按索引取真实链接）
        ShareList.Children.Clear();
        for (var i = 0; i < shares.Count; i++)
        {
            var idx = i;
            var row = new Border
            {
                Background = new SolidColorBrush(Color.Parse("#14241c2e")),
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(12, 8, 12, 8),
                Margin = new Thickness(0, 0, 0, 8)
            };
            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));
            grid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
            grid.ColumnSpacing = 8;
            var name = new TextBlock
            {
                Text = shares[i],
                FontSize = 13,
                Foreground = new SolidColorBrush(Color.Parse("#f0eaf8")),
                VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center,
                TextTrimming = TextTrimming.CharacterEllipsis
            };
            var claim = new Button { Content = "领取", Tag = idx };
            claim.Click += ClaimClick;
            Grid.SetColumn(name, 0);
            Grid.SetColumn(claim, 1);
            grid.Children.Add(name);
            grid.Children.Add(claim);
            row.Child = grid;
            ShareList.Children.Add(row);
        }
        // 收藏星标
        var id = HomePage.IdStr(resource);
        FavButton.Content = favorites.Contains(id) ? "★ 已收藏" : "☆ 收藏";
    }

    private static string IdText(Resource r) => r.Id?.ToString() ?? "";

    // 领取：直接打开分享链接（旧版桌面=openClaim 拉系统浏览器）
    private void ClaimClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button b) return;
        string? url = null;
        if (b.Tag is int idx)
        {
            if (_resource.Shares?.Count > 0 && idx < _resource.Shares.Count) url = _resource.Shares[idx].Url;
            else if (idx < _resource.Links.Count) url = _resource.Links[idx];
        }
        if (string.IsNullOrEmpty(url)) return;
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { }
    }

    private void FavClick(object? sender, RoutedEventArgs e)
    {
        _home.ToggleFav(_resource);
        FavButton.Content = _main.FavoritesList.Contains(HomePage.IdStr(_resource)) ? "★ 已收藏" : "☆ 收藏";
    }

    private MainWindow _main => App.MainWindow;

    private void CloseClick(object? sender, RoutedEventArgs e) => Close();
}
