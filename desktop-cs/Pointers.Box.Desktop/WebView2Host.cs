// WebView2 内嵌宿主（Windows）：NativeControlHost 承载
// CreateNativeControlCore 建一个 Win32 STATIC 子窗口作为 WebView2 的父 HWND；
// 附着视觉树后 CreateCoreWebView2ControllerAsync 绑到该 HWND 渲染。
using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Platform;
using Microsoft.Web.WebView2.Core;

namespace Pointers.Box.Desktop;

public class WebView2Host : NativeControlHost
{
    private CoreWebView2? _core;
    private CoreWebView2Controller? _controller;
    private readonly Uri _initialUrl;
    private bool _initialized;
    private IntPtr _childHwnd;

    public static bool IsSupported => OperatingSystem.IsWindows();

    public event EventHandler<string>? StatusChanged;

    public WebView2Host(Uri initialUrl)
    {
        _initialUrl = initialUrl;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateWindowExW(uint exStyle, string className, string windowName,
        uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr inst, IntPtr param);

    private const uint WS_CHILD = 0x40000000;
    private const uint WS_VISIBLE = 0x10000000;

    protected override IPlatformHandle CreateNativeControlCore(IPlatformHandle parent)
    {
        if (OperatingSystem.IsWindows())
        {
            _childHwnd = CreateWindowExW(0, "STATIC", "", WS_CHILD | WS_VISIBLE,
                0, 0, 1, 1, parent.Handle, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
            if (_childHwnd != IntPtr.Zero)
                _ = InitAsync(parent);
            return new PlatformHandle(_childHwnd, "HWND");
        }
        return base.CreateNativeControlCore(parent);
    }

    private async Task InitAsync(IPlatformHandle parent)
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync();
            _controller = await env.CreateCoreWebView2ControllerAsync(_childHwnd);
            if (_controller == null) { StatusChanged?.Invoke(this, "WebView2 控制器创建失败"); return; }
            _core = _controller.CoreWebView2;
            _core.Settings.AreDefaultContextMenusEnabled = true;
            _core.Settings.AreDevToolsEnabled = false;
            _core.Settings.IsStatusBarEnabled = false;
            _core.NewWindowRequested += (_, e2) =>
            {
                // 新窗口：内嵌当前 WebView 打开（不开系统浏览器）
                e2.Handled = true;
                _core.Navigate(e2.Uri);
            };
            _core.Navigate(_initialUrl.AbsoluteUri);
            _initialized = true;
            StatusChanged?.Invoke(this, "");
        }
        catch (Exception ex)
        {
            StatusChanged?.Invoke(this, ex.Message);
        }
    }

    public void Navigate(Uri url) => _core?.Navigate(url.AbsoluteUri);

    protected override void DestroyNativeControlCore(global::Avalonia.Platform.IPlatformHandle control)
    {
        try { _controller?.Close(); } catch { }
        _controller = null;
        _core = null;
        _initialized = false;
        if (_childHwnd != IntPtr.Zero)
        {
            DestroyWindow(_childHwnd);
            _childHwnd = IntPtr.Zero;
        }
    }

    [DllImport("user32.dll")]
    private static extern bool DestroyWindow(IntPtr hwnd);
}
