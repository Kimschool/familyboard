# NAS 에서 직접 배포하기 — 핸드폰 원터치 세팅

## 아이디어
- Windows PC 에서 이미지 빌드 후 scp 할 필요 없음
- 핸드폰 SSH → NAS 안에서 `git pull → docker build → compose up` 다 처리
- 핸드폰 한 줄로 배포 끝

---

## 최초 1회 세팅 (PC에서 한 번만)

### 1) git 이 NAS 에 있는지 확인
```bash
ssh kimjh@192.168.11.31 "which git || sudo opkg install git || echo 'git 수동 설치 필요'"
```
> UGOS 앱스토어나 Entware 로 git 설치 가능. 없으면 nas-deploy.sh 에서 `git clone` 부분만 외부에서 복사하는 방식으로 대체 가능.

### 2) 배포 스크립트를 NAS 에 배포
```bash
scp -O scripts/nas-deploy.sh kimjh@192.168.11.31:~/deploy-fb.sh
ssh kimjh@192.168.11.31 "chmod +x ~/deploy-fb.sh"
```

### 3) 최초 clone 확인 (스크립트가 알아서 해줌)
```bash
ssh kimjh@192.168.11.31 "~/deploy-fb.sh"
```
처음 실행되면 `/volume1/docker/familyboard/src` 에 repo clone, 빌드, compose up 까지 자동.

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
