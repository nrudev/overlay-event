import type { CollectorState } from '../types';

export const ROULETTE_URL = 'https://lazygyu.github.io/roulette/';
export const ALARM_SOUND_URL = 'sounds/alarm.mp3';

export const STATE_LABELS: Record<CollectorState, string> = {
  idle: '대기 중',
  collecting: '수집 중',
  collected: '수집 완료',
};
