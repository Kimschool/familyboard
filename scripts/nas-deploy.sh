#!/bin/bash
set -e

REPO_URL="https://github.com/Kimschool/familyboard"
BRANCH="main"
RUN_DIR="/volume1/docker/familyboard"
IMAGE="familyboard:latest"
TMP_DIR="/tmp/familyboard-build"

echo "=============================================="
echo " familyboard NAS-side deploy"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

cd "$RUN_DIR"
echo "[fetch] docker-compose.yml"
curl -sSfL "https://raw.githubusercontent.com/Kimschool/familyboard/${BRANCH}/docker-compose.yml" \
  -o docker-compose.yml.new \
  && mv docker-compose.yml.new docker-compose.yml

if [ ! -f .env ]; then
  echo "[err] .env 가 $RUN_DIR 에 없어요. DB 비번 · JWT 시크릿 등이 필요합니다."
  exit 1
fi

echo "[prepare] download source tarball"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

curl -sSfL "${REPO_URL}/archive/refs/heads/${BRANCH}.tar.gz" -o /tmp/familyboard.tar.gz
tar -xzf /tmp/familyboard.tar.gz -C "$TMP_DIR" --strip-components=1

echo "[docker] build $IMAGE from tarball source"
sudo docker build --pull -t "$IMAGE" "$TMP_DIR"

echo "[compose] up -d --force-recreate"
sudo docker compose -f "$RUN_DIR/docker-compose.yml" --env-file "$RUN_DIR/.env" up -d --force-recreate

sudo docker image prune -f >/dev/null

sleep 2
echo "[health]"
curl -sS http://localhost:3003/api/health || true
echo ""
sudo docker logs --tail 5 familyboard 2>&1 | sed 's/^/  /'

echo "=============================================="
echo " ✅ 배포 완료"
echo "=============================================="