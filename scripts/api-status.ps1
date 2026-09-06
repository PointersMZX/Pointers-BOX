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

Write-Host '=== latest runs ==='
$runs = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/actions/runs?per_page=5' -Headers $h -TimeoutSec 30
foreach ($r in $runs.workflow_runs) {
    Write-Host ("run {0} | {1} | {2} | {3}" -f $r.id, $r.name, $r.conclusion, $r.head_branch)
}

Write-Host ''
Write-Host '=== release v2.0.0-beta assets ==='
try {
    $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/tags/v2.0.0-beta' -Headers $h -TimeoutSec 30
    Write-Host "release: $($rel.name) draft=$($rel.draft)"
    foreach ($a in $rel.assets) { Write-Host ("  {0}  ({1} KB)" -f $a.name, [math]::Round($a.size / 1KB)) }
} catch {
    Write-Host "release FAIL: $($_.Exception.Message)"
}

Write-Host ''
Write-Host '=== android job steps (latest android run) ==='
$androidRun = $runs.workflow_runs | Where-Object { $_.name -eq 'Android APK' } | Select-Object -First 1
if ($androidRun) {
    Write-Host "run id $($androidRun.id) conclusion=$($androidRun.conclusion)"
    $jobs = Invoke-RestMethod -Uri "https://api.github.com/repos/PointersMZX/Pointers-BOX/actions/runs/$($androidRun.id)/jobs" -Headers $h -TimeoutSec 30
    foreach ($j in $jobs.jobs) {
        foreach ($s in $j.steps) {
            Write-Host ("  step: {0} -> {1}" -f $s.name, $s.conclusion)
        }
    }
}
