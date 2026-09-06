[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$gitExe = 'D:\Git\bin\git.exe'
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $gitExe
$psi.Arguments = 'credential fill'
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.UseShellExecute = $false
$p = [System.Diagnostics.Process]::Start($psi)
$p.StandardInput.WriteLine('protocol=https')
$p.StandardInput.WriteLine('host=github.com')
$p.StandardInput.WriteLine('')
$out = $p.StandardOutput.ReadToEnd()
$p.WaitForExit()
$token = $null
foreach ($line in $out -split "`n") {
    if ($line.StartsWith('password=')) { $token = $line.Substring(9).Trim() }
}
$h = @{ Authorization = "token $token"; 'User-Agent' = 'Pointers-BOX-CI' }

# round 8 android run (06364e4)
$zipUrl = 'https://api.github.com/repos/PointersMZX/Pointers-BOX/actions/runs/34009954521/logs'
try {
    Invoke-WebRequest -Uri $zipUrl -Headers $h -OutFile 'D:\Agent\android-r8-logs.zip' -TimeoutSec 120
    if (Test-Path 'D:\Agent\android-r8') { Remove-Item 'D:\Agent\android-r8' -Recurse -Force }
    Expand-Archive -Path 'D:\Agent\android-r8-logs.zip' -DestinationPath 'D:\Agent\android-r8' -Force
    Write-Host 'r8 extracted'
} catch {
    Write-Host "r8 zip FAIL: $($_.Exception.Message)"
}

# 读取 round 8 的 Sync Capacitor 日志
$sync = Get-ChildItem 'D:\Agent\android-r8' -Recurse -Filter '*Sync Capacitor*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($sync) {
    Write-Host "=== round8 Sync Capacitor log ==="
    Get-Content $sync.FullName | ForEach-Object { Write-Host $_ }
}
