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
if (-not $token) { Write-Host 'NO_TOKEN'; exit 1 }
Write-Host 'token retrieved (hidden)'

$headers = @{ Authorization = "token $token"; 'User-Agent' = 'Pointers-BOX-CI' }
$runId = '34011663467'
$jobId = '101428451628'
$urls = @(
    "https://github.com/PointersMZX/Pointers-BOX/actions/runs/$runId/job/$jobId/logs",
    "https://github.com/PointersMZX/Pointers-BOX/actions/runs/$runId/job/$jobId/logs?attempt=1"
)
$n = 0
foreach ($u in $urls) {
    $n++
    try {
        $r = Invoke-WebRequest -Uri $u -Headers $headers -UseBasicParsing -TimeoutSec 60
        Set-Content -Path "D:\Agent\joblog-$n.txt" -Value $r.Content -Encoding UTF8
        Write-Host "OK $u -> $($r.Content.Length) bytes"
    } catch {
        Write-Host "FAIL $u : $($_.Exception.Message)"
    }
}
