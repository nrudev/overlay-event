# AGENTS.md

이 문서는 이 저장소에서 작업하는 모든 코딩 에이전트(도구 무관)를 위한 지침입니다. 특정 에이전트 도구나 인터페이스를 전제하지 않으며, 아래 내용은 실제 코드(`src/`, `frontend/`), `package.json`, `README.md`, git 이력을 직접 확인해서 작성했습니다. 근거를 찾지 못한 항목은 "확인 필요"로 명시했습니다.

## 브랜치 상태 (중요)

이 문서는 현재 체크아웃된 `develop` 브랜치의 워킹트리 기준으로 작성되었습니다. `git log`상 `develop`은 아직 `main`과 동일한 커밋(`e556f7a Initial commit`)이며, 여기 기술된 아키텍처(세션 분리, 서버에 API 키 미저장, 룰렛 자동 주입 없음)는 전부 **미커밋 워킹트리 변경사항**입니다. `main` 브랜치는 로그인 없이 "각자 PC에 설치해서 혼자 쓰는" 다른 구조(Playwright로 룰렛 페이지 자동 주입, API 키를 서버 `.env`에 저장)를 갖고 있으며 이 문서의 대상이 아닙니다. 작업 전 현재 브랜치를 확인하세요.

## 프로젝트 목적

유튜브 라이브 채팅에서 운영자가 지정한 시간 동안 특정 키워드를 입력한 시청자를 채널 ID 기준 중복 없이 모아, 외부 사이트 Marble Roulette(`https://lazygyu.github.io/roulette/`)에 붙여넣을 수 있는 형식(쉼표 구분, 동명이인은 `이름*횟수`)으로 정리해주는 웹 애플리케이션. 로그인 계정이 없고, 브라우저가 생성해 `localStorage`에 저장하는 세션 ID로 여러 사용자의 상태를 서버 메모리에서 분리해 하나의 서버를 동시에 공유한다.

## 기술 스택

- 백엔드: Node.js + TypeScript(ESM, `strict: true`). 런타임은 `tsx`(타입체크 없이 즉시 실행), 빌드는 `tsc`. `express`(HTTP), `ws`(WebSocket).
- 프론트엔드: React + TypeScript, 빌드/개발 서버는 Vite. `frontend/` 아래 별도 `package.json`을 가진 독립 프로젝트(워크스페이스 설정 없이 단순 하위 디렉터리).
- Python/기타 언어 런타임 없음. 모노레포 도구(workspaces, turborepo 등) 없음 — 백엔드/프론트엔드가 각자의 `package.json`을 갖고 `npm run dev`(루트)가 `concurrently`로 둘을 동시 실행. 패키지 매니저는 `npm`(양쪽 다 `package-lock.json` 존재).
- 린트/포매터/CI 설정: 백엔드는 없음. 프론트엔드는 `oxlint`(`npm run lint --prefix frontend`)만 있고 별도 CI 워크플로는 없음.

## 디렉터리 / 모듈 구조

**백엔드 (`src/`, 루트 `package.json`)**

| 경로 | 역할 |
|---|---|
| `src/server.ts` | Express + WebSocket 서버. `X-Session-Id` 헤더(WS는 `?session=` 쿼리)로 세션 식별, `Map<string, Session>`으로 세션별 `Collector`/폴러/연결 상태를 완전히 분리. 비활성 세션(3시간, `SESSION_IDLE_MS`) 주기 정리. `frontend/dist`(React 빌드)와 `가이드/`(→ `/guide`)를 정적 서빙. |
| `src/collector.ts` | `Collector` 클래스(`EventEmitter`). 상태 머신 `idle → collecting → collected`, 키워드 매칭(`exact`/`contains`), `channelId` 기준 중복 제거, "자동 바이인"(수동 추가 명단, `start()`/`reset()`에 유지되고 `clearManualNames()`로만 초기화). 유일하게 테스트가 있는 모듈. |
| `src/youtube.ts` | YouTube Data API v3 클라이언트: `extractVideoId`, `resolveLiveChatId`, `LiveChatPoller`(응답의 `pollingIntervalMillis`를 그대로 따름). |
| `src/types.ts` | 백엔드 공유 타입(`MatchMode`, `ChatMessage`, `Participant`, `CollectorStatus`). |
| `src/collector.test.ts` | `node:assert/strict` 기반 유일한 테스트. 프레임워크 없음. |

