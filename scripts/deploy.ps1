param(
  [string]$NasHost = "192.168.11.31",
  [string]$NasUser = "kimjh",
  [string]$NasDir  = "/volume1/docker/familyboard",
  [string]$Image   = "familyboard:latest"
)

$ErrorActionPreference = "Stop"
$project = "familyboard"

Write-Host "1) Building docker image..." -ForegroundColor Cyan
docker build -t $Image .

Write-Host "2) Saving image..." -ForegroundColor Cyan
$tar = "$project.tar.gz"
docker save $Image | & "C:\Program Files\Git\usr\bin\gzip.exe" -c | Out-File -FilePath $tar -Encoding Byte
# fallback: if above is awkward on your machine, use WSL: wsl docker save $Image `| gzip `> $tar

Write-Host "3) Copying to NAS $NasHost:$NasDir ..." -ForegroundColor Cyan
ssh "$NasUser@$NasHost" "mkdir -p $NasDir"
scp $tar "docker-compose.yml" ".env" "${NasUser}@${NasHost}:$NasDir/"

Write-Host "4) Loading + compose up on NAS..." -ForegroundColor Cyan
ssh "$NasUser@$NasHost" @"
cd $NasDir
gunzip -c $tar | sudo docker load
sudo docker compose up -d --force-recreate
sudo docker image prune -f
"@

Write-Host "Done." -ForegroundColor Green
