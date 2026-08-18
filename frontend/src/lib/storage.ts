const API_KEY_STORAGE_KEY = 'overlay-event:youtubeApiKey';
const SESSION_ID_STORAGE_KEY = 'overlay-event:sessionId';

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_STORAGE_KEY, id);
  }
  return id;
}

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}
