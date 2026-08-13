# CLAUDE.md

Claude Code가 이 저장소에서 작업할 때 참고하는 지침입니다. 아래 내용은 실제 코드(`src/`, `public/`), `package.json`, `README.md`, git 이력을 직접 확인해서 작성했습니다. 저장소에서 근거를 찾지 못한 항목은 추측 없이 "확인 필요"로 표시했습니다.

## 1. 프로젝트 개요

유튜브 라이브 채팅에서 운영자가 지정한 시간 동안 특정 키워드를 입력한 시청자를 채널 ID 기준 중복 없이 모아, 외부 사이트 [Marble Roulette](https://lazygyu.github.io/roulette/)에 그대로 붙여넣을 수 있는 형식(쉼표 구분, 동명이인은 `이름*횟수`)으로 정리해주는 웹 도구입니다.

로그인/회원가입 기능이 없습니다. 브라우저가 생성한 세션 ID(`localStorage`)로 사용자별 상태를 서버 메모리에서 분리해서, 여러 사람이 같은 서버를 동시에 쓸 수 있게 만든 구조입니다.

**⚠️ 브랜치 주의**: 이 문서는 현재 체크아웃된 `develop` 브랜치 기준입니다. `git log`상으로는 `develop`이 아직 `main`과 동일한 커밋(`e556f7a Initial commit`)이고, 지금까지의 멀티유저 리팩터(세션 분리, 서버 API 키 미저장, 룰렛 자동 주입 제거)는 전부 **커밋되지 않은 워킹트리 변경사항**입니다. `main` 브랜치는 "각자 PC에 설치해서 혼자 쓰는" 다른 아키텍처(Playwright로 룰렛 페이지 자동 주입, API 키를 서버 `.env`에 저장)를 갖고 있고 이 문서가 다루는 대상이 아닙니다. 작업 전 `git branch --show-current`로 항상 브랜치를 확인하세요.

## 2. 아키텍처 / 주요 디렉터리

- `src/server.ts` — Express + `ws` WebSocket 서버. HTTP는 `X-Session-Id` 헤더, WebSocket은 `?session=` 쿼리스트링으로 세션을 식별해 `sessions: Map<string, Session>`에서 세션별 `Collector` / `LiveChatPoller` / 연결 정보를 완전히 분리 관리합니다. `SESSION_IDLE_MS`(3시간) 이상 비활성 세션은 주기적으로 정리됩니다.
- `src/collector.ts` — `Collector` 클래스(`EventEmitter` 상속). 상태 머신(`idle → collecting → collected`), 키워드 매칭(`exact`/`contains`), `channelId` 기준 중복 제거, "자동 바이인"(수동 추가 명단 — `start()`/`reset()`에서 지워지지 않고 `clearManualNames()`로만 초기화됨)을 담당합니다. 이 저장소에서 유일하게 유닛 테스트가 있는 모듈입니다.
- `src/youtube.ts` — YouTube Data API v3 클라이언트. `extractVideoId`(URL/ID 파싱), `resolveLiveChatId`(videoId → liveChatId), `LiveChatPoller`(채팅 폴링, 응답의 `pollingIntervalMillis`를 그대로 따름, 최소 간격은 `MIN_POLL_INTERVAL_MS`).
- `src/types.ts` — 공유 타입(`MatchMode`, `ChatMessage`, `Participant`, `CollectorStatus`).
- `src/collector.test.ts` — `node:assert/strict` 기반의 유일한 테스트 파일. 별도 테스트 프레임워크 없음.
- `public/` — 번들러·프레임워크 없는 순수 정적 프론트엔드. `index.html`(화면 구조), `dashboard.js`(세션ID 생성, API 호출, WebSocket 렌더링, 타이머·알람), `style.css`, `sounds/alarm.mp3`(라이선스 확인 후 사용 중인 3초 트림 오디오 — 출처는 README 참고 섹션에 기록됨. 임의 교체 시 라이선스 확인 필요).
- `가이드/YouTube_API_키_발급_가이드.pdf` — 코드와 무관한, 사용자가 API 키를 발급받는 절차를 담은 PDF.
- `src/rouletteAutomation.ts`는 `develop`에서 삭제됨(Playwright 기반 자동 주입은 `main` 전용 기능).

## 3. 명령어

```bash
npm install
npm run dev             # tsx watch src/server.ts — 파일 변경 시 자동 재시작되는 개발 서버
npm run start            # tsx src/server.ts — watch 없이 실행
npm run build             # tsc → dist/ (strict 모드)
npm run test:collector    # tsx src/collector.test.ts — 유일한 자동화 테스트
```

- `npm run build`가 만드는 `dist/`는 `dev`/`start` 스크립트가 사용하지 않습니다(둘 다 `tsx`로 `.ts`를 직접 실행). `build`가 실제 배포 파이프라인에 쓰이는지는 저장소에서 확인되지 않았습니다 — 필요하면 확인해주세요.
- 린트·포매터 설정(eslint/prettier/editorconfig 등) 없음 — 별도 lint 명령이 없습니다.
- 타입만 빠르게 확인하려면 `npx tsc --noEmit`.
- `PORT` 환경변수로 포트 변경 가능(기본 5175). `.env` 파일은 이 브랜치 코드에서 로드되지 않습니다(`dotenv` 의존성 제거됨) — 저장소 루트의 `.env`(빈 `YOUTUBE_API_KEY=`)는 현재 읽히지 않는 잔재 파일입니다.

## 4. 코드 작성 규칙 (기존 코드에서 관찰된 컨벤션)

- TypeScript strict 모드, ESM(`"type": "module"`). **상대 경로 import는 소스가 `.ts`여도 반드시 `.js` 확장자로 작성**(예: `from './collector.js'`) — Node ESM 런타임 요구사항이며, 지키지 않으면 `tsx`/`node` 실행 시 모듈을 찾지 못합니다.
- 2-space 들여쓰기, 작은따옴표, 세미콜론.
- 클래스·타입·인터페이스는 PascalCase(`Collector`, `LiveChatPoller`, `MatchMode`), 함수·변수는 camelCase.
- 주석은 한국어로, "무엇을"이 아니라 비직관적인 "왜"만 최소한으로 남깁니다(예: `server.ts`의 세션 격리 이유). 새 코드도 이 톤을 유지하세요 — 자명한 동작을 설명하는 주석은 추가하지 마세요.
- 사용자에게 보이는 문자열(에러 메시지, UI 라벨)은 한국어로 작성합니다.
- 에러 처리 패턴: 라우트 핸들러는 try/catch 후 `res.status(4xx/5xx).json({ error: message })`로 응답. 내부 로직은 `Error`를 던지고 호출부(라우트)에서 잡습니다.
- 불필요한 추상화나 방어 코드를 지양하고, 작은 순수 함수 + 얇은 클래스 위주의 실용적인 스타일을 유지합니다.

## 5. 테스트 / 검증 방법

- `npm run test:collector`가 유일한 자동화 검증입니다. `Collector`에 로직을 추가하면 같은 파일의 `{ ... }` 블록 패턴으로 케이스를 추가하고 `console.log('PASS: ...')`로 표시하세요.
- `src/server.ts`, `src/youtube.ts`, `public/*`는 자동 테스트가 없습니다. 이 대화에서 실제로 써온 방식은: `npm run dev`로 서버를 띄우고 `curl -H "X-Session-Id: ..."`로 API를 직접 호출하거나, 브라우저로 열어 실제 흐름을 확인하는 것입니다.
- 변경 후 최소한 다음을 실행하세요: `npx tsc --noEmit`, `npm run test:collector`, (UI를 만졌다면) `npm run dev` 후 브라우저로 골든 패스 확인.
- `npm run build`가 strict 모드에서 깨지지 않는지도 큰 변경 후에는 확인하는 것을 권장합니다.

## 6. 환경 변수 / 보안 주의사항

- 이 브랜치의 핵심 설계는 **YouTube API 키를 서버에 저장하지 않는 것**입니다(브라우저 `localStorage`에만 저장, 요청마다 전송). 서버 코드에서 API 키를 로깅하거나 세션 밖으로 영속화하는 코드를 추가하지 마세요.
- `.env`/`dotenv`를 다시 도입해 API 키를 서버에 저장하는 방향으로 되돌리는 변경은 `main`/`develop`의 설계 의도를 뒤집는 것이므로, 먼저 사용자에게 확인하세요.
- 세션 ID는 인증 수단이 아니라 단순 구분자입니다. 민감한 권한 제어를 세션 ID 존재 여부에만 의존해서 설계하지 마세요.

## 7. 변경 시 특히 주의할 영역

- `Collector`의 상태 전이와 "`manualNames`는 `start()`/`reset()`에서 지워지지 않는다"는 동작은 최근에 의도적으로 바뀐 것이고 테스트로 고정되어 있습니다. 되돌리는 변경은 사용자 확인이 필요합니다.
- `src/server.ts`의 세션 분리 로직(헤더/쿼리스트링 기반 라우팅)이 깨지면 서로 다른 사용자의 데이터가 섞이는 심각한 버그가 됩니다. 이 부분을 건드릴 때는 특히 신중하게 검증하세요.
- `public/sounds/alarm.mp3`, `가이드/*.pdf`는 바이너리 자산입니다 — 텍스트 편집 도구로 열거나 임의로 덮어쓰지 마세요.
- `main`과 구조가 다르므로 브랜치를 착각한 채 작업하지 않도록 주의하세요.

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
