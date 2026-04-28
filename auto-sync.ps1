# 银河星辰 - 自动同步脚本
# 功能：文件修改后自动同步到 GitHub 和服务器
# 使用：在后台运行此脚本，它会监控文件变化并自动同步

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = "root@111.230.36.222"
$projectDir = "/var/www/yinhexingchen"
$pollIntervalSeconds = 3
$includePatterns = @("*.html", "*.css", "*.js", "*.json", "*.conf", "*.md", "*.ps1", "*.bat")
$restartFiles = @("server.js", "package.json", "package-lock.json")
$ignoreFilePatterns = @("tmp_*", "*.backup-*", ".sync-watch.pid", "sync-watch.log", "*.log")
$knownWriteTimes = @{}
$lastRestartAt = [datetime]::MinValue
$lastGitPushAt = [datetime]::MinValue
$pidFile = Join-Path $projectRoot ".auto-sync.pid"
$logFile = Join-Path $projectRoot "auto-sync.log"
$gitBatchInterval = 30  # Git推送间隔（秒），避免频繁提交

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$time] [$Level] $Message"
    Write-Host $line
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Test-IncludeFile {
    param([string]$FileName)

    foreach ($pattern in $ignoreFilePatterns) {
        if ($FileName -like $pattern) {
            return $false
        }
    }

    foreach ($pattern in $includePatterns) {
        if ($FileName -like $pattern) {
            return $true
        }
    }
    return $false
}

function Get-RelativePathCompat {
    param(
        [string]$BasePath,
        [string]$TargetPath
    )

    $baseResolved = (Resolve-Path -LiteralPath $BasePath).Path
    $targetResolved = (Resolve-Path -LiteralPath $TargetPath).Path

    if ($targetResolved.StartsWith($baseResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $targetResolved.Substring($baseResolved.Length).TrimStart('\', '/')
    }

    $baseUri = New-Object System.Uri(($baseResolved.TrimEnd('\') + '\'))
    $targetUri = New-Object System.Uri($targetResolved)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', '\')
}

function Sync-File-To-Server {
    param([string]$FullPath)

    if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) {
        return
    }

    $relativePath = Get-RelativePathCompat -BasePath $projectRoot -TargetPath $FullPath
    $normalizedRelativePath = $relativePath -replace "\\", "/"

    if ($normalizedRelativePath.StartsWith(".git/") -or
        $normalizedRelativePath.StartsWith(".idea/") -or
        $normalizedRelativePath.StartsWith(".vscode/") -or
        $normalizedRelativePath.StartsWith("node_modules/") -or
        $normalizedRelativePath.StartsWith("db/") -or
        $normalizedRelativePath.StartsWith(".claude/")) {
        return
    }

    $remotePath = "$projectDir/$normalizedRelativePath"
    $remoteDir = [System.IO.Path]::GetDirectoryName($remotePath).Replace("\", "/")

    Write-Log "同步到服务器: $normalizedRelativePath"
    & ssh -o StrictHostKeyChecking=no $server "mkdir -p '$remoteDir'" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Log "创建远端目录失败: $remoteDir" "ERROR"
        return
    }

    & scp -o StrictHostKeyChecking=no $FullPath "${server}:${remotePath}" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Log "上传失败: $normalizedRelativePath" "ERROR"
        return
    }

    Write-Log "服务器同步成功: $normalizedRelativePath" "SUCCESS"

    $fileName = [System.IO.Path]::GetFileName($FullPath)
    if ($restartFiles -contains $fileName) {
        $now = Get-Date
        if (($now - $lastRestartAt).TotalSeconds -ge 5) {
            Write-Log "检测到服务端文件变更，重启 PM2"
            & ssh -o StrictHostKeyChecking=no $server "cd $projectDir && pm2 restart yinhexingchen --update-env" 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Log "PM2 重启失败" "ERROR"
            } else {
                Write-Log "PM2 重启成功" "SUCCESS"
            }
            $script:lastRestartAt = $now
        }
    }
}

function Push-To-GitHub {
    param([string[]]$ChangedFiles)

    $now = Get-Date
    if (($now - $lastGitPushAt).TotalSeconds -lt $gitBatchInterval) {
        Write-Log "Git推送间隔不足，等待下次批量推送"
        return
    }

    Write-Log "开始推送到 GitHub..."

    Push-Location $projectRoot

    try {
        $maxRetries = 3
        $retryDelay = 2

        for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
            $lockFile = Join-Path $projectRoot ".git\index.lock"
            if ((Test-Path $lockFile) -and $attempt -eq 1) {
                Write-Log "检测到 index.lock，尝试清理..." "WARN"
                Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
            }

            # 添加所有变更
            & git add -A 2>&1 | Out-Null

            # 检查是否有变更
            $status = & git status --porcelain 2>&1
            if ($status -eq "") {
                Write-Log "没有需要提交的变更"
                Pop-Location
                return
            }

            # 生成提交信息
            $timeStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $commitMsg = "Auto-sync: $timeStr - $($ChangedFiles.Count) files changed"

            # 提交
            & git commit -m $commitMsg 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                $commitErr = (git commit -m $commitMsg 2>&1) -join "`n"
                $commitOutput = (git log --oneline -1 2>&1) -join "`n"
                if ($commitOutput -match "^[a-f0-9]+\s" -and $commitErr -notmatch "fatal|error|failed") {
                    Write-Log "Git commit 成功（仅有警告）: $commitMsg" "WARN"
                } elseif ($commitErr -match "Unable to create|index\.lock") {
                    if ($attempt -lt $maxRetries) {
                        Write-Log "Git commit 被 index.lock 阻塞，第 $attempt 次重试..." "WARN"
                        Start-Sleep $retryDelay
                        continue
                    } else {
                        Write-Log "Git commit 失败（index.lock 冲突）" "ERROR"
                        Pop-Location
                        return
                    }
                } else {
                    Write-Log "Git commit 失败: $commitErr" "ERROR"
                    Pop-Location
                    return
                }
            }

            # 推送
            & git push origin master 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                $pushErr = (git push origin master 2>&1) -join "`n"
                if ($pushErr -match "Unable to create|index\.lock") {
                    if ($attempt -lt $maxRetries) {
                        Write-Log "Git push 被 index.lock 阻塞，第 $attempt 次重试..." "WARN"
                        Start-Sleep $retryDelay
                        continue
                    } else {
                        Write-Log "Git push 失败（index.lock 冲突）" "ERROR"
                        Pop-Location
                        return
                    }
                } elseif ($pushErr -notmatch "fatal|error|failed") {
                    Write-Log "Git push 成功（仅有警告）" "WARN"
                } else {
                    Write-Log "Git push 失败: $pushErr" "ERROR"
                    Pop-Location
                    return
                }
            }

            Write-Log "GitHub 推送成功: $commitMsg" "SUCCESS"
            $script:lastGitPushAt = $now
            break
        }
    }
    catch {
        Write-Log "Git 操作异常: $($_.Exception.Message)" "ERROR"
    }
    finally {
        Pop-Location
    }
}

