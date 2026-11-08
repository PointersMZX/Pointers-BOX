// 浏览器页：资源快捷链接 + 自定义网址，均以系统浏览器打开（内嵌浏览器 M5 打磨）

using Avalonia.Controls;
using Avalonia.Interactivity;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class BrowserPage : UserControl
{
    public BrowserPage(DataSnapshot? snapshot)
    {
        InitializeComponent();
        QuickLinkList.ItemsSource = snapshot?.Resources;
    }

    private static void OpenUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "http" && uri.Scheme != "https"))
            return;
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
        }
        catch { }
    }

    private void OpenCustomClick(object? sender, RoutedEventArgs e)
    {
        var url = (UrlBox.Text ?? "").Trim();
        if (url.Length == 0) return;
        if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            url = "https://" + url;
        OpenUrl(url);
    }

    private void QuickLinkClicked(object? sender, RoutedEventArgs e)
    {
        if (sender is Control c && c.Tag is string url) OpenUrl(url);
    }
}
