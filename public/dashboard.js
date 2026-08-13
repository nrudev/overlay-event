const $ = (id) => document.getElementById(id);

const ROULETTE_URL = 'https://lazygyu.github.io/roulette/';
const API_KEY_STORAGE_KEY = 'overlay-event:youtubeApiKey';
const SESSION_ID_STORAGE_KEY = 'overlay-event:sessionId';

let latestStatus = null;
let previousState = null;
let timerInterval = null;

const STATE_LABELS = {
  idle: '대기 중',
  collecting: '수집 중',
  collected: '수집 완료',
};

function getSessionId() {
  let id = localStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_STORAGE_KEY, id);
  }
  return id;
}

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
}

function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

function render(status) {
  latestStatus = status;
  $('state').textContent = STATE_LABELS[status.state] ?? status.state;
  $('count').textContent = status.participants.length;
  $('errorMsg').textContent = status.error ?? '';

  $('participantList').innerHTML = status.participants
    .slice()
    .reverse()
    .map(
      (p) =>
        `<li><span>${escapeHtml(p.displayName)}</span><span class="msg">${escapeHtml(p.message)}</span></li>`
    )
    .join('');

  $('manualList').textContent = status.manualNames.length ? status.manualNames.join(', ') : '없음';

  const finalNames = [...status.participants.map((p) => p.displayName), ...status.manualNames];
  $('finalCount').textContent = finalNames.length;
  $('finalList').value = formatRouletteNames(finalNames);

  if (status.keyword) {
    $('keyword').value = status.keyword;
    $('matchMode').value = status.matchMode;
  }

  updateTimerVisibility(status);

  if (previousState === 'collecting' && status.state === 'collected') {
    playAlarmSound();
  }
  previousState = status.state;
}

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function tickTimer() {
  if (!latestStatus || latestStatus.state !== 'collecting') return;
  const now = Date.now();
  if (latestStatus.endsAt) {
    $('timerLabel').textContent = '남은 시간';
    $('timerDisplay').textContent = formatClock((latestStatus.endsAt - now) / 1000);
  } else if (latestStatus.startedAt) {
    $('timerLabel').textContent = '경과 시간';
    $('timerDisplay').textContent = formatClock((now - latestStatus.startedAt) / 1000);
  }
}

function updateTimerVisibility(status) {
  if (status.state === 'collecting') {
    $('timerBox').classList.remove('hidden');
    tickTimer();
    if (!timerInterval) timerInterval = setInterval(tickTimer, 1000);
  } else {
    $('timerBox').classList.add('hidden');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
}

const ALARM_SOUND_URL = 'sounds/alarm.mp3';

function playAlarmSound() {
  try {
    const audio = new Audio(ALARM_SOUND_URL);
    audio.play().catch((err) => console.error('알람 소리 재생 실패', err));
  } catch (err) {
    console.error('알람 소리 재생 실패', err);
  }
}

function formatRouletteNames(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => (count > 1 ? `${name}*${count}` : name)).join(',');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/?session=${getSessionId()}`);
  ws.onmessage = (event) => {
    const { type, payload } = JSON.parse(event.data);
    if (type === 'status') render(payload);
    if (type === 'connection' && payload) {
      $('connectionInfo').textContent = `연결됨: videoId=${payload.videoId}`;
    }
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
}
connectWs();

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) {
    $('errorMsg').textContent = data.error ?? '알 수 없는 오류';
    throw new Error(data.error);
  }
  return data;
}

$('connectBtn').addEventListener('click', async () => {
  const videoUrl = $('videoUrl').value.trim();
  if (!videoUrl) return;
  try {
    const data = await post('/api/connect', { videoUrl, apiKey: getApiKey() });
    $('connectionInfo').textContent = `연결됨: videoId=${data.videoId}`;
  } catch {}
});

$('startBtn').addEventListener('click', async () => {
  const keyword = $('keyword').value.trim();
  const matchMode = $('matchMode').value;
  const minutes = Number($('durationMinutes').value) || 0;
  const seconds = Number($('durationSeconds').value) || 0;
  const totalSeconds = minutes * 60 + seconds;
  await post('/api/collect/start', {
    keyword,
    matchMode,
    durationSeconds: totalSeconds > 0 ? totalSeconds : null,
  }).catch(() => {});
});

$('stopBtn').addEventListener('click', () => post('/api/collect/stop').catch(() => {}));
$('resetBtn').addEventListener('click', () => post('/api/collect/reset').catch(() => {}));

$('addManualBtn').addEventListener('click', async () => {
  const names = $('manualNames').value.split(',').map((s) => s.trim()).filter(Boolean);
  if (!names.length) return;
  await post('/api/collect/manual', { names }).catch(() => {});
  $('manualNames').value = '';
});

$('clearManualBtn').addEventListener('click', () => post('/api/collect/manual/clear').catch(() => {}));

$('copyListBtn').addEventListener('click', async () => {
  const text = $('finalList').value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    $('copyStatus').textContent = '✅ 복사했습니다. 룰렛 페이지 입력창에 붙여넣으세요.';
  } catch {
    $('copyStatus').textContent = '복사에 실패했습니다. 위 칸을 직접 선택해서 복사해주세요.';
  }
});

$('openRouletteBtn').addEventListener('click', () => {
  window.open(ROULETTE_URL, '_blank', 'noopener');
});

function refreshApiKeyStatus() {
  $('apiKeyStatus').textContent = getApiKey()
    ? '✅ 이 브라우저에 API 키가 저장되어 있습니다.'
    : '⚠️ 아직 API 키가 설정되지 않았습니다. 위 칸에 붙여넣고 저장하세요.';
}
refreshApiKeyStatus();
$('apiKeyInput').value = getApiKey();

$('saveApiKeyBtn').addEventListener('click', () => {
  const apiKey = $('apiKeyInput').value.trim();
  if (!apiKey) return;
  setApiKey(apiKey);
  refreshApiKeyStatus();
});
