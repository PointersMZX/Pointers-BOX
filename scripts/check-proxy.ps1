Write-Host "=== 系统代理设置 ==="
$reg = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
Write-Host "ProxyEnable: $($reg.ProxyEnable)"
Write-Host "ProxyServer: $($reg.ProxyServer)"
Write-Host "`n=== 常见本地代理端口探测 ==="
foreach ($port in @(7890, 7897, 10809, 1080, 8888, 8118)) {
    $r = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
    Write-Host "127.0.0.1:$port -> $r"
}
