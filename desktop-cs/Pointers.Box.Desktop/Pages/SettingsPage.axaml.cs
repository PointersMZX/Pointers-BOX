using Avalonia.Controls;
using Avalonia.Interactivity;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.Pages;

public partial class SettingsPage : UserControl
{
    private readonly AppConfig _config;
    private readonly MainWindow _main;

    public SettingsPage(AppConfig config, MainWindow main)
    {
        InitializeComponent();
        _config = config;
        _main = main;
        ChannelGithub.IsChecked = _config.UpdateChannel == "github";
        ChannelGitee.IsChecked = _config.UpdateChannel != "github";
    }

    private void ChannelChanged(object? sender, RoutedEventArgs e)
    {
        _config.UpdateChannel = ChannelGithub.IsChecked == true ? "github" : "gitee";
        _main.SaveConfig();
    }
}
