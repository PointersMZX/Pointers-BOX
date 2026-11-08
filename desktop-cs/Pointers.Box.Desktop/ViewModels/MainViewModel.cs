// 主导航 VM：页面切换 + 各页共享数据（快照/配置/链接）

using System.Collections.Generic;
using System.Linq;
using Pointers.Box.Core;

namespace Pointers.Box.Desktop.ViewModels;

public enum PageKind { Home, Resources, Links, Browser, Downloads, Settings }

public class MainViewModel : ViewModelBase
{
    private PageKind _currentPage = PageKind.Home;
    public PageKind CurrentPage
    {
        get => _currentPage;
        set { if (SetField(ref _currentPage, value)) OnPropertyChanged(nameof(IsHome)); OnPropertyChanged(nameof(IsResources)); OnPropertyChanged(nameof(IsLinks)); OnPropertyChanged(nameof(IsBrowser)); OnPropertyChanged(nameof(IsDownloads)); OnPropertyChanged(nameof(IsSettings)); }
    }

    public bool IsHome { get => _currentPage == PageKind.Home; }
    public bool IsResources { get => _currentPage == PageKind.Resources; }
    public bool IsLinks { get => _currentPage == PageKind.Links; }
    public bool IsBrowser { get => _currentPage == PageKind.Browser; }
    public bool IsDownloads { get => _currentPage == PageKind.Downloads; }
    public bool IsSettings { get => _currentPage == PageKind.Settings; }

    public DataSnapshot? Snapshot { get; set; }
    public AppConfig Config { get; set; } = new();
    public List<UserLink> UserLinks { get; set; } = new();
    public List<Resource> Recommends { get; set; } = new();

    public void ShuffleRecommends(int count)
    {
        if (Snapshot?.Resources != null) Recommends = BoxLogic.PickRecommends(Snapshot.Resources, count);
        OnPropertyChanged(nameof(Recommends));
    }

    public List<Resource> AllResources => Snapshot?.Resources ?? new List<Resource>();
    public IEnumerable<string> Categories => AllResources.Select(r => r.Category).Where(c => !string.IsNullOrEmpty(c)).Distinct().OrderBy(c => c);
}