**프론트엔드 (`frontend/`, React + TypeScript + Vite, 별도 `package.json`)**

| 경로 | 역할 |
|---|---|
| `frontend/src/App.tsx` | 최상위 컴포넌트. WebSocket 상태/연결 정보/에러 메시지를 소유하고 카드 컴포넌트에 props로 전달. |
| `frontend/src/components/*.tsx` | 카드 단위 컴포넌트(`ApiKeyCard`, `ConnectCard`, `CollectSettingsCard`, `TimerBox`, `StatusCard`, `ManualBuyInCard`, `RouletteCard`). 옛 `public/index.html` 섹션 0~5에 1:1 대응. |
| `frontend/src/hooks/useLiveStatus.ts` | `/ws?session=...`로 WebSocket을 연결하고(끊기면 2초 후 재연결) `CollectorStatus`/연결 정보를 구독하는 훅. |
| `frontend/src/hooks/useTimer.ts` | 수집 중일 때 1초마다 남은/경과 시간을 계산하는 훅. |
| `frontend/src/lib/*.ts` | `api.ts`(세션 헤더 포함 POST 헬퍼), `storage.ts`(세션 ID/API 키 localStorage), `format.ts`(시계·룰렛 명단 포맷), `constants.ts`. |
| `frontend/src/types.ts` | `src/types.ts`와 같은 모양을 **의도적으로 복제**한 프론트엔드 전용 타입. 자동 동기화되지 않으므로 백엔드 타입 변경 시 함께 수정 필요. |
| `frontend/vite.config.ts` | 개발 서버 프록시: `/api`, `/guide`는 HTTP로, `/ws`는 WebSocket으로 `http://localhost:5175`(백엔드)에 프록시. |
| `frontend/public/sounds/alarm.mp3` | 라이선스 확인 후 사용 중인 3초 트림 오디오 자산(출처: README 참고 섹션). 교체 시 라이선스 확인 필요. |

**기타**

| 경로 | 역할 |
|---|---|
| `가이드/YouTube_API_키_발급_가이드.pdf` | 코드와 무관한 사용자용 API 키 발급 안내 PDF. 서버가 `/guide` 경로로 정적 서빙. |

`src/rouletteAutomation.ts`(Playwright 기반 룰렛 자동 주입)는 이 브랜치에서 삭제됨 — `main` 전용 기능이었음. 기존 바닐라 JS 프론트엔드(`public/`)는 React 마이그레이션 후 완전히 삭제됨.

## 명령어 (package.json 스크립트, 실제 확인됨)

```bash
npm install                       # 루트(백엔드) 의존성
npm install --prefix frontend     # 프론트엔드 의존성 (최초 1회)

npm run dev             # 백엔드(tsx watch, 5175) + 프론트엔드(Vite dev, 5173) 동시 실행 (concurrently)
npm run dev:server      # 백엔드만
npm run dev:web         # 프론트엔드만
npm run start            # tsx src/server.ts, watch 없음 (frontend/dist가 미리 빌드돼 있어야 화면이 뜸)
npm run build             # frontend 빌드(Vite → frontend/dist) 후 백엔드 tsc 타입체크
npm run test:collector    # tsx src/collector.test.ts (유일한 자동화 테스트)
```

추가로 확인된 사항:
- **개발 중에는 `http://localhost:5173`(Vite)로 접속**. Vite가 `/api`, `/guide`, `/ws`를 백엔드(5175)로 프록시함. `http://localhost:5175`는 개발 중에는 `frontend/dist`가 없거나 오래된 빌드일 수 있어 화면이 최신이 아닐 수 있음.
- **배포/운영 시에는 `npm run build` 후 `npm run start`**로 Express 서버 하나만 띄우고 `http://localhost:5175`로 접속(프록시 없이 Express가 `frontend/dist`를 직접 정적 서빙).
- 백엔드 `npm run build`의 산출물(`dist/`)은 `dev`/`start`가 사용하지 않음(둘 다 `tsx`로 `.ts`를 직접 실행) — 프론트엔드 도입 이전부터 있던 특징.
- 린트: 백엔드는 없음. 프론트엔드는 `npm run lint --prefix frontend`(oxlint).
- 타입 체크만 하려면: 백엔드는 `npx tsc --noEmit`, 프론트엔드는 `npm run build --prefix frontend`.
- 환경변수: `PORT`(선택, 기본 5175, 백엔드)만 코드가 실제로 읽음(`process.env.PORT`). Vite 개발 서버 포트는 기본 5173. `dotenv` 의존성이 없어 `.env` 파일은 로드되지 않음 — 저장소 루트에 있는 `.env`(빈 `YOUTUBE_API_KEY=`)는 현재 코드에서 사용되지 않는 잔재 파일이며, `.env.example`은 이 브랜치에 없음.

