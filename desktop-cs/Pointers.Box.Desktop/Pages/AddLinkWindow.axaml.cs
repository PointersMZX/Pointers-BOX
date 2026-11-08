// 添加链接弹窗（名称/网址/备注）
using Avalonia.Controls;

namespace Pointers.Box.Desktop.Pages;

public partial class AddLinkWindow : Window
{
    public string LinkName => NameBox.Text?.Trim() ?? "";
    public string LinkUrl => UrlBox.Text?.Trim() ?? "";
    public string LinkRemark => RemarkBox.Text?.Trim() ?? "";

    public AddLinkWindow()
    {
        InitializeComponent();
        Title = "添加链接";
        Width = 420;
        SizeToContent = SizeToContent.Height;
        CanResize = false;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
    }

    private void OKClick(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
    {
        Close(true);
    }

    private void CancelClick(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
    {
        Close(false);
    }
}
