using System.Collections.Generic;
// 主页：今日推荐（4 张随机+换一批）、公告、数据状态

using System.Linq;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class HomePage : UserControl
{
    private DataSnapshot? _snapshot;
    private AppConfig _config = new();
    private System.Collections.Generic.List<Resource> _recommends = new();

    public HomePage()
    {
        InitializeComponent();
    }

    public void UpdateSnapshot(DataSnapshot? snapshot, AppConfig config)
    {
        _snapshot = snapshot;
        _config = config;
        _recommends = BoxLogic.PickRecommends(snapshot?.Resources ?? new List<Resource>(), 4);
        Bind();
    }

    private void Bind()
    {
        RecommendList.ItemsSource = _recommends;
        if (_snapshot?.Announcement != null)
        {
            AnnouncementText.Text = _snapshot.Announcement.Content;
            AnnouncementCard.IsVisible = true;
        }
        else
        {
            AnnouncementCard.IsVisible = false;
        }
        if (_snapshot != null)
        {
            StatusText.Text = _snapshot.Offline ? "离线（展示本地缓存）" : "在线";
            StatusText.Foreground = new Avalonia.Media.SolidColorBrush(
                Avalonia.Media.Color.Parse(_snapshot.Offline ? "#d29922" : "#7ee787"));
        }
    }

    private void ShuffleClick(object? sender, RoutedEventArgs e)
    {
        _recommends = BoxLogic.PickRecommends(_snapshot?.Resources ?? new List<Resource>(), 4);
        RecommendList.ItemsSource = _recommends;
    }
}
