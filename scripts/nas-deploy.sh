#!/bin/bash
# NAS 에서 직접 실행하는 배포 스크립트 (git 설치 불필요).
# docker build 의 GitHub URL 기능으로 최신 main 을 받아 빌드한다.
#
# 사용법:
#   ssh kimjh@192.168.11.31 (또는 Tailscale IP)
#   ~/deploy-fb.sh
#
# 최초 1회:
#   curl -sL https://raw.githubusercontent.com/Kimschool/familyboard/main/scripts/nas-deploy.sh > ~/deploy-fb.sh
#   chmod +x ~/deploy-fb.sh

set -e

REPO_URL="https://github.com/Kimschool/familyboard.git"
BRANCH="main"
RUN_DIR="/volume1/docker/familyboard"
IMAGE="familyboard:latest"

echo "=============================================="
echo " familyboard NAS-side deploy"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# ---- 0) 최신 docker-compose.yml 받아오기 ----
cd "$RUN_DIR"
echo "[fetch] docker-compose.yml"
curl -sSfL "https://raw.githubusercontent.com/Kimschool/familyboard/${BRANCH}/docker-compose.yml" \
  -o docker-compose.yml.new \
  && mv docker-compose.yml.new docker-compose.yml

if [ ! -f .env ]; then
  echo "[err] .env 가 $RUN_DIR 에 없어요. DB 비번 · JWT 시크릿 등이 필요합니다."
  exit 1
fi

# ---- 1) docker 가 직접 git URL 에서 빌드 (git 바이너리 불필요) ----
echo "[docker] build $IMAGE from $REPO_URL#$BRANCH"
sudo docker build --pull -t "$IMAGE" "$REPO_URL#$BRANCH"

# ---- 2) compose 재시작 ----
echo "[compose] up -d --force-recreate"
sudo docker compose up -d --force-recreate
sudo docker image prune -f >/dev/null

# ---- 3) 헬스체크 ----
sleep 2
echo "[health]"
curl -sS http://localhost:3003/api/health || true
echo ""
sudo docker logs --tail 5 familyboard 2>&1 | sed 's/^/  /'

echo "=============================================="
echo " ✅ 배포 완료"
echo "=============================================="
