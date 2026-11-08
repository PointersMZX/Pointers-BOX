// 链接页：添加走弹窗（AddLinkWindow），行内打开/删除；点行也打开
using System;
using System.Collections.Generic;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class LinksPage : UserControl
{
    private readonly string _path;
    private List<UserLink> _links;

    public LinksPage(string path, List<UserLink> links)
    {
        InitializeComponent();
        _path = path;
        _links = links;
        LinkList.ItemsSource = _links;
    }

    private async void AddOpenClick(object? sender, RoutedEventArgs e)
    {
        var dlg = new AddLinkWindow();
        if (await dlg.ShowDialog<bool>(App.MainWindow!) == true)
        {
            var name = dlg.LinkName.Trim();
            var url = dlg.LinkUrl.Trim();
            var remark = dlg.LinkRemark.Trim();
            if (name.Length == 0 || !url.StartsWith("http")) return;
            if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                url = "https://" + url;
            _links.Insert(0, new UserLink
            {
                Id = Guid.NewGuid().ToString("N"),
                Name = name,
                Url = url,
                Remark = remark,
                CreatedAt = DateTimeOffset.Now.ToUnixTimeMilliseconds()
            });
            BoxLogic.SaveUserLinks(_path, _links);
            LinkList.ItemsSource = _links.ToList(); // Avalonia 12 坑：置 null 再赋会崩
        }
    }

    private void OpenLink(string? url)
    {
        if (string.IsNullOrEmpty(url)) return;
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { }
    }

    private void OpenClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: string url }) OpenLink(url);
    }

    private void OpenLinkClick(object? sender, PointerPressedEventArgs e)
    {
        if (sender is StackPanel { Tag: string url }) OpenLink(url);
    }

    private void DeleteClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string id }) return;
        var item = _links.FirstOrDefault(l => l.Id == id);
        if (item != null)
        {
            _links.Remove(item);
            BoxLogic.SaveUserLinks(_path, _links);
            LinkList.ItemsSource = _links.ToList(); // Avalonia 12 坑：置 null 再赋会崩
        }
    }
}
