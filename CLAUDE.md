&#x20;# 인프라 및 배포 공통 컨텍스트



&#x20; ## NAS (UGOS / UGREEN)

&#x20; - \*\*호스트:\*\* `192.168.11.31` (LAN)

&#x20; - \*\*SSH:\*\* 사용자 `kimjh`, 포트 22, 키 인증

&#x20; - \*\*sudo:\*\* `NOPASSWD` — `/usr/bin/docker`

&#x20; - \*\*Docker 배포 루트:\*\* `/volume1/docker/<project>/`  (e.g. `/volume1/docker/voice-memo`,

&#x20; `/volume1/docker/businesscard`)

&#x20; - \*\*영구 데이터 볼륨:\*\* `/volume2/<project-data>/...` (한글 경로 OK, 예: `/volume2/명함데이터`,

&#x20; `/volume2/음성녹음데이터`)



&#x20; ## MySQL (NAS docker 컨테이너)

&#x20; - \*\*호스트 포트:\*\* `3307` (기본 3306 아님)

&#x20; - \*\*계정:\*\* `kimjh`@`%` — 새 DB마다 1회 권한 부여 필요

&#x20; - \*\*초기화 쿼리 (root로 NAS MySQL 접속):\*\*

&#x20;   ```sql

&#x20;   CREATE DATABASE <db\_name> CHARACTER SET utf8mb4 COLLATE utf8mb4\_unicode\_ci;

&#x20;   GRANT ALL PRIVILEGES ON <db\_name>.\* TO 'kimjh'@'%';

&#x20;   FLUSH PRIVILEGES;

&#x20; - 앱에서 접속: host = 192.168.11.31 (또는 NAS 내부 컨테이너 네트워크), port = 3307



&#x20; Cloudflare / 공개 URL



&#x20; - 도메인: weavus-group.com (Cloudflare DNS 관리 → NAS)

&#x20; - 서브도메인 규칙: 프로젝트별 서브도메인

&#x20;   - voice-memo → rc.weavus-group.com

&#x20;   - businesscard → card.weavus-group.com

&#x20; - TLS: Cloudflare / NAS 리버스 프록시에서 종단 (앱은 평문 HTTP)



&#x20; 배포 패턴 (표준)



&#x20; 레지스트리 안 씀. docker save → scp → docker load 플로우.



&#x20; 1. docker build -t <project>:latest .

&#x20; 2. docker save <project>:latest | gzip > <project>.tar.gz

&#x20; 3. scp <project>.tar.gz docker-compose.yml kimjh@192.168.11.31:/volume1/docker/<project>/

&#x20; 4. SSH:

&#x20; cd /volume1/docker/<project>

&#x20; gunzip -c <project>.tar.gz | sudo docker load

&#x20; sudo docker compose up -d --force-recreate

&#x20; sudo docker image prune -f



&#x20; 참고 스크립트 (복사해서 프로젝트명만 바꾸면 됨):

&#x20; - C:\\dev\\voice\\scripts\\deploy.ps1

&#x20; - C:\\dev\\businesscard\\scripts\\deploy.ps1

&#x20; - C:\\dev\\businesscard\\scripts\\docker-save-compressed.ps1



&#x20; docker-compose.yml 형식 (관례)



&#x20; version: "3.9"

&#x20; services:

&#x20;   <project>:

&#x20;     image: <project>:latest

&#x20;     container\_name: <project>

&#x20;     restart: unless-stopped

&#x20;     ports:

&#x20;       - "${HOST\_PORT:-<port>}:<port>"

&#x20;     env\_file:

&#x20;       - .env

&#x20;     volumes:

&#x20;       - ${NAS\_DATA\_DIR:-/volume2/<project>데이터}:/app/data



&#x20; .env 관례



&#x20; - .env.example을 저장소에 커밋, .env는 .gitignore

&#x20; - 공통 키: DB\_HOST=192.168.11.31, DB\_PORT=3307, DB\_USER=kimjh, DB\_PASSWORD=..., DB\_NAME=<project>

&#x20; - 앱 고유 키는 별도 추가 (JWT\_SECRET, ANTHROPIC\_API\_KEY, SMTP\_\*, 등)



&#x20; 기술 스택 관례



&#x20; - Node.js + Express 단일 컨테이너 (프런트/백 분리 X)

&#x20; - PWA: public/ 디렉토리로 정적 서빙

&#x20; - 파일 레이아웃: server.js, auth.js, db.js, public/, scripts/deploy.ps1, Dockerfile, docker-compose.yml, .env.example

&#x20; - DB 스키마: 앱 부팅 시 ensureSchema()가 CREATE TABLE IF NOT EXISTS ... 멱등 실행

&#x20; - Auth: JWT + bcrypt, 세션 토큰은 DB sessions 테이블

&#x20; - Claude API 사용 시 기본 모델: claude-sonnet-4-6 (또는 claude-opus-4-7)



&#x20; ---



&#x20; \*\*새 폴더 사용법:\*\*

&#x20; 1. 새 프로젝트 루트에 위 내용을 `CLAUDE.md`로 저장 → Claude가 자동 로드

&#x20; 2. `<project>`, `<port>`, 서브도메인만 바꾸면 바로 기존 파이프라인 재사용

&#x20; 3. 참고 스크립트 복사: `cp -r C:\\dev\\businesscard\\scripts C:\\dev\\<new>\\scripts` 후 파일명·컨테이너명만 `businesscard`

&#x20; → 신규 프로젝트명으로 일괄 치환



&#x20; 원하시면 지금 새 폴더 경로 알려주시면 `CLAUDE.md`와 scripts 템플릿을 제가 직접 그 위치에 복사해 드릴게요.

