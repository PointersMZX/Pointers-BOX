[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$r = Invoke-WebRequest -Uri 'https://github.com/PointersMZX/Pointers-BOX/actions' -UseBasicParsing -TimeoutSec 40
$html = $r.Content
Write-Host "len=$($html.Length)"
$idx = $html.IndexOf('Android APK')
Write-Host "first 'Android APK' at: $idx"
if ($idx -gt 0) {
    $start = [Math]::Max(0, $idx - 200)
    $len = [Math]::Min(1200, $html.Length - $start)
    Write-Host ($html.Substring($start, $len))
}
