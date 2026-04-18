#!/bin/bash
# NAS 에서 직접 실행하는 배포 스크립트.
# GitHub 에서 최신 코드를 받아 NAS 에서 빌드·재시작까지 자동 처리.
#
# 사용법 (핸드폰 SSH 에서):
#   ssh kimjh@192.168.11.31
#   ~/deploy-fb.sh        (또는 아래 경로 직접 실행)
#
# 최초 1회는 아래 "First-time setup" 섹션 참고.

set -e

REPO_URL="https://github.com/Kimschool/familyboard.git"
SRC_DIR="/volume1/docker/familyboard/src"
RUN_DIR="/volume1/docker/familyboard"
BRANCH="main"

echo "=============================================="
echo " familyboard NAS-side deploy"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# ---- 1) 최초 1회: git clone ----
if [ ! -d "$SRC_DIR/.git" ]; then
  echo "[init] cloning repo into $SRC_DIR"
  mkdir -p "$(dirname "$SRC_DIR")"
  git clone "$REPO_URL" "$SRC_DIR"
fi

# ---- 2) 최신 코드 pull ----
cd "$SRC_DIR"
echo "[git] fetch + reset to origin/$BRANCH"
git fetch --prune origin
git reset --hard "origin/$BRANCH"
COMMIT=$(git rev-parse --short HEAD)
SUBJECT=$(git log -1 --pretty=%s)
echo "[git] now at $COMMIT — $SUBJECT"

# ---- 3) docker 빌드 ----
echo "[docker] build familyboard:latest"
sudo docker build -t familyboard:latest "$SRC_DIR"

# ---- 4) compose 재시작 ----
cd "$RUN_DIR"
if [ ! -f docker-compose.yml ]; then
  echo "[compose] docker-compose.yml 이 $RUN_DIR 에 없어요."
  echo "          src/docker-compose.yml 을 $RUN_DIR/ 로 복사하세요:"
  echo "          cp $SRC_DIR/docker-compose.yml $RUN_DIR/"
  exit 1
fi
if [ ! -f .env ]; then
  echo "[compose] .env 가 $RUN_DIR 에 없어요. DB 비번/JWT 시크릿 등이 필요해요."
  exit 1
fi
echo "[compose] up -d --force-recreate"
sudo docker compose up -d --force-recreate
sudo docker image prune -f >/dev/null

# ---- 5) 헬스체크 ----
sleep 2
echo "[health]"
curl -s http://localhost:3003/api/health || true
echo ""
sudo docker logs --tail 5 familyboard

echo "=============================================="
echo " ✅ 배포 완료  ($COMMIT)"
echo "=============================================="
