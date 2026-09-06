[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$r = Invoke-WebRequest -Uri 'https://github.com/PointersMZX/Pointers-BOX/actions' -UseBasicParsing -TimeoutSec 40
$html = $r.Content
# 运行状态以 aria-label 或 svg 标记出现在列表项里；宽松提取与结论相关的片段
$idx = $html.IndexOf('fix(android)')
Write-Host "first 'fix(android)' at: $idx"
if ($idx -gt 0) {
    $start = [Math]::Max(0, $idx - 400)
    $len = [Math]::Min(1000, $html.Length - $start)
    Write-Host ($html.Substring($start, $len))
}
Write-Host "===== 所有结论标记 ====="
$conc = [regex]::Matches($html, 'aria-label="([^"]*(?:成功|失败|Success|Failure|success|failure)[^"]*)"')
foreach ($c in $conc) { Write-Host $c.Groups[1].Value }
