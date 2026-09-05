[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$r = Invoke-WebRequest -Uri 'https://github.com/PointersMZX/Pointers-BOX/releases/tag/v2.0.0-beta' -UseBasicParsing -TimeoutSec 40
$html = $r.Content
Write-Host "=== Release assets ==="
$assets = [regex]::Matches($html, '([A-Za-z0-9\.\-_]+\.(apk|dmg|zip|deb|AppImage|blockmap|yml|exe))') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
if ($assets) { $assets | ForEach-Object { Write-Host "  $_" } } else { Write-Host "  (no installer assets found)" }
Write-Host ""
Write-Host "=== Key package check ==="
foreach ($k in @('app-release.apk', 'arm64.dmg', 'Pointers-BOX-2.0.0.dmg', 'mac.zip', '.deb', '.AppImage')) {
    $hit = $assets | Where-Object { $_ -like "*$k*" } | Select-Object -First 1
    if ($hit) { Write-Host "$k -> YES ($hit)" } else { Write-Host "$k -> MISSING" }
}
