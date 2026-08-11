@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않습니다. SETUP_WINDOWS.md 안내에 따라 먼저 설치해주세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 처음 실행이라 필요한 파일을 설치합니다. 몇 분 정도 걸릴 수 있어요...
  call npm install
  call npx playwright install chromium
)

echo.
echo 서버를 시작합니다. 이 창을 닫지 마세요.
echo 잠시 후 브라우저에서 http://localhost:5175 을 열어주세요.
echo.
call npm run dev
pause
