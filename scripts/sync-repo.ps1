$ErrorActionPreference = "Stop"
$local = "D:\Agent\Pointers-BOX"
$clone = "D:\Agent\Pointers-BOX-repo"
$git = "D:\Git\bin\git.exe"
$robocopy = "C:\Windows\System32\robocopy.exe"

Write-Host "=== 1. 镜像本地项目到克隆目录 ==="
# /MIR 全量镜像；排除 .git(node_modules/release 等不入库)；/XF 保留仓库特有的 README.md 与 app.ico
& $robocopy $local $clone /MIR /XD .git node_modules release .build-tmp android\.gradle /XF README.md app.ico /NFL /NDL /NJH /NP | Select-Object -Last 8
Write-Host "robocopy exit: $LASTEXITCODE (0-7 均为成功)"

Write-Host "`n=== 2. 删除仓库中误提交的构建产物 out/ ==="
if (Test-Path (Join-Path $clone "out")) {
    Remove-Item (Join-Path $clone "out") -Recurse -Force
    Write-Host "out/ 已删除"
} else {
    Write-Host "out/ 不存在（无需处理）"
}

Write-Host "`n=== 3. git 状态摘要 ==="
Set-Location $clone
& $git config user.name "PointersMZX"
& $git config user.email "PointersMZX@users.noreply.github.com"
& $git add -A
$staged = & $git diff --cached --stat | Select-Object -Last 3
Write-Host $staged