## 코드 스타일 규칙 (기존 코드에서 관찰된 컨벤션)

**공통**

- TypeScript strict 모드, ESM. 2-space 들여쓰기, 작은따옴표 문자열, 세미콜론 사용.
- 네이밍: 클래스/타입/인터페이스는 PascalCase(`Collector`, `LiveChatPoller`, `MatchMode`), 함수/변수는 camelCase.
- 주석은 한국어, "무엇을 하는지"가 아니라 비직관적인 "왜"만 최소한으로 작성(예: 세션 격리 이유). 자명한 동작에는 주석을 달지 않음 — 새 코드도 이 관례를 따를 것.
- 사용자에게 노출되는 문자열(에러 메시지, UI 라벨)은 한국어.
- 불필요한 추상화·방어 코드를 피하고, 작은 순수 함수 위주의 실용적 스타일을 유지.

**백엔드 (`src/`)**

- 상대 경로 import는 소스 파일이 `.ts`여도 **`.js` 확장자로 작성**해야 함(예: `import { Collector } from './collector.js'`) — Node ESM 런타임 요구사항이며 어기면 실행 시 모듈 해석에 실패함.
- 에러 처리: 라우트 핸들러는 try/catch 후 `res.status(4xx/5xx).json({ error: message })`로 응답. 내부 함수/클래스는 `Error`를 던지고 호출부에서 처리.

**프론트엔드 (`frontend/src/`)**

- 함수형 컴포넌트 + 훅만 사용(클래스 컴포넌트 없음).
- import에 확장자를 붙이지 않음(Vite/번들러 관례, 백엔드와 다름). `verbatimModuleSyntax`가 켜져 있어 타입만 가져올 때는 `import type { ... }`을 사용해야 함.
- 카드 하나당 컴포넌트 하나(`frontend/src/components/*.tsx`)가 원칙. 서버 통신 로직은 `frontend/src/lib/`의 순수 함수로 분리.
- `frontend/src/types.ts`는 백엔드 `src/types.ts`의 의도적인 복제본 — 자동 동기화 안 됨.

## 테스트 및 검증

- 자동화된 테스트는 `npm run test:collector` 하나뿐. `Collector`에 로직을 추가할 때는 같은 파일의 `{ ... }` 블록 패턴으로 케이스를 추가하고 `console.log('PASS: ...')`로 표시.
- `server.ts`/`youtube.ts`/`frontend/*`는 자동 테스트가 없음. 검증 방식: `npm run dev`로 두 서버(백엔드+Vite)를 실행한 뒤 `curl -H "X-Session-Id: <id>" ...`로 API를 직접 호출하거나, `http://localhost:5173`을 브라우저로 열어 확인.
- 변경 후 최소 확인 사항: `npx tsc --noEmit`(백엔드), `npm run test:collector`, (UI 변경 시) `npm run dev` 후 `http://localhost:5173`에서 실제 동작 확인.
- 프론트엔드를 만졌다면 `npm run build`(루트, 프론트엔드 빌드 + 백엔드 타입체크)와 필요시 `npm run lint --prefix frontend`도 통과하는지 확인.
- UI 변경 검증 시 `npm run build && npm run start` → `http://localhost:5175`(프로덕션 서빙 경로)도 한 번은 확인 권장 — dev 프록시와 prod 정적 서빙은 별도 코드 경로임.

## 환경 변수 및 보안 주의사항