function Get-TrackedFiles {
    Get-ChildItem -LiteralPath $projectRoot -Recurse -File | Where-Object {
        $file = $_
        if (-not (Test-IncludeFile $file.Name)) {
            return $false
        }

        $relativePath = Get-RelativePathCompat -BasePath $projectRoot -TargetPath $file.FullName
        $normalizedRelativePath = $relativePath -replace "\\", "/"

        if ($normalizedRelativePath.StartsWith(".git/") -or
            $normalizedRelativePath.StartsWith(".idea/") -or
            $normalizedRelativePath.StartsWith(".vscode/") -or
            $normalizedRelativePath.StartsWith("node_modules/") -or
            $normalizedRelativePath.StartsWith("db/") -or
            $normalizedRelativePath.StartsWith(".claude/")) {
            return $false
        }

        return $true
    }
}

function Initialize-TrackedFiles {
    foreach ($file in Get-TrackedFiles) {
        $knownWriteTimes[$file.FullName] = $file.LastWriteTimeUtc.Ticks
    }
}

$pendingGitFiles = @()

function Sync-Changes {
    $currentFiles = @{}
    $changedFiles = @()

    foreach ($file in Get-TrackedFiles) {
        $currentFiles[$file.FullName] = $true
        $currentTicks = $file.LastWriteTimeUtc.Ticks

        if (-not $knownWriteTimes.ContainsKey($file.FullName)) {
            $knownWriteTimes[$file.FullName] = $currentTicks
            try {
                Sync-File-To-Server $file.FullName
                $changedFiles += $file.FullName
            }
            catch {
                Write-Log $_.Exception.Message "ERROR"
            }
            continue
        }

        if ($knownWriteTimes[$file.FullName] -ne $currentTicks) {
            $knownWriteTimes[$file.FullName] = $currentTicks
            try {
                Sync-File-To-Server $file.FullName
                $changedFiles += $file.FullName
            }
            catch {
                Write-Log $_.Exception.Message "ERROR"
            }
        }
    }

    foreach ($path in @($knownWriteTimes.Keys)) {
        if (-not $currentFiles.ContainsKey($path)) {
            $knownWriteTimes.Remove($path) | Out-Null
        }
    }

    # 收集变更文件，批量推送到 GitHub
    if ($changedFiles.Count -gt 0) {
        $script:pendingGitFiles += $changedFiles
    }
}

# 主程序入口
Set-Content -LiteralPath $pidFile -Value $PID -Encoding ASCII
"" | Set-Content -LiteralPath $logFile -Encoding UTF8

Write-Log "========================================"
Write-Log "银河星辰 - 自动同步系统"
Write-Log "功能: 文件修改 -> 服务器 + GitHub"
Write-Log "服务器: $server"
Write-Log "目录: $projectDir"
Write-Log "GitHub: origin/master"
Write-Log "监听范围: $projectRoot"
Write-Log "监听类型: $($includePatterns -join ', ')"
Write-Log "Git推送间隔: $gitBatchInterval 秒"
Write-Log "========================================"

Initialize-TrackedFiles

try {
    while ($true) {
        Start-Sleep -Seconds $pollIntervalSeconds
        Sync-Changes

        # 定期推送到 GitHub
        if ($pendingGitFiles.Count -gt 0) {
            Push-To-GitHub $pendingGitFiles
            $script:pendingGitFiles = @()
        }
    }
}
finally {
    if ((Test-Path -LiteralPath $pidFile) -and ((Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue) -eq "$PID")) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
    Write-Log "自动同步已停止"
}