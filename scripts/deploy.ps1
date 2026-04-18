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
  [switch] $SkipSave
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
  & scp -O -P $NasPort -o StrictHostKeyChecking=accept-new $local "${NasUser}@${NasHost}:${dst}"
  if ($LASTEXITCODE -ne 0) { Fail "scp failed: $local" }
}

function Save-DockerImageGz([string]$image, [string]$outPath) {
  $tempTar = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "fb_img_" + [System.Guid]::NewGuid() + ".tar")
  try {
    & docker save -o $tempTar $image
    if ($LASTEXITCODE -ne 0) { Fail "docker save failed" }

    $inS  = [System.IO.File]::OpenRead($tempTar)
    $outS = [System.IO.File]::Create($outPath)
    try {
      $gz = New-Object System.IO.Compression.GZipStream($outS, [System.IO.Compression.CompressionLevel]::Optimal)
      try { $inS.CopyTo($gz) } finally { $gz.Dispose() }
    } finally {
      $outS.Dispose()
      $inS.Dispose()
    }
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
Step "3/4" "scp -> ${NasUser}@${NasHost}:${NasDir}"
$remoteTar = "$NasDir/familyboard.tar.gz"

# NAS 준비: 디렉터리 보장 + 이전 tar/잘못된 compose 확장자 정리
$prepCmd = "mkdir -p '$NasDir' 2>/dev/null; rm -f '$remoteTar' 2>/dev/null; rm -f '$NasDir/docker-compose.yaml' 2>/dev/null; exit 0"
& ssh -p $NasPort -o StrictHostKeyChecking=accept-new "${NasUser}@${NasHost}" $prepCmd | Out-Null

ScpSend $TarOut               $remoteTar
ScpSend ".\docker-compose.yml" "$NasDir/docker-compose.yml"

# .env 는 비밀이라 NAS 에 있는 걸 유지. 로컬에 있고 NAS 에 없으면 최초 1회만 올림.
$envLocal = ".\.env"
if (Test-Path $envLocal) {
  $envCheck = & ssh -p $NasPort "${NasUser}@${NasHost}" "test -f '$NasDir/.env' && echo exists || echo missing"
  if ($envCheck -match "missing") {
    Write-Host "   .env 가 NAS 에 없어서 업로드 (최초)" -ForegroundColor Yellow
    ScpSend $envLocal "$NasDir/.env"
  }
}

# ---- 4) ssh: load + compose up (force-recreate) ----------------------------
Step "4/4" "ssh: docker load + compose up --force-recreate"
$remote = @"
set -e
cd '$NasDir'
echo '[load] gunzip | docker load'
gunzip -c familyboard.tar.gz | sudo docker load
echo '[compose] recreate'
sudo docker rm -f familyboard 2>/dev/null || true
sudo docker compose up -d --force-recreate
echo '[prune] dangling images'
sudo docker image prune -f >/dev/null
sleep 2
echo '[status]'
sudo docker ps --filter name=familyboard --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo '[health]'
curl -sS http://localhost:$LocalPort/api/health || true
echo ''
echo '[logs]'
sudo docker logs --tail 5 familyboard 2>&1
"@

$remote | & ssh -p $NasPort "${NasUser}@${NasHost}" 'bash -s'
if ($LASTEXITCODE -ne 0) { Fail "remote deploy failed" }

# ---- cleanup local tarball -------------------------------------------------
if (Test-Path $TarOut) { Remove-Item $TarOut -Force }

$sw.Stop()
Write-Host ""
Write-Host ("OK  total {0}s" -f [int]$sw.Elapsed.TotalSeconds) -ForegroundColor Green
Write-Host ("   LAN    : http://{0}:{1}" -f $NasHost, $LocalPort)  -ForegroundColor Gray
Write-Host ("   Public : {0}" -f $PublicUrl)                       -ForegroundColor Gray
