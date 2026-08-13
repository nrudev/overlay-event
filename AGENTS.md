# AGENTS.md

이 문서는 이 저장소에서 작업하는 모든 코딩 에이전트(도구 무관)를 위한 지침입니다. 특정 에이전트 도구나 인터페이스를 전제하지 않으며, 아래 내용은 실제 코드(`src/`, `public/`), `package.json`, `README.md`, git 이력을 직접 확인해서 작성했습니다. 근거를 찾지 못한 항목은 "확인 필요"로 명시했습니다.

## 브랜치 상태 (중요)

이 문서는 현재 체크아웃된 `develop` 브랜치의 워킹트리 기준으로 작성되었습니다. `git log`상 `develop`은 아직 `main`과 동일한 커밋(`e556f7a Initial commit`)이며, 여기 기술된 아키텍처(세션 분리, 서버에 API 키 미저장, 룰렛 자동 주입 없음)는 전부 **미커밋 워킹트리 변경사항**입니다. `main` 브랜치는 로그인 없이 "각자 PC에 설치해서 혼자 쓰는" 다른 구조(Playwright로 룰렛 페이지 자동 주입, API 키를 서버 `.env`에 저장)를 갖고 있으며 이 문서의 대상이 아닙니다. 작업 전 현재 브랜치를 확인하세요.

## 프로젝트 목적

유튜브 라이브 채팅에서 운영자가 지정한 시간 동안 특정 키워드를 입력한 시청자를 채널 ID 기준 중복 없이 모아, 외부 사이트 Marble Roulette(`https://lazygyu.github.io/roulette/`)에 붙여넣을 수 있는 형식(쉼표 구분, 동명이인은 `이름*횟수`)으로 정리해주는 웹 애플리케이션. 로그인 계정이 없고, 브라우저가 생성해 `localStorage`에 저장하는 세션 ID로 여러 사용자의 상태를 서버 메모리에서 분리해 하나의 서버를 동시에 공유한다.

## 기술 스택

- Node.js + TypeScript(ESM, `strict: true`). 런타임은 `tsx`(타입체크 없이 즉시 실행), 빌드는 `tsc`.
- 서버: `express`(HTTP), `ws`(WebSocket).
- 프론트엔드: 번들러·프레임워크 없는 순수 HTML/CSS/바닐라 JS (`public/`), `express.static`으로 서빙.
- Python/기타 언어 런타임 없음. 모노레포 아님. 패키지 매니저는 `npm`(`package-lock.json` 존재).
- 린트/포매터/CI 설정(eslint, prettier, editorconfig, `.github/workflows` 등) 저장소에 없음.

## 디렉터리 / 모듈 구조

| 경로 | 역할 |
|---|---|
| `src/server.ts` | Express + WebSocket 서버. `X-Session-Id` 헤더(WS는 `?session=` 쿼리)로 세션 식별, `Map<string, Session>`으로 세션별 `Collector`/폴러/연결 상태를 완전히 분리. 비활성 세션(3시간, `SESSION_IDLE_MS`) 주기 정리. |
| `src/collector.ts` | `Collector` 클래스(`EventEmitter`). 상태 머신 `idle → collecting → collected`, 키워드 매칭(`exact`/`contains`), `channelId` 기준 중복 제거, "자동 바이인"(수동 추가 명단, `start()`/`reset()`에 유지되고 `clearManualNames()`로만 초기화). 유일하게 테스트가 있는 모듈. |
| `src/youtube.ts` | YouTube Data API v3 클라이언트: `extractVideoId`, `resolveLiveChatId`, `LiveChatPoller`(응답의 `pollingIntervalMillis`를 그대로 따름). |
| `src/types.ts` | 공유 타입(`MatchMode`, `ChatMessage`, `Participant`, `CollectorStatus`). |
| `src/collector.test.ts` | `node:assert/strict` 기반 유일한 테스트. 프레임워크 없음. |
| `public/index.html` | 화면 구조(단계별 카드 UI). |
| `public/dashboard.js` | 세션 ID 생성/저장, API 호출, WebSocket 수신·렌더링, 카운트다운 타이머, 알람 재생. |
| `public/style.css` | 스타일시트. |
| `public/sounds/alarm.mp3` | 라이선스 확인 후 사용 중인 3초 트림 오디오 자산(출처: README 참고 섹션). 교체 시 라이선스 확인 필요. |
| `가이드/YouTube_API_키_발급_가이드.pdf` | 코드와 무관한 사용자용 API 키 발급 안내 PDF. |

`src/rouletteAutomation.ts`(Playwright 기반 룰렛 자동 주입)는 이 브랜치에서 삭제됨 — `main` 전용 기능이었음.

## 명령어 (package.json 스크립트, 실제 확인됨)

```bash
npm install
npm run dev             # tsx watch src/server.ts (개발용, 자동 재시작)
npm run start            # tsx src/server.ts (watch 없음)
npm run build             # tsc -> dist/
npm run test:collector    # tsx src/collector.test.ts (유일한 자동화 테스트)
```

