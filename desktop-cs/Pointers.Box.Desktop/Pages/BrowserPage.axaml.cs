// 浏览器页（对齐旧版多标签形态 v2.0.0）：多标签记录 + 地址栏 + 系统浏览器打开
// Avalonia 12 暂无内嵌 WebView 控件（WebView2 内嵌留后续回补）
using System;
using System.Collections.Generic;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public class BrowserTab
{
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public partial class BrowserPage : UserControl
{
    private const string HomeUrl = "https://www.pointers-box.cc.cd/";
    private readonly List<BrowserTab> _tabs = new();

    public BrowserPage(DataSnapshot? _)
    {
        InitializeComponent();
        // 默认一个主页标签（对齐 DEFAULT_START_URL）
        _tabs.Add(new BrowserTab { Title = "Pointers-BOX", Url = HomeUrl });
        RefreshTabs();
    }

    private static string Normalize(string raw)
    {
        var u = raw.Trim();
        if (u.Length == 0) return HomeUrl;
        if (!u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !u.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            u = "https://" + u;
        return u;
    }

    private static void OpenExternal(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "http" && uri.Scheme != "https")) return;
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
        }
        catch { }
    }

    private void RefreshTabs()
    {
        TabBar.IsVisible = _tabs.Count > 1;
        CloseTabBtn.IsVisible = _tabs.Count > 1;
        // Avalonia 12 坑：ItemsSource 先置 null 再赋值会在容器回收时越界崩溃，直接换新集合
        TabBar.ItemsSource = _tabs.ToList();
    }

    private void GoClick(object? sender, RoutedEventArgs e)
    {
        var url = Normalize(UrlBox.Text ?? "");
        OpenExternal(url);
        // 记录到当前会话标签条
        _tabs.Add(new BrowserTab { Title = new Uri(url).Host, Url = url });
        if (_tabs.Count > 8) _tabs.RemoveAt(0);
        RefreshTabs();
        UrlBox.Text = "";
    }

    private void UrlKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) GoClick(sender, e);
    }

    private void ReloadClick(object? sender, RoutedEventArgs e)
    {
        if (_tabs.Count > 0) OpenExternal(_tabs[^1].Url);
    }

    private void NewTabClick(object? sender, RoutedEventArgs e)
    {
        _tabs.Add(new BrowserTab { Title = "新标签", Url = HomeUrl });
        RefreshTabs();
    }

    private void CloseTabClick(object? sender, RoutedEventArgs e)
    {
        if (_tabs.Count > 1) _tabs.RemoveAt(_tabs.Count - 1);
        RefreshTabs();
    }

    private void TabClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Button { DataContext: BrowserTab tab }) OpenExternal(tab.Url);
    }

    private void OpenHomeClick(object? sender, RoutedEventArgs e) => OpenExternal(HomeUrl);
}
