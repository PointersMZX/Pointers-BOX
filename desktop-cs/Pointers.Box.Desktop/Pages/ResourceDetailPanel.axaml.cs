// 资源详情页内面板（用户反馈：模态双重窗口+置顶令人反感 → 改页内切换，返回即回列表）
// 名称/元信息/简介/分享项「领取」（不露明文链接）+ 收藏
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class ResourceDetailPanel : UserControl
{
    private readonly Resource _resource;
    private readonly System.Collections.Generic.List<string> _favorites;
    private readonly MainWindow _main;

    /// <summary>点返回时回调（宿主页切回列表视图）。</summary>
    public event EventHandler? CloseRequested;

    public ResourceDetailPanel(Resource resource, System.Collections.Generic.List<string> favorites, MainWindow main)
    {
        InitializeComponent();
        _resource = resource;
        _favorites = favorites;
        _main = main;

        DetailName.Text = resource.Name;
        DetailMeta.Text = string.Join(" · ",
            new[] {
                string.IsNullOrEmpty(resource.Category) ? null : resource.Category,
                string.IsNullOrEmpty(resource.ReleaseDate) ? null : resource.ReleaseDate,
                $"序号 {HomePage.IdStr(resource)}"
            }.Where(s => !string.IsNullOrEmpty(s)));
        DetailIntro.Text = string.IsNullOrEmpty(resource.Introduction) ? "（暂无介绍）" : resource.Introduction;

        var shares = resource.Shares?.Count > 0
            ? resource.Shares.Select(s => s.Name).ToList()
            : resource.Links.Select((_, i) => $"分享项 {i + 1}").ToList();
        for (var i = 0; i < shares.Count; i++)
        {
            var idx = i;
            var row = new Border
            {
                Background = new SolidColorBrush(Color.Parse("#14241c2e")),
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(12, 8, 12, 8)
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
                VerticalAlignment = VerticalAlignment.Center,
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
        FavButton.Content = favorites.Contains(HomePage.IdStr(resource)) ? "★ 已收藏" : "☆ 收藏";
    }

    // 领取：直接打开分享链接（不露明文）
    private void ClaimClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button b || b.Tag is not int idx) return;
        string? url = null;
        if (_resource.Shares?.Count > 0 && idx < _resource.Shares.Count) url = _resource.Shares[idx].Url;
        else if (idx < _resource.Links.Count) url = _resource.Links[idx];
        if (string.IsNullOrEmpty(url)) return;
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { }
    }

    private void FavClick(object? sender, RoutedEventArgs e)
    {
        HomePage.ToggleFavStatic(_resource, _favorites, _main);
        FavButton.Content = _favorites.Contains(HomePage.IdStr(_resource)) ? "★ 已收藏" : "☆ 收藏";
    }

    private void CloseClick(object? sender, RoutedEventArgs e) => CloseRequested?.Invoke(this, EventArgs.Empty);
}
