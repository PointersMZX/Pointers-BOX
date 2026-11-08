using System.Collections.Generic;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class ResourcesPage : UserControl
{
    private List<Resource> _all = new();
    private string? _category;
    private MainWindow _main = null!;

    public ResourcesPage()
    {
        InitializeComponent();
    }

    public void UpdateSnapshot(DataSnapshot? snapshot)
    {
        _all = snapshot?.Resources ?? new List<Resource>();
        var cats = _all.Select(r => r.Category).Where(c => !string.IsNullOrEmpty(c)).Distinct().OrderBy(c => c).ToList();
        CategoryList.ItemsSource = new List<string> { "全部" }.Concat(cats);
        CategoryList.SelectedIndex = 0;
    }

    internal void Init(MainWindow main) => _main = main;

    private void CategoryChanged(object? sender, SelectionChangedEventArgs e)
    {
        _category = CategoryList.SelectedItem as string;
        ApplyFilter();
    }

    private void SearchChanged(object? sender, TextChangedEventArgs e) => ApplyFilter();

    private void ApplyFilter()
    {
        var kw = SearchBox.Text?.Trim() ?? "";
        var list = _all
            .Where(r => _category == null || _category == "全部" || r.Category == _category)
            .Where(r => kw.Length == 0 || r.Name.Contains(kw) || r.Introduction.Contains(kw))
            .ToList();
        ResourceList.ItemsSource = list;
        NoResult.IsVisible = list.Count == 0;
    }

    // ── 详情：页内切换（点卡片切详情，点返回回列表） ──
    private void ResourceClick(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not Border b || b.DataContext is not Resource r || _main == null) return;
        var panel = new ResourceDetailPanel(r, _main.FavoritesList, _main);
        panel.CloseRequested += (_, _) => ShowList();
        DetailHost.Children.Clear();
        DetailHost.Children.Add(panel);
        ListView.IsVisible = false;
        DetailView.IsVisible = true;
    }

    private void ShowList()
    {
        DetailView.IsVisible = false;
        ListView.IsVisible = true;
    }
}
