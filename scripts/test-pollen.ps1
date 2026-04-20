# Google Pollen API 로컬 진단 스크립트
# 사용법:
#   1) .env 에 GOOGLE_POLLEN_API_KEY=AIza... 추가 후 저장
#   2) PowerShell 에서:  scripts\test-pollen.ps1
#
# 결과 해석:
#   OK (200) + pollenTypeInfo: 키 정상. NAS .env 에도 동일 키 추가 후 배포하면 됨.
#   HTTP 400: 파라미터 오류 (거의 없음). 요청 URL 확인.
#   HTTP 403 PERMISSION_DENIED: Pollen API 가 GCP 프로젝트에서 활성화 안 됨.
#     -> https://console.cloud.google.com/apis/library/pollen.googleapis.com 에서 "사용" 클릭
#   HTTP 403 API_KEY_*: 키 제한(Referer/IP) 때문. 제한 풀거나 NAS IP 허용 목록 추가.
#   HTTP 403 BILLING_DISABLED: GCP 결제 계정 연결 필요 (Pollen API 는 결제 필수).
#   HTTP 429: 할당량 초과. 잠시 후 재시도.
#   네트워크 오류: 프록시/방화벽.

$ErrorActionPreference = 'Stop'

$envPath = Join-Path $PSScriptRoot '..\.env'
if (-not (Test-Path $envPath)) { Write-Host "ERR: .env 파일 없음: $envPath" -ForegroundColor Red; exit 1 }

$apiKey = $null
foreach ($line in Get-Content $envPath) {
  if ($line -match '^\s*GOOGLE_POLLEN_API_KEY\s*=\s*(.+?)\s*$') { $apiKey = $Matches[1].Trim('"').Trim("'"); break }
}
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  Write-Host "ERR: .env 에 GOOGLE_POLLEN_API_KEY 가 없거나 비어 있음" -ForegroundColor Red
  Write-Host "  .env 에 다음 줄 추가: GOOGLE_POLLEN_API_KEY=AIza..." -ForegroundColor Yellow
  exit 1
}

$keyPreview = $apiKey.Substring(0, [Math]::Min(10, $apiKey.Length)) + '...'
Write-Host ("KEY       : {0} (len={1})" -f $keyPreview, $apiKey.Length) -ForegroundColor Cyan

# 도쿄 신주쿠 근처로 테스트 (.env DEFAULT_LAT/LON 과 동일)
$lat = '35.6895'
$lon = '139.6917'
$url = "https://pollen.googleapis.com/v1/forecast:lookup?key=$([uri]::EscapeDataString($apiKey))&location.latitude=$lat&location.longitude=$lon&days=1&languageCode=ko"

Write-Host ("REQUEST   : GET pollen.googleapis.com ({0},{1}) days=1 ko" -f $lat, $lon) -ForegroundColor Cyan

try {
  $resp = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 15
  Write-Host ("HTTP      : {0} OK" -f $resp.StatusCode) -ForegroundColor Green
  $json = $resp.Content | ConvertFrom-Json
  $day = $json.dailyInfo[0]
  if (-not $day) { Write-Host "응답에 dailyInfo 없음" -ForegroundColor Yellow; $resp.Content; exit 0 }

  Write-Host "`n--- pollenTypeInfo (TREE/GRASS/WEED 통합) ---" -ForegroundColor Cyan
  foreach ($t in $day.pollenTypeInfo) {
    $v = if ($t.indexInfo) { $t.indexInfo.value } else { 'n/a' }
    $c = if ($t.indexInfo) { $t.indexInfo.category } else { 'n/a' }
    Write-Host ("  {0,-8} UPI={1,-3} {2}" -f $t.code, $v, $c)
  }

  Write-Host "`n--- plantInfo (종별: 스기/히노키/자작/삼나무 등) ---" -ForegroundColor Cyan
  if ($day.plantInfo) {
    foreach ($p in $day.plantInfo) {
      if (-not $p.indexInfo) { continue }
      $name = if ($p.displayName) { $p.displayName } else { $p.code }
      Write-Host ("  {0,-22} UPI={1,-3} {2}" -f $name, $p.indexInfo.value, $p.indexInfo.category)
    }
  } else {
    Write-Host "  (plantInfo 없음 — 해당 지역은 종별 상세 미제공)"
  }

  Write-Host "`n결과: API 연결 OK. 이 키를 NAS .env 에도 동일하게 넣고 배포하면 앱에서 정상 표시됨." -ForegroundColor Green
}
catch [System.Net.WebException] {
  $webResp = $_.Exception.Response
  if ($webResp) {
    $status = [int]$webResp.StatusCode
    $sr = New-Object System.IO.StreamReader($webResp.GetResponseStream())
    $body = $sr.ReadToEnd()
    Write-Host ("HTTP      : {0} {1}" -f $status, $webResp.StatusDescription) -ForegroundColor Red
    Write-Host "`n응답 본문:" -ForegroundColor Yellow
    Write-Host $body
    Write-Host "`n가장 가능성 높은 원인:"
    if ($status -eq 403 -and $body -match 'SERVICE_DISABLED') {
      Write-Host "  -> Pollen API 가 GCP 프로젝트에서 미활성." -ForegroundColor Yellow
      Write-Host "     https://console.cloud.google.com/apis/library/pollen.googleapis.com"
    } elseif ($status -eq 403 -and $body -match 'BILLING') {
      Write-Host "  -> GCP 결제 계정 연결 필요. Pollen API 는 결제 활성이 필수." -ForegroundColor Yellow
    } elseif ($status -eq 403) {
      Write-Host "  -> API 키 제한(Referer/IP)으로 서버 요청 차단. 제한 해제 또는 NAS IP 허용." -ForegroundColor Yellow
    } elseif ($status -eq 400) {
      Write-Host "  -> 요청 파라미터 문제. API 키 포맷(AIza... 39자) 확인." -ForegroundColor Yellow
    } elseif ($status -eq 429) {
      Write-Host "  -> 할당량 초과. 잠시 후 재시도." -ForegroundColor Yellow
    }
  } else {
    Write-Host ("네트워크 오류: {0}" -f $_.Exception.Message) -ForegroundColor Red
  }
  exit 1
}
catch {
  Write-Host ("예외: {0}" -f $_.Exception.Message) -ForegroundColor Red
  exit 1
}
