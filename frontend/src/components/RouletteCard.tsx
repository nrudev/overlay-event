import { useState } from 'react';
import { formatRouletteNames } from '../lib/format';
import { ROULETTE_URL } from '../lib/constants';
import type { CollectorStatus } from '../types';

export function RouletteCard({ status }: { status: CollectorStatus | null }) {
  const [copyStatus, setCopyStatus] = useState('');

  const finalNames = status ? [...status.participants.map((p) => p.displayName), ...status.manualNames] : [];
  const finalList = formatRouletteNames(finalNames);

  async function handleCopy() {
    if (!finalList) return;
    try {
      await navigator.clipboard.writeText(finalList);
      setCopyStatus('✅ 복사했습니다. 룰렛 페이지 입력창에 붙여넣으세요.');
    } catch {
      setCopyStatus('복사에 실패했습니다. 위 칸을 직접 선택해서 복사해주세요.');
    }
  }

  return (
    <section className="card">
      <h2>5. 룰렛 연동</h2>
      <p className="hint">최종 인원(수집 + 자동 바이인): {finalNames.length}명.</p>
      <p className="hint">
        아래는 룰렛 입력창에 붙여넣는 것과 동일한 형식(쉼표 구분, 동명이인은 이름*횟수)입니다. 복사해서 룰렛 페이지의
        입력창에 붙여넣으세요.
      </p>
      <textarea rows={3} readOnly value={finalList} />
      <div className="row">
        <button onClick={handleCopy}>명단 복사</button>
        <button onClick={() => window.open(ROULETTE_URL, '_blank', 'noopener')}>룰렛 페이지 열기</button>
      </div>
      <p className="hint">{copyStatus}</p>
    </section>
  );
}
