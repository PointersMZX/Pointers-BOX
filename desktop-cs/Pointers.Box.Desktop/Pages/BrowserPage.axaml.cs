// 浏览器页（v2.6.0 真内嵌）：Windows=WebView2 NativeControlHost 内嵌渲染 + 多标签
// 非 Windows / WebView2 缺失：占位提示（不再跳系统浏览器）
using System;
using System.Collections.Generic;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public class BrowserTab
{
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    /// <summary>该标签的 WebView 实例（懒创建）。</summary>
    public WebView2Host? View { get; set; }
}

public partial class BrowserPage : UserControl
{
    private const string HomeUrl = "https://www.pointers-box.cc.cd/";
    private readonly List<BrowserTab> _tabs = new();
    private int _active = -1;
    private bool _webBroken;

    public BrowserPage(DataSnapshot? _)
    {
        InitializeComponent();
        _tabs.Add(new BrowserTab { Title = "Pointers-BOX", Url = HomeUrl });
        _active = 0;
        RefreshTabs();
        ShowTab(0);
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

    private WebView2Host CreateView(string url)
    {
        var view = new WebView2Host(new Uri(url))
        {
            HorizontalAlignment = HorizontalAlignment.Stretch,
            VerticalAlignment = VerticalAlignment.Stretch,
        };
        view.StatusChanged += (_, msg) =>
        {
            if (!string.IsNullOrEmpty(msg))
            {
                _webBroken = true;
                WebPlaceholder.IsVisible = true;
                StatusLine.Text = $"内嵌组件不可用：{msg}（可复制网址用系统浏览器打开）";
            }
        };
        return view;
    }

    private void ShowTab(int index)
    {
        if (index < 0 || index >= _tabs.Count) return;
        _active = index;
        var tab = _tabs[index];
        WebHost.Child = null;
        try
        {
            tab.View ??= CreateView(tab.Url);
            WebHost.Child = tab.View;
            WebPlaceholder.IsVisible = false;
            if (_webBroken) WebPlaceholder.IsVisible = true;
        }
        catch (Exception e)
        {
            _webBroken = true;
            WebPlaceholder.IsVisible = true;
            StatusLine.Text = $"内嵌组件加载失败：{e.Message}";
        }
        UrlBox.Text = tab.Url;
        RefreshTabs();
    }

    private void RefreshTabs()
    {
        TabBar.IsVisible = _tabs.Count > 1;
        CloseTabBtn.IsVisible = _tabs.Count > 1;
        TabBar.ItemsSource = _tabs.ToList(); // Avalonia 12 坑：置 null 再赋会崩
    }

    private void GoClick(object? sender, RoutedEventArgs e)
    {
        if (_active < 0) return;
        var url = Normalize(UrlBox.Text ?? "");
        var tab = _tabs[_active];
        tab.Url = url;
        try { tab.Title = new Uri(url).Host; } catch { tab.Title = url; }
        if (tab.View != null && !_webBroken) tab.View.Navigate(new Uri(url));
        else ShowTab(_active);
        RefreshTabs();
    }

    private void UrlKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) GoClick(sender, e);
    }

    private void ReloadClick(object? sender, RoutedEventArgs e)
    {
        if (_active >= 0 && _tabs[_active].View != null && !_webBroken)
            _tabs[_active].View!.Navigate(new Uri(_tabs[_active].Url));
    }

    private void NewTabClick(object? sender, RoutedEventArgs e)
    {
        _tabs.Add(new BrowserTab { Title = "新标签", Url = HomeUrl });
        ShowTab(_tabs.Count - 1);
    }

    private void CloseTabClick(object? sender, RoutedEventArgs e)
    {
        if (_tabs.Count <= 1) return;
        var idx = _tabs.Count - 1;
        var tab = _tabs[idx];
        _tabs.RemoveAt(idx);
        tab.View = null; // NativeControlHost 随视觉树分离释放
        if (_active >= _tabs.Count) _active = _tabs.Count - 1;
        ShowTab(_active);
    }

    private void TabClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Button { DataContext: BrowserTab tab })
        {
            var idx = _tabs.IndexOf(tab);
            if (idx >= 0) ShowTab(idx);
        }
    }
}
