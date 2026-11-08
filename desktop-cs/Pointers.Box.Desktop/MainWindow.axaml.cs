using System;
using System.Linq;
using Avalonia.Controls;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop;

public partial class MainWindow : Window
{
    private readonly DataStore _store;

    public MainWindow()
    {
        InitializeComponent();
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        _store = new DataStore(
            System.IO.Path.Combine(appData, "Pointers-BOX", "cache", "snapshot.json"),
            System.IO.Path.Combine(AppContext.BaseDirectory, "box.mcx"));
        Loaded += async (_, _) => await LoadDataAsync();
    }

    private async System.Threading.Tasks.Task LoadDataAsync()
    {
        try
        {
            var snap = await _store.GetDataAsync();
            if (snap.Resources != null)
            {
                // 推荐：随机抽 4 张（v2.5.0 同构；后续迭代补换一批/密度切换）
                var rnd = new Random();
                RecommendList.ItemsSource = snap.Resources
                    .OrderBy(_ => rnd.Next())
                    .Take(4)
                    .ToList();
            }
            if (snap.Announcement != null)
            {
                AnnouncementText.Text = snap.Announcement.Content;
            }
        }
        catch
        {
            // 离线兜底已在 DataStore 内处理；UI 侧失败静默（M1 迭代补状态栏）
        }
    }
}
