import { createContext, useContext } from 'react';

export const STORAGE_KEY = 'myReadingRoom.books';

export const BooksContext = createContext(null);

export function useBooks() {
  const ctx = useContext(BooksContext);
  if (!ctx) throw new Error('useBooks must be used within a BooksProvider');
  return ctx;
}
