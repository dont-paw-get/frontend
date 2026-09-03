import { createContext, useContext } from 'react';

// 활성 사서 id
export const ACTIVE_LIBRARIAN_KEY = 'myReadingRoom.activeLibrarian';
// 사용자가 지정한 사서 이름 { [librarianId]: name }
export const LIBRARIAN_NAMES_KEY = 'myReadingRoom.librarianNames';
// 사서 채팅 세션 및 직전 대화/추천 복원용 (CLIAR-257)
export const CHAT_SESSION_STORAGE_KEY = 'myReadingRoom.chatSession';

export function loadSavedChatSession() {
  try {
    const raw = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveChatSession(sessionData) {
  try {
    sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  } catch {
    // 무시
  }
}

export function clearChatSession() {
  try {
    sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
  } catch {
    // 무시
  }
}

export const LibrarianContext = createContext(null);

export function useLibrarian() {
  const ctx = useContext(LibrarianContext);
  if (!ctx) throw new Error('useLibrarian must be used within a LibrarianProvider');
  return ctx;
}
