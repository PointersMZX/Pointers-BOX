using System.Collections.Generic;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class ResourcesPage : UserControl
{
    private List<Resource> _all = new();
    private string? _category;

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

    private void CategoryChanged(object? sender, SelectionChangedEventArgs e)
    {
        _category = CategoryList.SelectedItem as string;
        ApplyFilter();
    }

    private void SearchChanged(object? sender, TextChangedEventArgs e) => ApplyFilter();

    private void ApplyFilter()
    {
        var kw = SearchBox.Text?.Trim() ?? "";
        ResourceList.ItemsSource = _all
            .Where(r => _category == null || _category == "全部" || r.Category == _category)
            .Where(r => kw.Length == 0 || r.Name.Contains(kw) || r.Introduction.Contains(kw))
            .ToList();
    }
}
