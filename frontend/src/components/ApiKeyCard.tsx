import { useState } from 'react';
import { getApiKey, setApiKey } from '../lib/storage';

export function ApiKeyCard() {
  const [value, setValue] = useState(getApiKey());
  const [saved, setSaved] = useState(() => Boolean(getApiKey()));

  function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setSaved(true);
  }

  return (
    <section className="card">
      <h2>0. YouTube API 키 설정</h2>
      <p className="hint">
        아직 키가 없다면{' '}
        <a href="/guide/YouTube_API_키_발급_가이드.pdf" target="_blank" rel="noopener">
          가이드
        </a>
        를 참고해 발급받아 붙여넣으세요. 이 키는 <b>서버에 저장되지 않습니다</b>.
      </p>
      <div className="row">
        <input
          type="password"
          placeholder="Yoube API 키를 붙여넣으세요"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button onClick={handleSave}>저장</button>
      </div>
      <p className="hint">
        {saved ? '✅ 이 브라우저에 API 키가 저장되어 있습니다.' : '⚠️ 아직 API 키가 설정되지 않았습니다. 위 칸에 붙여넣고 저장하세요.'}
      </p>
    </section>
  );
}
