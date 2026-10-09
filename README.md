# Dancing Knight — 직접 수정하고 자동 배포하기

기존 나이트룸의 스탠다드·아토믹, 온라인 방, 같은 기기, 무작위 매칭,
채팅, 모바일 보드 디자인을 포함한 Cloudflare 배포용 소스입니다.
이 묶음은 업로드와 초기 연결을 위한 준비본입니다.
GitHub 업로드나 Cloudflare 계정 연결 자체를 대신 완료한 것은 아닙니다.

## 1. GitHub에 코드 올리기

대상 저장소: https://github.com/Gpermu/dancingknight

1. ZIP을 압축 해제합니다.
2. `package.json`과 `wrangler.json`이 보이는 폴더까지 들어갑니다.
3. 비어 있는 GitHub 저장소에서 **uploading an existing file**을 누릅니다.
4. 폴더 안의 파일과 하위 폴더를 모두 선택해서 업로드 영역으로 끌어 놓습니다.
   ZIP 자체나 바깥쪽 `dancingknight-cloudflare` 폴더를 통째로 올리지 마세요.
5. **Commit changes**를 눌러 `main` 브랜치에 저장합니다.
6. 저장소 첫 화면에 `package.json`, `wrangler.json`, `app`, `components`,
   `lib`, `drizzle`, `public` 등이 바로 보이면 올바르게 올라간 것입니다.

이 묶음은 100개 미만의 소스 파일이라 GitHub 웹 업로드로 한 번에 올릴 수 있습니다.
Windows에서 점으로 시작하는 파일도 빠지지 않도록 모두 선택합니다.
`node_modules`는 이 ZIP에 포함되어 있지 않으며 올릴 필요도 없습니다.

## 2. Cloudflare 데이터베이스 만들기 — 최초 한 번

1. https://dash.cloudflare.com 에 가입·로그인합니다.
2. 계정 메뉴의 **Storage & databases → D1**에서 **Create database**를 누릅니다.
3. 데이터베이스 이름을 `dancingknight-db`로 입력해 만듭니다.
4. 만들어진 데이터베이스의 **Database ID**를 복사합니다.
5. GitHub에서 `wrangler.json`을 열고 연필 모양 **Edit**을 누릅니다.
6. 아래 값만 실제 Database ID로 바꾼 뒤 **Commit changes**로 저장합니다.

```json
"database_id": "00000000-0000-4000-8000-000000000000"
```

Database ID는 API 토큰이나 비밀번호와 다릅니다. `binding`은 `DB`로 유지합니다.
새 데이터베이스는 비어 있으며, 첫 배포 시 방·채팅·매칭용 테이블이 만들어집니다.
기존 ChatGPT 사이트의 방 코드나 대화 기록이 자동 복사되지는 않습니다.

## 3. GitHub와 Cloudflare 연결 — 최초 한 번

Cloudflare에서 **Workers & Pages → Create application → Import a repository**를
선택하고 GitHub 연결을 승인한 뒤 `Gpermu/dancingknight`를 선택합니다.
일반 정적 Pages 프로젝트가 아닌 **Worker**로 배포합니다.

| 항목 | 입력값 |
| --- | --- |
| 프로젝트/Worker 이름 | `dancingknight` |
| Production branch | `main` |
| Root directory | 저장소 최상위, 기본값 유지 |
| Build command | `pnpm run build` |
| Deploy command | `pnpm run deploy` |
| Build variable: `PNPM_VERSION` | `11.25.0` |
| Build variable: `NODE_VERSION` | `24` |

기본 패키지 설치 단계는 켜 둡니다. `pnpm-lock.yaml`이 설치 버전을 고정합니다.
위 변수는 실행 중인 사이트의 Variables가 아닌 **빌드용 변수**입니다.
만들기 화면에 빌드 변수 항목이 없다면 프로젝트 생성 후
**Settings → Build/Builds → Build Variables and Secrets**에서 추가하고 재배포합니다.

