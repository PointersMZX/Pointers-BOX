using System;
using System.Collections.Generic;
using System.Linq;
using Avalonia.Controls;
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

    private void AddClick(object? sender, RoutedEventArgs e)
    {
        var name = NameBox.Text?.Trim() ?? "";
        var url = UrlBox.Text?.Trim() ?? "";
        if (name.Length == 0 || !url.StartsWith("http")) return;
        _links.Add(new UserLink
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = name,
            Url = url,
            CreatedAt = DateTimeOffset.Now.ToUnixTimeMilliseconds()
        });
        BoxLogic.SaveUserLinks(_path, _links);
        LinkList.ItemsSource = null;
        LinkList.ItemsSource = _links;
        NameBox.Text = "";
        UrlBox.Text = "";
    }

    private void DeleteClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string id }) return;
        var item = _links.FirstOrDefault(l => l.Id == id);
        if (item != null)
        {
            _links.Remove(item);
            BoxLogic.SaveUserLinks(_path, _links);
            LinkList.ItemsSource = null;
            LinkList.ItemsSource = _links;
        }
    }
}
