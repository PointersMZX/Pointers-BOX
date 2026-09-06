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

Write-Host '=== final v2.0.0 verification ==='
$runs = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/actions/runs?per_page=4' -Headers $h -TimeoutSec 30
foreach ($r in $runs.workflow_runs) {
    Write-Host ("run {0} | {1} | {2} | {3} | commit {4}" -f $r.id, $r.name, $r.conclusion, $r.head_branch, $r.head_sha.Substring(0,7))
}
$rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/tags/v2.0.0' -Headers $h -TimeoutSec 30
Write-Host ("`nrelease: {0} | draft={1} | prerelease={2}" -f $rel.name, $rel.draft, $rel.prerelease)
Write-Host ("tag commit: {0}" -f $rel.target_commitish)
foreach ($a in $rel.assets) { Write-Host ("  asset: {0}  ({1} KB)" -f $a.name, [math]::Round($a.size/1KB)) }
