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

$zipUrl = 'https://api.github.com/repos/PointersMZX/Pointers-BOX/actions/runs/34011663467/logs'
try {
    Invoke-WebRequest -Uri $zipUrl -Headers $h -OutFile 'D:\Agent\android-run-logs.zip' -TimeoutSec 120
    Write-Host 'zip saved'
    if (Test-Path 'D:\Agent\android-logs') { Remove-Item 'D:\Agent\android-logs' -Recurse -Force }
    Expand-Archive -Path 'D:\Agent\android-run-logs.zip' -DestinationPath 'D:\Agent\android-logs' -Force
    Get-ChildItem 'D:\Agent\android-logs' -Recurse -File | ForEach-Object {
        Write-Host ("  {0}  ({1} bytes)" -f $_.FullName.Replace('D:\Agent\android-logs\',''), $_.Length)
    }
} catch {
    Write-Host "zip FAIL: $($_.Exception.Message)"
}
