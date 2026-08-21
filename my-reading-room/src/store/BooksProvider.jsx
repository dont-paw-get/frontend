import { useEffect, useState } from 'react';
import { BooksContext, STORAGE_KEY } from './booksStore';

const COLOR_PRESETS = [
  { spine: '#c96b32', cover: '#e8944a' }, // 앰버
  { spine: '#8b4513', cover: '#b5651d' }, // 새들브라운
  { spine: '#a0522d', cover: '#cd853f' }, // 시에나
  { spine: '#d4763e', cover: '#f2a365' }, // 피치
  { spine: '#6b3a2a', cover: '#8c5a3c' }, // 다크 코코아
  { spine: '#bf7830', cover: '#e0a050' }, // 골든
];

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function BooksProvider({ children }) {
  const [books, setBooks] = useState(loadInitial);

  // 변경 시 localStorage 동기화
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch {
      // 저장 실패는 무시(용량 초과 등)
    }
  }, [books]);

  function addBook(book) {
    const color = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
    const newBook = {
      id: crypto.randomUUID(),
      title: book.title?.trim() || '제목 없음',
      author: book.author?.trim() || '',
      genre: book.genre || '',
      status: book.status || '시작전',
      currentPage: Number(book.currentPage) || 0,
      totalPage: Number(book.totalPage) || 0,
      spineColor: book.spineColor || color.spine,
      coverColor: book.coverColor || color.cover,
      thickness: Number(book.thickness) || 0.22,
      heightFactor: Math.random(),
      createdAt: Date.now(),
    };
    setBooks((prev) => [...prev, newBook]);
    return newBook;
  }

  function updateBook(id, patch) {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBook(id) {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }

  function clearBooks() {
    setBooks([]);
  }

  return (
    <BooksContext.Provider value={{ books, addBook, updateBook, removeBook, clearBooks }}>
      {children}
    </BooksContext.Provider>
  );
}
