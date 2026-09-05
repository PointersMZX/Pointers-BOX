[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$r = Invoke-WebRequest -Uri 'https://github.com/PointersMZX/Pointers-BOX/actions' -UseBasicParsing -TimeoutSec 40
$html = $r.Content
Write-Host "HTML length: $($html.Length)"
# 查找嵌入数据的位置
$idx = $html.IndexOf('v2.0.0-beta')
Write-Host "first 'v2.0.0-beta' at: $idx"
if ($idx -gt 0) {
    $start = [Math]::Max(0, $idx - 600)
    $len = [Math]::Min(1600, $html.Length - $start)
    Write-Host ($html.Substring($start, $len))
}
