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
Write-Host 'token ok'

$h = @{ Authorization = "token $token"; 'User-Agent' = 'Pointers-BOX-CI'; Accept = 'application/vnd.github+json' }

# 1) 仓库信息
try {
    $repo = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX' -Headers $h -TimeoutSec 30
    Write-Host "repo ok: $($repo.full_name) default=$($repo.default_branch)"
} catch {
    Write-Host "api repo FAIL: $($_.Exception.Message)"
    exit 1
}

# 2) 最近 workflow runs
try {
    $runs = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/actions/runs?per_page=6' -Headers $h -TimeoutSec 30
    foreach ($r in $runs.workflow_runs) {
        Write-Host ("run {0} | {1} | {2} | {3}" -f $r.id, $r.name, $r.conclusion, $r.head_branch)
    }
} catch {
    Write-Host "api runs FAIL: $($_.Exception.Message)"
}

# 3) 失败 android run 的 job 日志
try {
    $jobs = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/actions/runs/34011663467/jobs' -Headers $h -TimeoutSec 30
    foreach ($j in $jobs.jobs) {
        Write-Host "job $($j.id) conclusion=$($j.conclusion)"
        foreach ($s in $j.steps) {
            Write-Host ("  step: {0} -> {1}" -f $s.name, $s.conclusion)
        }
        $logUrl = $j.url + '/logs'
        try {
            $log = Invoke-WebRequest -Uri $logUrl -Headers $h -TimeoutSec 60 -MaximumRedirection 5
            Set-Content -Path 'D:\Agent\android-joblog.txt' -Value $log.Content -Encoding UTF8
            Write-Host "log saved: $($log.Content.Length) bytes"
        } catch {
            Write-Host "log FAIL: $($_.Exception.Message)"
        }
    }
} catch {
    Write-Host "api jobs FAIL: $($_.Exception.Message)"
}
