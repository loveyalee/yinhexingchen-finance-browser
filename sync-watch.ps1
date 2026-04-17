$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = "root@111.230.36.222"
$projectDir = "/var/www/yinhexingchen"
$pollIntervalSeconds = 2
$includePatterns = @("*.html", "*.css", "*.js", "*.json", "*.conf", "*.md", "*.ps1", "*.bat")
$restartFiles = @("server.js", "package.json", "package-lock.json")
$ignoreFilePatterns = @("tmp_*", "*.backup-*", ".sync-watch.pid", "sync-watch.log")
$knownWriteTimes = @{}
$lastRestartAt = [datetime]::MinValue
$pidFile = Join-Path $projectRoot ".sync-watch.pid"
$logFile = Join-Path $projectRoot "sync-watch.log"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Log {
    param([string]$Message)
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$time] $Message"
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

function Sync-File {
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
        $normalizedRelativePath.StartsWith("db/")) {
        return
    }

    $remotePath = "$projectDir/$normalizedRelativePath"
    $remoteDir = [System.IO.Path]::GetDirectoryName($remotePath).Replace("\", "/")

    Write-Log "同步 $normalizedRelativePath"
    & ssh -o StrictHostKeyChecking=no $server "mkdir -p '$remoteDir'" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "创建远端目录失败: $remoteDir"
    }

    & scp -o StrictHostKeyChecking=no $FullPath "${server}:${remotePath}" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "上传失败: $normalizedRelativePath"
    }

    $fileName = [System.IO.Path]::GetFileName($FullPath)
    if ($restartFiles -contains $fileName) {
        $now = Get-Date
        if (($now - $lastRestartAt).TotalSeconds -ge 3) {
            Write-Log "检测到服务端文件变更，重启 PM2"
            & ssh -o StrictHostKeyChecking=no $server "cd $projectDir && pm2 restart yinhexingchen --update-env" | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "PM2 重启失败"
            }
            $script:lastRestartAt = $now
        }
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
            $normalizedRelativePath.StartsWith("db/")) {
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

function Sync-Changes {
    $currentFiles = @{}

    foreach ($file in Get-TrackedFiles) {
        $currentFiles[$file.FullName] = $true
        $currentTicks = $file.LastWriteTimeUtc.Ticks

        if (-not $knownWriteTimes.ContainsKey($file.FullName)) {
            $knownWriteTimes[$file.FullName] = $currentTicks
            try {
                Sync-File $file.FullName
            }
            catch {
                Write-Log $_.Exception.Message
            }
            continue
        }

        if ($knownWriteTimes[$file.FullName] -ne $currentTicks) {
            $knownWriteTimes[$file.FullName] = $currentTicks
            try {
                Sync-File $file.FullName
            }
            catch {
                Write-Log $_.Exception.Message
            }
        }
    }

    foreach ($path in @($knownWriteTimes.Keys)) {
        if (-not $currentFiles.ContainsKey($path)) {
            $knownWriteTimes.Remove($path) | Out-Null
        }
    }
}

Set-Content -LiteralPath $pidFile -Value $PID -Encoding ASCII
"" | Set-Content -LiteralPath $logFile -Encoding UTF8
Write-Log "========================================"
Write-Log "银河星辰 - 实时自动发布"
Write-Log "本地保存 -> 自动同步到服务器"
Write-Log "服务器: $server"
Write-Log "目录: $projectDir"
Write-Log "监听范围: $projectRoot"
Write-Log "监听类型: $($includePatterns -join ', ')"
Write-Log "忽略目录: .git, .idea, .vscode, node_modules, db"
Write-Log "========================================"
Initialize-TrackedFiles

try {
    while ($true) {
        Start-Sleep -Seconds $pollIntervalSeconds
        Sync-Changes
    }
}
finally {
    if ((Test-Path -LiteralPath $pidFile) -and ((Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue) -eq "$PID")) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
}
