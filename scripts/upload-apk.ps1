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
$h = @{ Authorization = "token $token"; 'User-Agent' = 'Pointers-BOX-CI'; Accept = 'application/vnd.github+json' }

# 1) 最新成功 Android run 的 artifact
$arts = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/actions/runs/34047422070/artifacts' -Headers $h -TimeoutSec 30
$art = $arts.artifacts | Where-Object { $_.name -eq 'Pointers-BOX-apk' } | Select-Object -First 1
Write-Host ("artifact: {0} ({1} bytes, expired={2})" -f $art.name, $art.size_in_bytes, $art.expired)

# 2) 下载 artifact zip
Invoke-WebRequest -Uri $art.archive_download_url -Headers $h -OutFile 'D:\Agent\apk-artifact.zip' -TimeoutSec 180
Write-Host 'artifact downloaded'
if (Test-Path 'D:\Agent\apk-out') { Remove-Item 'D:\Agent\apk-out' -Recurse -Force }
Expand-Archive -Path 'D:\Agent\apk-artifact.zip' -DestinationPath 'D:\Agent\apk-out' -Force
$apk = Get-ChildItem 'D:\Agent\apk-out' -Filter '*.apk' | Select-Object -First 1
Write-Host ("apk: {0} ({1} bytes)" -f $apk.FullName, $apk.Length)

# 3) release id
$rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/tags/v2.0.0' -Headers $h -TimeoutSec 30
Write-Host ("release id: {0} name: {1}" -f $rel.id, $rel.name)

# 4) 上传 APK 到 Release（uploads.github.com）
$apkBytes = [System.IO.File]::ReadAllBytes($apk.FullName)
$uploadName = 'Pointers-BOX_v2.0.0-release.apk'
try {
    Invoke-RestMethod -Uri ("https://uploads.github.com/repos/PointersMZX/Pointers-BOX/releases/{0}/assets?name={1}" -f $rel.id, $uploadName) -Method Post -Headers @{ Authorization = "token $token"; 'User-Agent' = 'Pointers-BOX-CI'; 'Content-Type' = 'application/octet-stream' } -Body $apkBytes -TimeoutSec 300 | Out-Null
    Write-Host "UPLOADED: $uploadName"
} catch {
    Write-Host "upload FAIL: $($_.Exception.Message)"
}
