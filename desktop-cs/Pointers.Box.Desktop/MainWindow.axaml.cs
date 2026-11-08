using System;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Platform;
using Pointers.Box.Core;
using Pointers.Box.Desktop.Pages;

namespace Pointers.Box.Desktop;

public partial class MainWindow : Window
{
    private readonly DataStore _store;
    private readonly string _linksPath;
    private readonly string _favoritesPath;
    private readonly string _configPath;
    private readonly string _historyPath;
    private DataSnapshot? _snapshot;
    private AppConfig _config = new();
    private System.Collections.Generic.List<UserLink> _userLinks = new();
    private System.Collections.Generic.List<string> _favorites = new();

    public MainWindow()
    {
        InitializeComponent();
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var baseDir = System.IO.Path.Combine(appData, "Pointers-BOX");
        _store = new DataStore(
            System.IO.Path.Combine(baseDir, "cache", "snapshot.json"),
            System.IO.Path.Combine(AppContext.BaseDirectory, "box.mcx"));
        _linksPath = System.IO.Path.Combine(baseDir, "user-links.json");
        _favoritesPath = System.IO.Path.Combine(baseDir, "favorites.json");
        _configPath = System.IO.Path.Combine(baseDir, "config.json");
        _historyPath = System.IO.Path.Combine(baseDir, "downloads.json");
        _userLinks = BoxLogic.LoadUserLinks(_linksPath);
        _favorites = Favorites.Load(_favoritesPath);
        _config = LoadConfig();
        HighlightNav("NavHome");
        StartOrbDrift();
        InitTray();
        Navigate("NavHome"); // 启动默认进首页（启动空白页是漏洞）
        _ = LoadDataAsync();
    }

    // ── 托盘后台（对齐旧版 tray.ts：显示窗口/资源库/设置/退出） ──
    private TrayIcon? _tray;
    private bool _quitting;

    private void InitTray()
    {
        try
        {
            var uri = new Uri("avares://Pointers.Box.Desktop/Assets/tray.png");
            using var stream = AssetLoader.Open(uri);
            var icon = new WindowIcon(stream);
            _tray = new TrayIcon { Icon = icon, ToolTipText = "Pointers-BOX" };
            var menu = new NativeMenu();
            var miShow = new NativeMenuItem("显示窗口");
            miShow.Click += (_, _) => ShowMainWindow();
            var miLib = new NativeMenuItem("打开资源库");
            miLib.Click += (_, _) => { ShowMainWindow(); Navigate("NavResources"); };
            var miSet = new NativeMenuItem("设置");
            miSet.Click += (_, _) => { ShowMainWindow(); Navigate("NavSettings"); };
            var quit = new NativeMenuItem("退出");
            quit.Click += (_, _) => { _quitting = true; Close(); };
            menu.Items.Add(miShow);
            menu.Items.Add(miLib);
            menu.Items.Add(miSet);
            menu.Items.Add(new NativeMenuItemSeparator());
            menu.Items.Add(quit);
            _tray.Menu = menu;
            _tray.Clicked += (_, _) => ShowMainWindow();
        }
        catch { }
    }

    private void ShowMainWindow()
    {
        if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
        Show();
        Activate();
        Focus();
    }

    // 点关闭=隐藏到托盘（后台保留），托盘菜单「退出」才真退出
    protected override void OnClosing(WindowClosingEventArgs e)
    {
        if (!_quitting)
        {
            e.Cancel = true;
            Hide();
            return;
        }
        _tray?.Dispose();
        base.OnClosing(e);
    }

    // ── 柔光球漂移动画 ──
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
            if (PageHost.Content is HomePage home) home.UpdateSnapshot(_snapshot, _config, _favorites, this);
            if (PageHost.Content is ResourcesPage res) res.UpdateSnapshot(_snapshot);
            if (PageHost.Content is SettingsPage set) set.UpdateSnapshot(_snapshot);
        }
        catch { }
    }

    // ── 快捷键 Ctrl+1/2/3/5/6（首页/资源/链接/下载/设置，对齐旧版 PRD 2.3） ──
    protected override void OnKeyDown(Avalonia.Input.KeyEventArgs e)
    {
        if (e.KeyModifiers.HasFlag(Avalonia.Input.KeyModifiers.Control))
        {
            var name = e.Key switch
            {
                Avalonia.Input.Key.D1 or Avalonia.Input.Key.NumPad1 => "NavHome",
                Avalonia.Input.Key.D2 or Avalonia.Input.Key.NumPad2 => "NavResources",
                Avalonia.Input.Key.D3 or Avalonia.Input.Key.NumPad3 => "NavLinks",
                Avalonia.Input.Key.D4 or Avalonia.Input.Key.NumPad4 => "NavDownloads",
                Avalonia.Input.Key.D5 or Avalonia.Input.Key.NumPad5 => "NavSettings",
                _ => null
            };
            if (name != null) { Navigate(name); e.Handled = true; return; }
        }
        base.OnKeyDown(e);
    }

    public void SaveFavorites()
    {
        Favorites.Save(_favoritesPath, _favorites);
    }

    public System.Collections.Generic.List<string> FavoritesList => _favorites;

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

    public void Navigate(string navName)
    {
        HighlightNav(navName);
        switch (navName)
        {
            case "NavHome":
                var home = new HomePage();
                home.UpdateSnapshot(_snapshot, _config, _favorites, this);
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
                var set = new SettingsPage(_config, this);
                set.UpdateSnapshot(_snapshot);
                PageHost.Content = set;
                break;
            case "NavBrowser":
                PageHost.Content = new BrowserPage(_snapshot);
                break;
            case "NavDownloads":
                PageHost.Content = new DownloadsPage(_config, this, _historyPath);
                break;
        }
    }

    private void NavClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Name == null) return;
        Navigate(btn.Name);
    }

    public void SaveLinks()
    {
        BoxLogic.SaveUserLinks(_linksPath, _userLinks);
    }
}
