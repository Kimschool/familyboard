# familyboard deploy automation — UGOS NAS
# Usage:  .\scripts\deploy.ps1
# Steps:  docker build -> save+gzip -> scp -> ssh(load + compose up)
#
# Requirements:
#   - Windows PC 에서 Docker Desktop 실행 중
#   - NAS SSH 키 인증 (kimjh@192.168.11.31)
#   - NAS 에 sudo NOPASSWD for /usr/bin/docker
#
# Override via env:
#   NAS_HOST, NAS_USER, NAS_SSH_PORT, NAS_DIR, PUBLIC_URL
#
# NAS .env 동기화: 기본은 NAS 기존 .env 유지. 프로필 사진 경로(NAS_DATA_DIR) 바꾼 뒤에는
#   .\scripts\deploy.ps1 -PushEnv
# 로 로컬 .env 를 NAS 에 덮어쓰기 (또는 NAS 에서 .env 직접 수정)

param(
  [string] $Image    = "familyboard:latest",
  [string] $NasHost  = $(if ($env:NAS_HOST)     { $env:NAS_HOST }     else { "192.168.11.31" }),
  [string] $NasUser  = $(if ($env:NAS_USER)     { $env:NAS_USER }     else { "kimjh" }),
  [int]    $NasPort  = $(if ($env:NAS_SSH_PORT) { [int]$env:NAS_SSH_PORT } else { 22 }),
  [string] $NasDir   = $(if ($env:NAS_DIR)      { $env:NAS_DIR }      else { "/volume1/docker/familyboard" }),
  [string] $PublicUrl= $(if ($env:PUBLIC_URL)   { $env:PUBLIC_URL }   else { "https://fb.weavus-group.com" }),
  [int]    $LocalPort= 3003,
  [string] $TarOut   = ".\familyboard.tar.gz",
  [switch] $SkipBuild,
  [switch] $SkipSave,
  [switch] $PushEnv
)

$ErrorActionPreference = "Continue"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

function Step([string]$n, [string]$m) {
  Write-Host ""
  Write-Host ("=" * 60) -ForegroundColor DarkGray
  Write-Host (">> {0}  {1}" -f $n, $m) -ForegroundColor Cyan
  Write-Host ("=" * 60) -ForegroundColor DarkGray
}

function Fail([string]$msg) { Write-Host $msg -ForegroundColor Red; exit 1 }

function ScpSend([string]$local, [string]$dst) {
  & scp -O -P $NasPort -o StrictHostKeyChecking=accept-new $local "$($NasUser)@$($NasHost):$dst"
  if ($LASTEXITCODE -ne 0) { Fail "scp failed: $local" }
}

function Save-DockerImageGz([string]$image, [string]$outPath) {
  # PS 5.1 .NET API는 프로세스 CWD를 씀 → 상대경로를 PowerShell 현재 디렉토리 기준 절대경로로 강제 변환
  if (-not [System.IO.Path]::IsPathRooted($outPath)) {
    $outPath = Join-Path (Get-Location -PSProvider FileSystem).Path $outPath
  }
  $outPath = [System.IO.Path]::GetFullPath($outPath)
  $outDir  = [System.IO.Path]::GetDirectoryName($outPath)
  if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

  $tempTar = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "fb_img_" + [System.Guid]::NewGuid() + ".tar")
  try {
    & docker save -o $tempTar $image
    if ($LASTEXITCODE -ne 0) { Fail "docker save failed" }
    if (-not (Test-Path $tempTar)) { Fail "docker save produced no output at $tempTar" }

    $inS  = [System.IO.File]::OpenRead($tempTar)
    $outS = [System.IO.File]::Create($outPath)
    try {
      $gz = New-Object System.IO.Compression.GZipStream($outS, [System.IO.Compression.CompressionLevel]::Optimal)
      try { $inS.CopyTo($gz) } finally { $gz.Dispose() }
    } finally {
      $outS.Dispose()
      $inS.Dispose()
    }
  } catch {
    Fail ("gzip wrap failed: " + $_.Exception.Message)
  } finally {
    if (Test-Path $tempTar) { Remove-Item $tempTar -Force }
  }
}

# ---- 1) Build ---------------------------------------------------------------
if (-not $SkipBuild) {
  Step "1/4" "docker build (linux/amd64) -> $Image"
  docker build --platform linux/amd64 --provenance=false -t $Image .
  if ($LASTEXITCODE -ne 0) { Fail "build failed" }
} else {
  Write-Host "(skip build)" -ForegroundColor Yellow
}

# ---- 2) Save + gzip ---------------------------------------------------------
if (-not $SkipSave) {
  Step "2/4" "docker save + gzip -> $TarOut"
  Save-DockerImageGz -image $Image -outPath $TarOut
  if (-not (Test-Path $TarOut)) { Fail "save output missing: $TarOut" }
  $sz = (Get-Item $TarOut).Length / 1MB
  Write-Host ("   size: {0:N1} MB" -f $sz) -ForegroundColor Gray
} else {
  Write-Host "(skip save)" -ForegroundColor Yellow
}