추가로 확인된 사항:
- `npm run build`의 산출물(`dist/`)은 `dev`/`start`가 사용하지 않음(둘 다 `tsx`로 `.ts`를 직접 실행). `build`가 실제 배포에 쓰이는지는 저장소에서 확인되지 않음.
- 별도 lint 명령 없음(설정 파일 없음).
- 타입 체크만 하려면: `npx tsc --noEmit`.
- 환경변수: `PORT`(선택, 기본 5175)만 코드가 실제로 읽음(`process.env.PORT`). `dotenv` 의존성이 없어 `.env` 파일은 로드되지 않음 — 저장소 루트에 있는 `.env`(빈 `YOUTUBE_API_KEY=`)는 현재 코드에서 사용되지 않는 잔재 파일이며, `.env.example`은 이 브랜치에 없음.

## 코드 스타일 규칙 (기존 코드에서 관찰된 컨벤션)

- TypeScript strict 모드, ESM. 상대 경로 import는 소스 파일이 `.ts`여도 **`.js` 확장자로 작성**해야 함(예: `import { Collector } from './collector.js'`) — Node ESM 런타임 요구사항이며 어기면 실행 시 모듈 해석에 실패함.
- 2-space 들여쓰기, 작은따옴표 문자열, 세미콜론 사용.
- 네이밍: 클래스/타입/인터페이스는 PascalCase(`Collector`, `LiveChatPoller`, `MatchMode`), 함수/변수는 camelCase.
- 주석은 한국어, "무엇을 하는지"가 아니라 비직관적인 "왜"만 최소한으로 작성(예: 세션 격리 이유). 자명한 동작에는 주석을 달지 않음 — 새 코드도 이 관례를 따를 것.
- 사용자에게 노출되는 문자열(에러 메시지, UI 라벨)은 한국어.
- 에러 처리: 라우트 핸들러는 try/catch 후 `res.status(4xx/5xx).json({ error: message })`로 응답. 내부 함수/클래스는 `Error`를 던지고 호출부에서 처리.
- 불필요한 추상화·방어 코드를 피하고, 작은 순수 함수와 얇은 클래스 위주의 실용적 스타일을 유지.

## 테스트 및 검증

- 자동화된 테스트는 `npm run test:collector` 하나뿐. `Collector`에 로직을 추가할 때는 같은 파일의 `{ ... }` 블록 패턴으로 케이스를 추가하고 `console.log('PASS: ...')`로 표시.
- `server.ts`/`youtube.ts`/`public/*`는 자동 테스트가 없음. 검증 방식: `npm run dev`로 서버 실행 후 `curl -H "X-Session-Id: <id>" ...`로 API를 직접 호출하거나, 브라우저로 열어 확인.
- 변경 후 최소 확인 사항: `npx tsc --noEmit`, `npm run test:collector`, (UI 변경 시) `npm run dev` 후 브라우저에서 실제 동작 확인.
- 큰 변경 후에는 `npm run build`가 strict 모드에서 통과하는지도 확인 권장.

## 환경 변수 및 보안 주의사항

- 핵심 설계 원칙: **YouTube API 키를 서버에 저장하지 않음**(브라우저 `localStorage`에만 저장, 요청마다 전송해서 그 순간에만 사용). 서버 코드에서 API 키를 로그로 남기거나 세션 객체 밖으로 영속화하는 코드를 추가하지 말 것.
- `dotenv`를 재도입해 API 키를 서버 파일에 저장하는 방향으로 되돌리는 변경은 현재 설계 의도를 뒤집는 것이므로, 먼저 사용자에게 확인할 것.
- 세션 ID는 인증 수단이 아니라 단순 구분자다. 민감한 권한 제어를 세션 ID 존재 여부에만 의존해 설계하지 말 것.

## 변경 시 특히 주의해야 하는 영역

- `Collector`의 상태 전이 규칙과 "`manualNames`는 `start()`/`reset()`으로 지워지지 않는다"는 동작은 최근 의도적으로 확정된 사양이며 테스트로 고정되어 있음. 되돌리려면 사용자 확인 필요.
- `src/server.ts`의 세션 분리 로직이 깨지면 서로 다른 사용자의 데이터가 섞이는 심각한 버그가 됨 — 이 영역을 수정할 때는 여러 세션으로 격리가 유지되는지 반드시 재검증할 것.
- `public/sounds/alarm.mp3`, `가이드/*.pdf`는 바이너리 자산이므로 텍스트 편집기로 열거나 임의로 덮어쓰지 말 것.
- `main` 브랜치와 아키텍처가 다르므로 브랜치를 착각한 채 작업하지 않도록 항상 확인할 것.

## 작업 완료 기준

저장소에 명시된 "Definition of Done" 문서는 없음(확인 안 됨). 이 저장소에서 실제로 적용해온 최소 기준:

1. `npx tsc --noEmit` 통과
2. `npm run test:collector` 통과
3. UI 변경 시 `npm run dev`로 실행해 브라우저에서 실제 동작 확인 (자동 검증만으로는 기능을 보장하지 않음)

## 커밋 / PR 규칙

`CONTRIBUTING.md`, PR 템플릿, 커밋 메시지 컨벤션 문서가 저장소에 없음. 커밋 이력도 `"Initial commit"` 한 건뿐이라 패턴을 추론할 근거가 없음.

**확인 필요**: 선호하는 커밋 메시지 형식(예: Conventional Commits), 브랜치 전략(`develop` → `main` 병합 방식), PR 필수 체크리스트가 있다면 명시해줄 것. 확인되기 전까지는 간결하고 사실 위주의 커밋 메시지를 기본값으로 사용함.
