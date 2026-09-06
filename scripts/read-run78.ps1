[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$runId = '34011663467'
$r = Invoke-WebRequest -Uri "https://github.com/PointersMZX/Pointers-BOX/actions/runs/$runId" -UseBasicParsing -TimeoutSec 40
$html = $r.Content
Write-Host "run page len=$($html.Length)"
# job 链接
$jobs = [regex]::Matches($html, 'actions/runs/' + $runId + '/job/(\d+)')
$jobIds = $jobs | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
Write-Host "job ids: $($jobIds -join ', ')"
# 注记（含错误信息）
$ann = [regex]::Matches($html, '"message":"((?:[^"\\]|\\.){5,300})"')
foreach ($a in $ann | Select-Object -First 10) { Write-Host "MSG: $($a.Groups[1].Value)" }
# 保存完整页面供后续解析
Set-Content -Path "D:\Agent\android-run.html" -Value $html -Encoding UTF8
Write-Host "saved android-run.html"
