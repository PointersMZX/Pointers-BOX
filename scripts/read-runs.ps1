[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$r = Invoke-WebRequest -Uri 'https://github.com/PointersMZX/Pointers-BOX/actions' -UseBasicParsing -TimeoutSec 40
$html = $r.Content
# GitHub 在页面内嵌 JSON：提取 runs 数组关键字段
$matches = [regex]::Matches($html, '"workflowName":"([^"]*)","runNumber":(\d+),"event":"([^"]*)","status":"([^"]*)","conclusion":"?([^",}]*)"?.*?"id":(\d{9,})')
foreach ($m in $matches) {
    Write-Host ("{0} | #{1} | event={2} | status={3} | conclusion={4} | id={5}" -f $m.Groups[1].Value, $m.Groups[2].Value, $m.Groups[3].Value, $m.Groups[4].Value, $m.Groups[5].Value, $m.Groups[6].Value)
}
if ($matches.Count -eq 0) {
    # 备用：宽松提取 run id 与 conclusion
    $ids = [regex]::Matches($html, '"id":(\d{9,})') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique -First 8
    Write-Host "IDs: $($ids -join ', ')"
    $conc = [regex]::Matches($html, '"conclusion":"([^"]*)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -First 10
    Write-Host "Conclusions: $($conc -join ', ')"
}
