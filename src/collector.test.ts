import assert from 'node:assert/strict';
import { Collector } from './collector.js';
import type { ChatMessage } from './types.js';

function msg(channelId: string, displayName: string, text: string): ChatMessage {
  return { channelId, displayName, text, publishedAt: new Date().toISOString() };
}

// 정확히 일치 매칭 + 같은 계정 중복 제거
{
  const c = new Collector();
  c.start('참여', 'exact', null);
  c.ingest([
    msg('u1', '철수', '참여'),
    msg('u1', '철수', '참여'), // 중복 채팅 -> 1명으로 유지
    msg('u2', '영희', '참여요'), // exact 모드에서는 불일치
    msg('u3', '민수', '  참여  '), // 공백은 무시하고 일치
  ]);
  const names = c.getFinalNames();
  assert.deepEqual(names.sort(), ['민수', '철수'].sort());
  console.log('PASS: exact match + channelId dedup');
}

// 포함 매칭
{
  const c = new Collector();
  c.start('참여', 'contains', null);
  c.ingest([msg('u1', '철수', '저 참여할래요'), msg('u2', '영희', '안녕하세요')]);
  const names = c.getFinalNames();
  assert.deepEqual(names, ['철수']);
  console.log('PASS: contains match');
}

// 수동 추가 병합 및 중복 제거
{
  const c = new Collector();
  c.start('참여', 'exact', null);
  c.ingest([msg('u1', '철수', '참여')]);
  c.stop();
  c.addManualNames(['영희', '철수', '  민수  ', '']);
  const names = c.getFinalNames().sort();
  assert.deepEqual(names, ['민수', '영희', '철수'].sort());
  console.log('PASS: manual name merge + dedup against collected');
}

// 수동 추가는 start()/reset()에도 유지되고, clearManualNames()로만 지워짐
{
  const c = new Collector();
  c.addManualNames(['진행자']);
  c.start('참여', 'exact', null);
  assert.deepEqual(c.getFinalNames(), ['진행자']);
  c.ingest([msg('u1', '철수', '참여')]);
  c.stop();
  c.reset();
  assert.deepEqual(c.getFinalNames(), ['진행자']);
  c.clearManualNames();
  assert.deepEqual(c.getFinalNames(), []);
  console.log('PASS: manual names survive start/reset, cleared only via clearManualNames');
}

// 수집 중이 아닐 때는 무시
{
  const c = new Collector();
  c.ingest([msg('u1', '철수', '참여')]);
  assert.deepEqual(c.getFinalNames(), []);
  console.log('PASS: ignores messages while idle');
}

console.log('\n모든 collector 테스트 통과');
