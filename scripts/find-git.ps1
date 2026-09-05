$base = "D:\Agent\Pointers-BOX"

Write-Host "=== 1. 本项目是否有 .git ==="
Write-Host "D:\Agent\Pointers-BOX\.git 存在: $(Test-Path (Join-Path $base '.git'))"

Write-Host "`n=== 2. 查找 git.exe 安装位置 ==="
$gitPaths = @(
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe",
    "D:\Program Files\Git\bin\git.exe",
    "D:\Git\bin\git.exe"
)
$foundGit = $null
foreach ($p in $gitPaths) {
    if (Test-Path $p) { Write-Host "找到: $p"; if (-not $foundGit) { $foundGit = $p } }
}
if (-not $foundGit) { Write-Host "常见路径未找到，尝试 where..." }

Write-Host "`n=== 3. 搜索其他 Pointers-BOX 副本（含 .git 的工作副本）==="
$roots = @("D:\", "C:\Users\Pointers\Documents", "C:\Users\Pointers\Desktop", "C:\Users\Pointers\Desktop", "C:\Users\Pointers\source")
foreach ($r in $roots) {
    if (Test-Path $r) {
        Get-ChildItem $r -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $candidate = Join-Path $_.FullName "Pointers-BOX"
            $candidates2 = @()
            if (Test-Path (Join-Path $_.FullName ".git")) { $candidates2 += $_.FullName }
            if (Test-Path (Join-Path $candidate ".git")) { $candidates2 += $candidate }
            foreach ($c in $candidates2) {
                Write-Host "发现工作副本: $c"
            }
        }
    }
}
Write-Host "`n=== 扫描完成 ==="
