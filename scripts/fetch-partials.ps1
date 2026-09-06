[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = 'https://github.com/PointersMZX/Pointers-BOX/actions/runs/34011663467'
$urls = @(
    "$base/navigation_partial?attempt=1&selected_check_run_id=101428451628&selected_tab=summary",
    "$base/job/101428451628/logs"
)
$n = 0
foreach ($u in $urls) {
    $n++
    try {
        $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 40
        $path = "D:\Agent\jobpart-$n.html"
        Set-Content -Path $path -Value $r.Content -Encoding UTF8
        Write-Host "OK ($($r.Content.Length) bytes) -> $path : $u"
    } catch {
        Write-Host "FAIL ($($_.Exception.Message)) : $u"
    }
}
