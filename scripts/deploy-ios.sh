#!/bin/bash
# 가족보드 iOS 배포 자동화
# 1) cap sync (public/ → ios/)
# 2) build number 자동 증가 (timestamp 기반)
# 3) xcodebuild archive
# 4) xcodebuild exportArchive → .ipa
# 5) xcrun altool 으로 App Store Connect 업로드 → TestFlight 자동 진입
#
# 사용법: ./scripts/deploy-ios.sh
# 시크릿: scripts/.env.local 에 APPSTORE_* 변수, ~/.appstoreconnect/private_keys/AuthKey_*.p8

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# .env.local 로드
if [ ! -f scripts/.env.local ]; then
  echo "❌ scripts/.env.local 없음. APPSTORE_KEY_ID 등 환경변수 설정 필요."
  exit 1
fi
set -a
source scripts/.env.local
set +a

if [ ! -f "$HOME/.appstoreconnect/private_keys/AuthKey_${APPSTORE_KEY_ID}.p8" ]; then
  echo "❌ ~/.appstoreconnect/private_keys/AuthKey_${APPSTORE_KEY_ID}.p8 없음."
  exit 1
fi

ARCHIVE_PATH="/tmp/familyboard.xcarchive"
EXPORT_PATH="/tmp/familyboard-export"
EXPORT_OPTIONS="$PROJECT_ROOT/scripts/ios-export-options.plist"
IPA_PATH="$EXPORT_PATH/Familyboard.ipa"
BUILD_NUMBER=$(date +%y%m%d%H%M)

echo "=========================================="
echo " 가족보드 iOS 배포"
echo "  Build: $BUILD_NUMBER"
echo "=========================================="

echo ""
echo "▶ 1/5  cap sync ios"
npx cap sync ios

echo ""
echo "▶ 2/5  Archive (build $BUILD_NUMBER)"
rm -rf "$ARCHIVE_PATH"
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  CURRENT_PROJECT_VERSION=$BUILD_NUMBER \
  clean archive

echo ""
echo "▶ 3/5  Export to .ipa"
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS"

if [ ! -f "$IPA_PATH" ]; then
  echo "❌ .ipa 생성 실패"
  ls -la "$EXPORT_PATH"
  exit 1
fi
IPA_SIZE=$(du -h "$IPA_PATH" | cut -f1)
echo "  ${IPA_PATH} (${IPA_SIZE})"

echo ""
echo "▶ 4/5  Validate"
xcrun altool --validate-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$APPSTORE_KEY_ID" \
  --apiIssuer "$APPSTORE_ISSUER_ID"

echo ""
echo "▶ 5/5  Upload to App Store Connect"
xcrun altool --upload-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$APPSTORE_KEY_ID" \
  --apiIssuer "$APPSTORE_ISSUER_ID"

echo ""
echo "=========================================="
echo " ✅ 배포 완료 — Build $BUILD_NUMBER"
echo "  App Store Connect → TestFlight 탭에서 처리(10~20분) 후"
echo "  내부 테스터 초대 진행."
echo "=========================================="