- 핵심 설계 원칙: **YouTube API 키를 서버에 저장하지 않음**(브라우저 `localStorage`에만 저장, 요청마다 전송해서 그 순간에만 사용). 서버 코드에서 API 키를 로그로 남기거나 세션 객체 밖으로 영속화하는 코드를 추가하지 말 것.
- `dotenv`를 재도입해 API 키를 서버 파일에 저장하는 방향으로 되돌리는 변경은 현재 설계 의도를 뒤집는 것이므로, 먼저 사용자에게 확인할 것.
- 세션 ID는 인증 수단이 아니라 단순 구분자다. 민감한 권한 제어를 세션 ID 존재 여부에만 의존해 설계하지 말 것.

## 변경 시 특히 주의해야 하는 영역

- `Collector`의 상태 전이 규칙과 "`manualNames`는 `start()`/`reset()`으로 지워지지 않는다"는 동작은 최근 의도적으로 확정된 사양이며 테스트로 고정되어 있음. 되돌리려면 사용자 확인 필요.
- `src/server.ts`의 세션 분리 로직이 깨지면 서로 다른 사용자의 데이터가 섞이는 심각한 버그가 됨 — 이 영역을 수정할 때는 여러 세션으로 격리가 유지되는지 반드시 재검증할 것.
- `frontend/public/sounds/alarm.mp3`, `가이드/*.pdf`는 바이너리 자산이므로 텍스트 편집기로 열거나 임의로 덮어쓰지 말 것.
- `main` 브랜치와 아키텍처가 다르므로 브랜치를 착각한 채 작업하지 않도록 항상 확인할 것.
- Express 라우터는 non-ASCII 마운트 경로(예: `/가이드`)를 제대로 매칭하지 못함(`path-to-regexp` 이슈) — 새 정적 라우트는 영문 경로로 마운트할 것(파일명은 한글이어도 무방).
- `frontend/src/types.ts`는 `src/types.ts`의 의도적 복제본. 백엔드 응답 모양을 바꾸면 반드시 함께 업데이트할 것 — 불일치는 런타임에만 드러남.
- WebSocket 경로 `/ws`(쿼리 `?session=...`)는 `vite.config.ts` 프록시 매칭용 구분일 뿐, 백엔드 `WebSocketServer`는 경로 필터링 없이 모든 upgrade 요청을 받음. 경로를 바꾸려면 프론트엔드와 `vite.config.ts` 양쪽을 함께 수정할 것.

## 작업 완료 기준

저장소에 명시된 "Definition of Done" 문서는 없음(확인 안 됨). 이 저장소에서 실제로 적용해온 최소 기준:

1. `npx tsc --noEmit` 통과
2. `npm run test:collector` 통과
3. UI 변경 시 `npm run dev`로 실행해 브라우저에서 실제 동작 확인 (자동 검증만으로는 기능을 보장하지 않음)

## 커밋 / PR 규칙

`CONTRIBUTING.md`나 PR 템플릿 파일은 저장소에 없으나, 커밋 메시지 형식은 저장소 관리자에게 직접 확인됨.

**커밋 단위 (확인됨)**

- 사용자의 작업 요구사항 하나가 끝날 때마다 커밋함. 여러 요청을 모아서 한 번에 커밋하지 않음.

**커밋 메시지 형식 (확인됨)**

- 한국어로 작성.
- Conventional Commits의 `type: 설명` 형식 사용 — `feat`, `fix`, `docs`, `refactor`, `chore` 등 일반적인 type을 그대로 사용(저장소가 별도로 정한 type 목록 없음).
- **scope 괄호를 붙이지 않음** — `feat(scope): ...` 형태 금지, `feat: ...`만 사용.
- 제목만으로 부족하면 본문에 한국어 불릿(`-`)으로 변경 사항을 나열.
- 실제 사례: `10ad839 feat: 로그인 없이 여러 사용자가 함께 쓰는 호스팅 구조로 전환`
- 에이전트가 생성한 커밋에는 `Co-Authored-By: <에이전트 이름> <noreply@anthropic.com>` 형태의 트레일러를 남김(이 저장소에서 실제로 쓰인 방식).

**확인 필요**: PR 템플릿·필수 체크리스트 유무, `develop` → `main` 병합 전략(PR 경유 여부, 병합 시점 기준). 확인되기 전까지는 위 커밋 메시지 형식만 기본값으로 적용함.
