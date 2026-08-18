# CLAUDE.md

Claude Code가 이 저장소에서 작업할 때 참고하는 지침입니다. 아래 내용은 실제 코드(`src/`, `frontend/`), `package.json`, `README.md`, git 이력을 직접 확인해서 작성했습니다. 저장소에서 근거를 찾지 못한 항목은 추측 없이 "확인 필요"로 표시했습니다.

## 1. 프로젝트 개요

유튜브 라이브 채팅에서 운영자가 지정한 시간 동안 특정 키워드를 입력한 시청자를 채널 ID 기준 중복 없이 모아, 외부 사이트 [Marble Roulette](https://lazygyu.github.io/roulette/)에 그대로 붙여넣을 수 있는 형식(쉼표 구분, 동명이인은 `이름*횟수`)으로 정리해주는 웹 도구입니다.

로그인/회원가입 기능이 없습니다. 브라우저가 생성한 세션 ID(`localStorage`)로 사용자별 상태를 서버 메모리에서 분리해서, 여러 사람이 같은 서버를 동시에 쓸 수 있게 만든 구조입니다.

**⚠️ 브랜치 주의**: 이 문서는 현재 체크아웃된 `develop` 브랜치 기준입니다. `git log`상으로는 `develop`이 아직 `main`과 동일한 커밋(`e556f7a Initial commit`)이고, 지금까지의 멀티유저 리팩터(세션 분리, 서버 API 키 미저장, 룰렛 자동 주입 제거)는 전부 **커밋되지 않은 워킹트리 변경사항**입니다. `main` 브랜치는 "각자 PC에 설치해서 혼자 쓰는" 다른 아키텍처(Playwright로 룰렛 페이지 자동 주입, API 키를 서버 `.env`에 저장)를 갖고 있고 이 문서가 다루는 대상이 아닙니다. 작업 전 `git branch --show-current`로 항상 브랜치를 확인하세요.

## 2. 아키텍처 / 주요 디렉터리

백엔드(Express/WS)와 프론트엔드(React)가 별도 `package.json`을 갖는 **2-프로젝트 구조**입니다. 하나의 모노레포는 아니고(워크스페이스 설정 없음), 개발 시 `npm run dev`가 두 프로젝트를 동시에 실행하고, 배포 시에는 프론트엔드 빌드 산출물을 백엔드가 정적 파일로 서빙하는 방식으로 합쳐집니다.

**백엔드 (`src/`, 저장소 루트 `package.json`)**

- `src/server.ts` — Express + `ws` WebSocket 서버. HTTP는 `X-Session-Id` 헤더, WebSocket은 `?session=` 쿼리스트링으로 세션을 식별해 `sessions: Map<string, Session>`에서 세션별 `Collector` / `LiveChatPoller` / 연결 정보를 완전히 분리 관리합니다. `SESSION_IDLE_MS`(3시간) 이상 비활성 세션은 주기적으로 정리됩니다. 정적 파일은 `frontend/dist`(React 빌드 산출물)와 `가이드/`(→ `/guide` 경로)를 서빙합니다.
- `src/collector.ts` — `Collector` 클래스(`EventEmitter` 상속). 상태 머신(`idle → collecting → collected`), 키워드 매칭(`exact`/`contains`), `channelId` 기준 중복 제거, "자동 바이인"(수동 추가 명단 — `start()`/`reset()`에서 지워지지 않고 `clearManualNames()`로만 초기화됨)을 담당합니다. 이 저장소에서 유일하게 유닛 테스트가 있는 모듈입니다.
- `src/youtube.ts` — YouTube Data API v3 클라이언트. `extractVideoId`(URL/ID 파싱), `resolveLiveChatId`(videoId → liveChatId), `LiveChatPoller`(채팅 폴링, 응답의 `pollingIntervalMillis`를 그대로 따름, 최소 간격은 `MIN_POLL_INTERVAL_MS`).
- `src/types.ts` — 백엔드 공유 타입(`MatchMode`, `ChatMessage`, `Participant`, `CollectorStatus`).
- `src/collector.test.ts` — `node:assert/strict` 기반의 유일한 테스트 파일. 별도 테스트 프레임워크 없음.

**프론트엔드 (`frontend/`, React + TypeScript + Vite, 별도 `package.json`)**

- `frontend/src/App.tsx` — 최상위 컴포넌트. 상태(웹소켓 상태/연결 정보/에러 메시지)를 소유하고 각 카드 컴포넌트에 props로 내려줍니다.
- `frontend/src/components/*.tsx` — 화면의 카드 단위 컴포넌트(`ApiKeyCard`, `ConnectCard`, `CollectSettingsCard`, `TimerBox`, `StatusCard`, `ManualBuyInCard`, `RouletteCard`). 원래 `public/index.html`의 섹션 0~5에 1:1 대응합니다.
- `frontend/src/hooks/useLiveStatus.ts` — WebSocket 연결(`/ws?session=...`, 끊기면 2초 후 재연결)로 `CollectorStatus`/연결 정보를 구독하는 훅.
- `frontend/src/hooks/useTimer.ts` — 수집 중일 때 1초마다 남은/경과 시간을 계산하는 훅.
- `frontend/src/lib/` — `api.ts`(세션 헤더 포함 POST 헬퍼), `storage.ts`(세션 ID/API 키 localStorage 접근), `format.ts`(시계·룰렛 명단 포맷), `constants.ts`.
- `frontend/src/types.ts` — `src/types.ts`와 동일한 모양을 의도적으로 **중복 정의**한 프론트엔드 전용 타입(백엔드 응답 계약). 백엔드 `CollectorStatus`/`Participant`/`MatchMode`를 바꾸면 반드시 이 파일도 같이 업데이트하세요 — 자동으로 동기화되지 않습니다.
- `frontend/vite.config.ts` — 개발 서버 프록시 설정. `/api`, `/guide`는 백엔드로 HTTP 프록시, `/ws`는 WebSocket 프록시(`ws: true`)로 `http://localhost:5175`(백엔드 기본 포트)를 가리킵니다.
- `frontend/public/sounds/alarm.mp3` — 라이선스 확인 후 사용 중인 3초 트림 오디오(출처는 README 참고 섹션). 임의 교체 시 라이선스 확인 필요.

**기타**

- `가이드/YouTube_API_키_발급_가이드.pdf` — 코드와 무관한, 사용자가 API 키를 발급받는 절차를 담은 PDF. 서버가 `/guide` 경로로 정적 서빙합니다.
- `src/rouletteAutomation.ts`는 `develop`에서 삭제됨(Playwright 기반 자동 주입은 `main` 전용 기능).
- 기존 바닐라 JS 프론트엔드(`public/index.html`, `dashboard.js`, `style.css`)는 React 마이그레이션 후 삭제되었습니다. `public/` 디렉터리 자체가 더 이상 존재하지 않습니다.

## 3. 명령어

```bash
npm install                       # 루트(백엔드) 의존성
npm install --prefix frontend     # 프론트엔드 의존성 (최초 1회, 또는 frontend/package.json 변경 시)

npm run dev             # 백엔드(tsx watch, 5175)와 프론트엔드(Vite dev server, 5173)를 concurrently로 동시 실행
npm run dev:server      # 백엔드만 (tsx watch src/server.ts)
npm run dev:web         # 프론트엔드만 (npm run dev --prefix frontend)
npm run start            # tsx src/server.ts — watch 없이 백엔드만 실행 (frontend/dist가 미리 빌드되어 있어야 화면이 뜸)
npm run build             # npm run build --prefix frontend (Vite 빌드 → frontend/dist) 후 tsc (백엔드 strict 모드 타입체크)
npm run test:collector    # tsx src/collector.test.ts — 유일한 자동화 테스트
```

- **개발 중에는 `http://localhost:5173`(Vite)으로 접속하세요.** Vite가 `/api`, `/guide`, `/ws`를 백엔드(5175)로 프록시합니다. `http://localhost:5175`로 직접 접속하면 개발 중에는 `frontend/dist`가 없어서(또는 오래된 빌드라서) 화면이 뜨지 않거나 최신 상태가 아닐 수 있습니다.
- **배포/운영 시에는 `npm run build` 후 `npm run start`**로 Express 서버 하나만 띄우고 `http://localhost:5175`(또는 실제 도메인)로 접속합니다. 이때는 프록시가 없고 Express가 `frontend/dist`를 직접 정적 서빙합니다.
- `npm run build`가 만드는 백엔드 `dist/`(tsc 산출물)는 `dev`/`start` 스크립트가 사용하지 않습니다(둘 다 `tsx`로 `.ts`를 직접 실행) — 이 부분은 프론트엔드 도입 이전부터 있던 특징으로, 순수 타입체크 목적에 가깝습니다.
- 린트: 백엔드는 별도 lint 명령 없음. 프론트엔드는 `npm run lint --prefix frontend`(oxlint).
- 타입만 빠르게 확인하려면 백엔드는 `npx tsc --noEmit`, 프론트엔드는 `npx tsc -b --noEmit --force` 또는 `npm run build --prefix frontend`(가장 확실함, `noEmit` 우회 이슈 없음).
- `PORT` 환경변수로 백엔드(Express) 포트 변경 가능(기본 5175). Vite 개발 서버 포트는 기본 5173(변경 시 `frontend/vite.config.ts`의 프록시 대상과 별개이므로 백엔드 포트만 맞으면 됨). `.env` 파일은 이 브랜치 코드에서 로드되지 않습니다(`dotenv` 의존성 제거됨) — 저장소 루트의 `.env`(빈 `YOUTUBE_API_KEY=`)는 현재 읽히지 않는 잔재 파일입니다.

## 4. 코드 작성 규칙 (기존 코드에서 관찰된 컨벤션)

**공통 (백엔드 + 프론트엔드)**

- TypeScript strict 모드, ESM. 2-space 들여쓰기, 작은따옴표, 세미콜론.
- 클래스·타입·인터페이스는 PascalCase(`Collector`, `LiveChatPoller`, `MatchMode`), 함수·변수는 camelCase.
- 주석은 한국어로, "무엇을"이 아니라 비직관적인 "왜"만 최소한으로 남깁니다(예: `server.ts`의 세션 격리 이유). 새 코드도 이 톤을 유지하세요 — 자명한 동작을 설명하는 주석은 추가하지 마세요.
- 사용자에게 보이는 문자열(에러 메시지, UI 라벨)은 한국어로 작성합니다.
- 불필요한 추상화나 방어 코드를 지양하고, 작은 순수 함수 위주의 실용적인 스타일을 유지합니다.

**백엔드 (`src/`)**

- **상대 경로 import는 소스가 `.ts`여도 반드시 `.js` 확장자로 작성**(예: `from './collector.js'`) — Node ESM 런타임 요구사항이며, 지키지 않으면 `tsx`/`node` 실행 시 모듈을 찾지 못합니다.
- 에러 처리 패턴: 라우트 핸들러는 try/catch 후 `res.status(4xx/5xx).json({ error: message })`로 응답. 내부 로직은 `Error`를 던지고 호출부(라우트)에서 잡습니다.

**프론트엔드 (`frontend/src/`)**

- 함수형 컴포넌트 + 훅만 사용합니다(클래스 컴포넌트 없음).
- import 확장자를 쓰지 않습니다(`./collector.js`처럼 쓰지 말 것) — Vite/번들러 관례이며 백엔드와 다릅니다. `verbatimModuleSyntax`가 켜져 있어 타입만 가져올 때는 반드시 `import type { ... }`을 씁니다.
- 컴포넌트 파일은 named export, 화면의 카드 하나당 컴포넌트 하나(`frontend/src/components/*.tsx`)가 원칙입니다. 상태는 필요한 최소 범위(대개 `App.tsx`)에서만 끌어올리고, 서버와 통신하는 로직은 `frontend/src/lib/`의 순수 함수로 분리합니다.
- 서버 응답 타입(`frontend/src/types.ts`)은 백엔드 `src/types.ts`를 **의도적으로 복제**한 것입니다. 자동 동기화되지 않으므로, 백엔드 타입을 바꾸면 함께 수정하세요.

## 5. 테스트 / 검증 방법

- `npm run test:collector`가 유일한 자동화 검증입니다. `Collector`에 로직을 추가하면 같은 파일의 `{ ... }` 블록 패턴으로 케이스를 추가하고 `console.log('PASS: ...')`로 표시하세요.
- `src/server.ts`, `src/youtube.ts`, `frontend/*`는 자동 테스트가 없습니다. 이 대화에서 실제로 써온 방식은: `npm run dev`로 두 서버(백엔드+Vite)를 띄우고 `curl -H "X-Session-Id: ..."`로 API를 직접 호출하거나, `http://localhost:5173`을 브라우저로 열어 실제 흐름을 확인하는 것입니다.
- 변경 후 최소한 다음을 실행하세요: `npx tsc --noEmit`(백엔드), `npm run test:collector`, (UI를 만졌다면) `npm run dev` 후 `http://localhost:5173`에서 브라우저로 골든 패스 확인.
- 프론트엔드를 만졌다면 `npm run build`(루트, 프론트엔드 빌드 + 백엔드 타입체크를 함께 수행)가 통과하는지, 필요하면 `npm run lint --prefix frontend`도 확인하세요.
- UI 변경을 검증할 때는 실제로 빌드된 프로덕션 서빙 경로(`npm run build && npm run start` → `http://localhost:5175`)도 한 번은 확인하는 것을 권장합니다 — Vite dev 프록시와 Express 정적 서빙은 별도 코드 경로라 dev에서만 되고 prod 빌드에서 깨지는 경우를 놓칠 수 있습니다.

## 6. 환경 변수 / 보안 주의사항

- 이 브랜치의 핵심 설계는 **YouTube API 키를 서버에 저장하지 않는 것**입니다(브라우저 `localStorage`에만 저장, 요청마다 전송). 서버 코드에서 API 키를 로깅하거나 세션 밖으로 영속화하는 코드를 추가하지 마세요.
- `.env`/`dotenv`를 다시 도입해 API 키를 서버에 저장하는 방향으로 되돌리는 변경은 `main`/`develop`의 설계 의도를 뒤집는 것이므로, 먼저 사용자에게 확인하세요.
- 세션 ID는 인증 수단이 아니라 단순 구분자입니다. 민감한 권한 제어를 세션 ID 존재 여부에만 의존해서 설계하지 마세요.

## 7. 변경 시 특히 주의할 영역

- `Collector`의 상태 전이와 "`manualNames`는 `start()`/`reset()`에서 지워지지 않는다"는 동작은 최근에 의도적으로 바뀐 것이고 테스트로 고정되어 있습니다. 되돌리는 변경은 사용자 확인이 필요합니다.
- `src/server.ts`의 세션 분리 로직(헤더/쿼리스트링 기반 라우팅)이 깨지면 서로 다른 사용자의 데이터가 섞이는 심각한 버그가 됩니다. 이 부분을 건드릴 때는 특히 신중하게 검증하세요.
- `frontend/public/sounds/alarm.mp3`, `가이드/*.pdf`는 바이너리 자산입니다 — 텍스트 편집 도구로 열거나 임의로 덮어쓰지 마세요.
- `main`과 구조가 다르므로 브랜치를 착각한 채 작업하지 않도록 주의하세요.
- Express 라우터는 non-ASCII 마운트 경로(예: `/가이드`)를 제대로 매칭하지 못합니다(`path-to-regexp` 이슈). 새 정적 라우트를 추가할 때 영문 경로로 마운트하세요(파일명 자체는 한글이어도 무방).
- `frontend/src/types.ts`는 `src/types.ts`의 의도적인 복제본입니다. 백엔드 응답 모양(`CollectorStatus` 등)을 바꾸면 반드시 함께 업데이트하세요 — 타입 불일치는 컴파일 타임에 잡히지 않고 런타임에만 드러납니다.
- WebSocket 경로는 `/ws`(쿼리 `?session=...`)이며, 이는 `frontend/vite.config.ts`의 프록시 매칭을 위한 구분입니다(백엔드 `WebSocketServer`는 경로 필터링을 하지 않고 모든 upgrade 요청을 받으므로, 경로 자체를 바꿔도 백엔드 코드 수정은 필요 없지만 프론트엔드와 vite.config.ts 양쪽을 함께 바꿔야 합니다).

## 8. 작업 완료 기준

저장소에 명시된 "Definition of Done" 문서는 없습니다(확인 안 됨). 이 저장소에서 실제로 쓰인 최소 기준을 권장합니다:

- `npx tsc --noEmit` 통과
- `npm run test:collector` 통과
- UI 변경 시 `npm run dev`로 실제 실행해 브라우저에서 확인 (타입체크·테스트만으로는 기능 동작을 보장하지 않음)

## 9. 커밋 / PR 규칙

저장소에 `CONTRIBUTING.md`나 PR 템플릿 파일은 없지만, 커밋 메시지 규칙은 사용자에게 직접 확인했습니다.

**커밋 단위 (사용자 확인됨)**

- 사용자의 작업 요구사항 하나가 끝날 때마다 커밋합니다. 여러 요청을 모아서 한 번에 커밋하지 않습니다.

**커밋 메시지 규칙 (사용자 확인됨)**

- 한국어로 작성합니다.
- Conventional Commits 스타일의 `type: 설명` 형식을 씁니다 — `feat`, `fix`, `docs`, `refactor`, `chore` 등 일반적인 type을 그대로 사용합니다(저장소가 별도로 정해둔 type 목록은 없음).
- **scope를 나타내는 괄호는 쓰지 않습니다.** 즉 `feat(server): ...`가 아니라 `feat: ...`로만 씁니다.
- 제목 한 줄로 부족하면, 본문에 한국어 불릿(`-`)으로 핵심 변경 사항을 나열합니다.
- 실제 적용 예시: `10ad839 feat: 로그인 없이 여러 사용자가 함께 쓰는 호스팅 구조로 전환`
- 커밋 만들 때 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` 트레일러를 붙입니다(이 세션에서 실제로 사용된 방식).

**아직 확인 필요**

- PR 템플릿이나 PR에 반드시 넣어야 할 체크리스트 유무
- `develop` → `main` 병합 전략(PR을 거치는지, 병합 시점 기준이 무엇인지 등)
