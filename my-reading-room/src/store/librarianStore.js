import { createContext, useContext } from 'react';

// 활성 사서 id
export const ACTIVE_LIBRARIAN_KEY = 'myReadingRoom.activeLibrarian';
// 사용자가 지정한 사서 이름 { [librarianId]: name }
export const LIBRARIAN_NAMES_KEY = 'myReadingRoom.librarianNames';

export const LibrarianContext = createContext(null);

export function useLibrarian() {
  const ctx = useContext(LibrarianContext);
  if (!ctx) throw new Error('useLibrarian must be used within a LibrarianProvider');
  return ctx;
}