# ---- 3) scp ----------------------------------------------------------------
Step "3/4" "scp -> $($NasUser)@$($NasHost):$NasDir"
$remoteTar = "$NasDir/familyboard.tar.gz"

# NAS 준비: 디렉터리 보장 + 이전 tar/잘못된 compose 확장자 정리
$prepCmd = "mkdir -p '$NasDir' 2>/dev/null; rm -f '$remoteTar' 2>/dev/null; rm -f '$NasDir/docker-compose.yaml' 2>/dev/null; exit 0"
& ssh -p $NasPort -o StrictHostKeyChecking=accept-new "$($NasUser)@$($NasHost)" $prepCmd | Out-Null

ScpSend $TarOut               $remoteTar
ScpSend ".\docker-compose.yml" "$NasDir/docker-compose.yml"

# .env: 기본은 NAS 기존 파일 유지. -PushEnv 이면 로컬 .env 로 항상 덮어씀.
$envLocal = '.\.env'
if (Test-Path $envLocal) {
  if ($PushEnv) {
    Write-Host "   -PushEnv: NAS .env 를 로컬 내용으로 덮어씁니다" -ForegroundColor Yellow
    ScpSend $envLocal "$NasDir/.env"
  } else {
    # Windows PowerShell 5.1 은 "..." 안의 && / || 도 문 구분자로 해석할 수 있음 → test 만 실행 후 exit code 로 판별
    & ssh -p $NasPort -o StrictHostKeyChecking=accept-new "$($NasUser)@$($NasHost)" "test -f '$NasDir/.env'"
    if ($LASTEXITCODE -ne 0) {
      Write-Host "   .env 가 NAS 에 없어서 업로드 (최초)" -ForegroundColor Yellow
      ScpSend $envLocal "$NasDir/.env"
    } else {
      Write-Host "   NAS .env 유지 (갱신하려면: .\scripts\deploy.ps1 -PushEnv)" -ForegroundColor DarkGray
    }
  }
}

# ---- 4) ssh: load + compose up (force-recreate) ----------------------------
Step "4/4" "ssh: docker load + compose up --force-recreate"
# here-string·-f 포맷 미사용: PS 5.1 에서 {0}/{{ }} 조합 파싱 오류 회피
$dockerPsFmt = 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
$remoteLines = @(
  'set -e'
  ('cd "' + $NasDir + '"')
  'echo "[load] gunzip | docker load"'
  'gunzip -c familyboard.tar.gz | sudo docker load'
  'echo "[compose] recreate"'
  'sudo docker rm -f familyboard 2>/dev/null || true'
  'sudo docker compose up -d --force-recreate'
  'echo "[prune] dangling images"'
  'sudo docker image prune -f >/dev/null'
  'sleep 2'
  'echo "[status]"'
  ('sudo docker ps --filter name=familyboard --format "' + $dockerPsFmt + '"')
  'echo "[health]"'
  ('curl -sS "http://localhost:' + $LocalPort + '/api/health" || true')
  'echo ""'
  'echo "[logs]"'
  'sudo docker logs --tail 5 familyboard 2>&1'
)
$remote = ($remoteLines -join [char]10) + [char]10

# 임시 .sh 에 LF + UTF-8 (BOM 없음) → scp 로 NAS 전송 → bash 실행
$tmpLocal = Join-Path $env:TEMP ("fb-remote-{0}.sh" -f ([guid]::NewGuid().ToString("N").Substring(0,8)))
$noBomUtf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmpLocal, $remote, $noBomUtf8)

& scp -O -P $NasPort -o StrictHostKeyChecking=accept-new $tmpLocal "$($NasUser)@$($NasHost):/tmp/fb-deploy.sh"
if ($LASTEXITCODE -ne 0) { Remove-Item $tmpLocal -Force; Fail "remote script upload failed" }

$sshBash = 'bash /tmp/fb-deploy.sh; rc=$?; rm -f /tmp/fb-deploy.sh; exit $rc'
& ssh -p $NasPort "$($NasUser)@$($NasHost)" $sshBash
$sshRc = $LASTEXITCODE
Remove-Item $tmpLocal -Force
if ($sshRc -ne 0) { Fail "remote deploy failed (rc=$sshRc)" }

# ---- cleanup local tarball -------------------------------------------------
if (Test-Path $TarOut) { Remove-Item $TarOut -Force }

$sw.Stop()
Write-Host ""
Write-Host ("OK  total {0}s" -f [int]$sw.Elapsed.TotalSeconds) -ForegroundColor Green
Write-Host ("   LAN    : http://{0}:{1}" -f $NasHost, $LocalPort)  -ForegroundColor Gray
Write-Host ("   Public : {0}" -f $PublicUrl)                       -ForegroundColor Gray
