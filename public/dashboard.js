const $ = (id) => document.getElementById(id);

let latestStatus = null;

const STATE_LABELS = {
  idle: '대기 중',
  collecting: '수집 중',
  collected: '수집 완료',
};

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
  const ws = new WebSocket(`ws://${location.host}`);
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
    headers: { 'Content-Type': 'application/json' },
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
    const data = await post('/api/connect', { videoUrl });
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

$('injectBtn').addEventListener('click', () => post('/api/roulette/inject').catch(() => {}));
$('rouletteStartBtn').addEventListener('click', () => post('/api/roulette/start').catch(() => {}));

async function refreshApiKeyStatus() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  $('apiKeyStatus').textContent = data.hasApiKey
    ? '✅ API 키가 설정되어 있습니다.'
    : '⚠️ 아직 API 키가 설정되지 않았습니다. 위 칸에 붙여넣고 저장하세요.';
}
refreshApiKeyStatus();

$('saveApiKeyBtn').addEventListener('click', async () => {
  const apiKey = $('apiKeyInput').value.trim();
  if (!apiKey) return;
  try {
    await post('/api/settings/api-key', { apiKey });
    $('apiKeyInput').value = '';
    $('apiKeyStatus').textContent = '✅ API 키가 저장되었습니다.';
  } catch {}
});
