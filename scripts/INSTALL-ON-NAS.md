# NAS 에서 직접 배포하기 — 핸드폰 원터치 세팅

## 아이디어
- Windows PC 에서 이미지 빌드 후 scp 할 필요 없음
- 핸드폰 SSH → NAS 안에서 `git pull → docker build → compose up` 다 처리
- 핸드폰 한 줄로 배포 끝

---

## 최초 1회 세팅 (PC 또는 핸드폰에서)

**git 불필요** — docker 가 GitHub URL 에서 직접 빌드합니다.

### 방법 A: 핸드폰 SSH 한 번으로 (권장)
```bash
ssh kimjh@192.168.11.31
curl -sL https://raw.githubusercontent.com/Kimschool/familyboard/main/scripts/nas-deploy.sh > ~/deploy-fb.sh
chmod +x ~/deploy-fb.sh
~/deploy-fb.sh
```

### 방법 B: PC 에서 scp
```bash
scp -O scripts/nas-deploy.sh kimjh@192.168.11.31:~/deploy-fb.sh
ssh kimjh@192.168.11.31 "chmod +x ~/deploy-fb.sh && ~/deploy-fb.sh"
```

### 필수 전제
- `/volume1/docker/familyboard/.env` 가 이미 있어야 해요 (DB 비번 · JWT 시크릿). 이전 배포에서 이미 생성됨.
- docker ≥ 20.10 (UGOS 내장 docker 는 26 이상).

---

## 일상 사용 (핸드폰에서)

핸드폰 SSH 앱 (Termius / Blink / Prompt / JuiceSSH) 에서:

```bash
~/deploy-fb.sh
```

끝. 커밋 해시·로그·헬스체크까지 출력됨.

---

## iOS Shortcut 로 원터치 만들기

1. 단축어 앱 → 새 단축어
2. "Run Script over SSH" 액션 추가
3. Host `192.168.11.31`, User `kimjh`, Key 등록
4. Script: `~/deploy-fb.sh`
5. 홈 화면 아이콘으로 추가

→ 아이콘 한 번 탭하면 배포.

---

## Android Tasker / Termux 방식

```bash
# Termux 에 openssh 설치 후
ssh kimjh@192.168.11.31 "~/deploy-fb.sh"
```
위를 Tasker Task 로 만들고 위젯 배치.

---

## Claude Code 쓰레드에서 한 번 말로 배포할 때

여전히 가능합니다. 다음 메시지에 `배포해` 치시면 됩니다 — 다만 이 경우 **Claude Code 가 돌고 있는 PC 에서 scp 하는 기존 방식**이 쓰입니다 (NAS 스크립트 방식과 혼용 OK, 결과물은 동일).
