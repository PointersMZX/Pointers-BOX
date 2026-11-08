using System;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media;
using Pointers.Box.Core;
using Pointers.Box.Desktop.Pages;

namespace Pointers.Box.Desktop;

public partial class MainWindow : Window
{
    private readonly DataStore _store;
    private readonly string _linksPath;
    private readonly string _configPath;
    private readonly string _historyPath;
    private DataSnapshot? _snapshot;
    private AppConfig _config = new();
    private System.Collections.Generic.List<UserLink> _userLinks = new();

    public MainWindow()
    {
        InitializeComponent();
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var baseDir = System.IO.Path.Combine(appData, "Pointers-BOX");
        _store = new DataStore(
            System.IO.Path.Combine(baseDir, "cache", "snapshot.json"),
            System.IO.Path.Combine(AppContext.BaseDirectory, "box.mcx"));
        _linksPath = System.IO.Path.Combine(baseDir, "user-links.json");
        _configPath = System.IO.Path.Combine(baseDir, "config.json");
        _historyPath = System.IO.Path.Combine(baseDir, "downloads.json");
        _userLinks = BoxLogic.LoadUserLinks(_linksPath);
        _config = LoadConfig();
        HighlightNav("NavHome");
        StartOrbDrift();
        _ = LoadDataAsync();
    }

    // 柔光球慢速漂移（05 号参考：只动 RenderTransform，合成器零成本）
    private Avalonia.Threading.DispatcherTimer? _orbTimer;
    private double _orbPhase;
    private void StartOrbDrift()
    {
        _orbTimer = new Avalonia.Threading.DispatcherTimer(TimeSpan.FromMilliseconds(33),
            Avalonia.Threading.DispatcherPriority.Background,
            (_, _) =>
            {
                _orbPhase += 0.004; // 慢炖节奏（timeScale 低）
                var p = _orbPhase;
                if (OrbA != null)
                    OrbA.RenderTransform = new TranslateTransform(
                        Math.Sin(p) * 70, Math.Cos(p * 0.7) * 46);
                if (OrbB != null)
                    OrbB.RenderTransform = new TranslateTransform(
                        Math.Cos(p * 0.8) * -60, Math.Sin(p * 0.6) * -40);
                if (OrbC != null)
                    OrbC.RenderTransform = new TranslateTransform(
                        Math.Sin(p * 1.3) * 40, Math.Cos(p * 0.9) * 34);
            });
        _orbTimer.Start();
    }

    private AppConfig LoadConfig()
    {
        try
        {
            if (System.IO.File.Exists(_configPath))
                return System.Text.Json.JsonSerializer.Deserialize<AppConfig>(
                    System.IO.File.ReadAllText(_configPath),
                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new AppConfig();
        }
        catch { }
        return new AppConfig();
    }

    public void SaveConfig()
    {
        try
        {
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(_configPath)!);
            System.IO.File.WriteAllText(_configPath,
                System.Text.Json.JsonSerializer.Serialize(_config,
                    new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
        }
        catch { }
    }

    private async System.Threading.Tasks.Task LoadDataAsync()
    {
        try
        {
            _snapshot = await _store.GetDataAsync();
            if (PageHost.Content is HomePage home) home.UpdateSnapshot(_snapshot, _config);
            if (PageHost.Content is ResourcesPage res) res.UpdateSnapshot(_snapshot);
        }
        catch { }
    }

    private void HighlightNav(string activeName)
    {
        foreach (var name in new[] { "NavHome", "NavResources", "NavLinks", "NavBrowser", "NavDownloads", "NavSettings" })
        {
            if (this.FindControl<Button>(name) is { } btn)
            {
                // 玻璃导航选中态：亮边框+亮底（玻璃高亮）
                btn.Background = name == activeName
                    ? new SolidColorBrush(Color.Parse("#33ffffff"))
                    : new SolidColorBrush(Color.Parse("#14ffffff"));
                btn.BorderBrush = name == activeName
                    ? new SolidColorBrush(Color.Parse("#8cffffff"))
                    : new SolidColorBrush(Color.Parse("#1affffff"));
                btn.Foreground = name == activeName
                    ? new SolidColorBrush(Color.Parse("#f0eaf8"))
                    : new SolidColorBrush(Color.Parse("#a99cc4"));
            }
        }
    }

    private void NavClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Name == null) return;
        HighlightNav(btn.Name);
        switch (btn.Name)
        {
            case "NavHome":
                var home = new HomePage();
                home.UpdateSnapshot(_snapshot, _config);
                PageHost.Content = home;
                break;
            case "NavResources":
                var res = new ResourcesPage();
                res.UpdateSnapshot(_snapshot);
                PageHost.Content = res;
                break;
            case "NavLinks":
                PageHost.Content = new LinksPage(_linksPath, _userLinks);
                break;
            case "NavSettings":
                PageHost.Content = new SettingsPage(_config, this);
                break;
            case "NavBrowser":
                PageHost.Content = new BrowserPage(_snapshot);
                break;
            case "NavDownloads":
                PageHost.Content = new DownloadsPage(_config, this, _historyPath);
                break;
        }
    }

    public void SaveLinks()
    {
        BoxLogic.SaveUserLinks(_linksPath, _userLinks);
    }
}
