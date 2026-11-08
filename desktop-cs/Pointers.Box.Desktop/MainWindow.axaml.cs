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
        _ = LoadDataAsync();
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
                btn.Background = name == activeName ? new SolidColorBrush(Color.Parse("#2a2135")) : null;
                btn.Foreground = name == activeName ? new SolidColorBrush(Color.Parse("#f0eaf8")) : new SolidColorBrush(Color.Parse("#a99cc4"));
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