빌드의 배포 권한에는 **D1 Edit**와 **Workers Scripts Edit**가 필요합니다.
Cloudflare가 자동 생성하는 배포 토큰에는 D1 권한이 빠질 수 있으므로,
**My Profile → API Tokens**에서 해당 빌드 토큰에 **Account → D1 → Edit**를 추가합니다.
또는 **Settings → Builds → API token**에서 그 권한이 포함된 토큰을 선택합니다.
토큰 값은 소스 파일이나 GitHub에 적지 말고 Cloudflare의 토큰 선택/비밀값 설정을 사용합니다.

**Save and Deploy** 후 배포 완료를 기다립니다.
주소는 `dancingknight.<본인의 하위 주소>.workers.dev` 형태입니다.
실제 주소는 배포 결과에 표시되는 링크를 사용합니다.

## 4. 이후 업데이트

작은 수정은 GitHub에서도 가능합니다.

1. 바꿀 파일을 엽니다.
2. 연필 모양 **Edit**을 누릅니다.
3. 코드를 고치고 **Commit changes**로 `main`에 저장합니다.
4. Cloudflare의 **Deployments**에서 성공 여부를 확인합니다.
5. 같은 사이트 주소를 새로 고침해서 확인합니다.

여러 파일을 바꾸려면 GitHub Desktop으로 저장소를 Clone한 뒤
VS Code에서 수정하고, GitHub Desktop의 **Commit to main → Push origin**을 사용하면 됩니다.

Git 명령은 저장소를 Clone한 폴더에서 실행합니다.

```bash
git add .
git commit -m "체스 사이트 수정"
git push origin main
```

컴퓨터에서 저장만 하면 공개 사이트는 바뀌지 않습니다.
GitHub의 `main`에 변경을 올리고 Cloudflare 배포가 성공해야 반영됩니다.
동일한 Worker 이름과 데이터베이스를 사용하면 이후에도 주소와 저장 데이터가 유지됩니다.
데이터베이스 구조를 바꾸는 경우에는 SQL 마이그레이션도 함께 준비해야 합니다.
`deploy` 명령은 새 마이그레이션만 적용하며 매번 테이블이나 기존 데이터를 지우지 않습니다.

## 5. 어떤 파일을 고치나요?

| 수정할 부분 | 파일 |
| --- | --- |
| 모드 선택·스탠다드/아토믹 이름 | `components/mode-picker.tsx` |
| 체스 화면·보드·채팅 화면 | `components/chess-room.tsx` |
| 색상·레이아웃·모바일 디자인 | `app/globals.css` |
| 브라우저 탭 제목 | `app/layout.tsx` |
| 일반 체스 판정 | `lib/chess-rules.ts` |
| 서버용 스탠다드·아토믹 규칙 엔진 | `lib/game-engine.ts` |
| 방·수 두기·채팅 서버 | `app/api/room/route.ts` |
| 무작위 매칭 서버 | `app/api/match/route.ts` |
| 배포 이름·데이터베이스 연결 | `wrangler.json` |

## 6. 내 컴퓨터에서 실행하기

Node.js 24 LTS와 pnpm 11.25.0을 사용합니다. 프로젝트 폴더의 터미널에서:

```bash
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm run db:local
pnpm run dev
```

브라우저에서 http://localhost:5173 을 엽니다.
로컬 실행에는 Cloudflare 로그인이 필요하지 않습니다.
로컬 데이터베이스는 실제 사이트의 데이터와 분리됩니다.

```bash
pnpm run check
pnpm run test
pnpm run build
pnpm run preview
```

내 컴퓨터에서 직접 배포하는 경우, 실제 Database ID를 설정한 뒤:

```bash
pnpm exec wrangler login
pnpm run build
pnpm run deploy
```

## 공식 도움말

- GitHub 파일 업로드: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Cloudflare Git 자동 배포: https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare 빌드 도구 버전: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
- D1 시작하기: https://developers.cloudflare.com/d1/get-started/

소스 기준: 기존 나이트룸 배포 버전 4, 커밋 `702011f1d9108967996ba47a85b6954aee7a9628`.
Cloudflare용으로 배포 설정을 옮겼으며, 체스 기능 코드는 유지했습니다.
