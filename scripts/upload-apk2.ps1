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

$rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/tags/v2.0.0' -Headers @{ Authorization = "token $token"; 'User-Agent' = 'PB' } -TimeoutSec 30
Write-Host ("release {0} | {1} | assets: {2}" -f $rel.id, $rel.name, $rel.assets.Count)
foreach ($a in $rel.assets) { Write-Host ("  asset: {0} ({1} KB)" -f $a.name, [math]::Round($a.size/1KB)) }

$apkPath = 'D:\Agent\apk-out\app-release.apk'
$name = 'Pointers-BOX_v2.0.0-release.apk'

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(300)
$client.DefaultRequestHeaders.Add('Authorization', "token $token")
$client.DefaultRequestHeaders.Add('User-Agent', 'Pointers-BOX-CI')
$content = New-Object System.Net.Http.StreamContent (New-Object System.Net.Http.FileStream ($apkPath, [System.IO.FileMode]::Open))
$content.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue 'application/octet-stream'
$url = "https://uploads.github.com/repos/PointersMZX/Pointers-BOX/releases/$($rel.id)/assets?name=$name"
$resp = $client.PostAsync($url, $content).GetAwaiter().GetResult()
$body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
Write-Host ("upload status: {0}" -f $resp.StatusCode)
Write-Host ("response: {0}" -f $body.Substring(0, [Math]::Min(500, $body.Length)))
