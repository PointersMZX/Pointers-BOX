[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$jobUrl = 'https://github.com/PointersMZX/Pointers-BOX/actions/runs/34011663467/job/101428451628'
$r = Invoke-WebRequest -Uri $jobUrl -UseBasicParsing -TimeoutSec 40
$html = $r.Content
Write-Host "job page len=$($html.Length)"
# 失败步骤名（红色步骤标记为 failed）
$steps = [regex]::Matches($html, '"name":"((?:[^"\\]|\\.){2,80})","status":"completed","conclusion":"failure"')
foreach ($s in $steps) { Write-Host "FAILED STEP: $($s.Groups[1].Value)" }
# 注记
$ann = [regex]::Matches($html, '"message":"((?:[^"\\]|\\.){5,400})"')
foreach ($a in $ann | Select-Object -First 10) { Write-Host "MSG: $($a.Groups[1].Value)" }
Set-Content -Path "D:\Agent\android-job.html" -Value $html -Encoding UTF8
Write-Host "saved android-job.html"
