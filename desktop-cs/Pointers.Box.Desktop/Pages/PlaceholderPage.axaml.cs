using Avalonia.Controls;

namespace Pointers.Box.Desktop.Pages;

public partial class PlaceholderPage : UserControl
{
    public PlaceholderPage(string title, string desc)
    {
        InitializeComponent();
        TitleText.Text = title;
        DescText.Text = desc;
    }
}
