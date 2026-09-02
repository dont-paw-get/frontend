import { useCallback, useEffect, useState } from 'react';
import { BooksContext } from './booksStore';
import { useAuth } from './authStore';
import * as bookApi from '../api/bookApi';
import { getVisual, setVisual } from './bookVisuals';

/**
 * 서재 도서 전역 상태 (CLIAR-186).
 *
 * 기존에는 localStorage 단일 키에 저장해 계정 간 데이터가 섞이는 버그가 있었다.
 * 이제 backend-book API(사용자별 JWT 스코프)로 저장/조회하고, 색상/두께 등 백엔드가
 * 저장하지 않는 시각 정보만 bookVisuals(localStorage)로 보관한다.
 *
 * - 로그인(authenticated) 시 서버에서 목록을 로드
 * - 로그아웃(unauthenticated) 시 목록을 비움
 */

// 백엔드 LibraryBookSummary → 프론트 도서 모델(3D 렌더링/화면용)로 변환
function toFrontBook(summary) {
  const visual = getVisual(summary.bookId);
  return {
    id: String(summary.bookId), // 기존 코드가 문자열 id로 선택/키를 다뤄 호환 유지
    bookId: summary.bookId,
    title: summary.title,
    author: summary.author,
    genre: summary.genre,
    status: bookApi.toKoreanStatus(summary.readingStatus),
    coverUrl: summary.coverUrl ?? null,
    progress: summary.progress ?? 0,
    spineColor: visual.spineColor,
    coverColor: visual.coverColor,
    thickness: visual.thickness,
    heightFactor: visual.heightFactor,
  };
}

export function BooksProvider({ children }) {
  const { status } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await bookApi.listLibraryBooks();
      setBooks(list.map(toFrontBook));
    } catch (err) {
      setError(err);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 인증 상태에 따라 로드/클리어
  useEffect(() => {
    if (status === 'authenticated') {
      reload();
    } else if (status === 'unauthenticated') {
      setBooks([]);
      setError(null);
    }
  }, [status, reload]);

  /**
   * 도서 등록. 색/두께는 서버에 없으므로 로컬(bookVisuals)에 저장한다.
   * @returns {Promise<object>} 생성된 프론트 도서 모델
   */
  const addBook = useCallback(async (input) => {
    const created = await bookApi.createLibraryBook({
      title: input.title,
      author: input.author,
      totalPages: Number(input.totalPage) || null,
      readingStatus: bookApi.toReadingStatus(input.status),
    });
    setVisual(created.bookId, {
      spineColor: input.spineColor,
      coverColor: input.coverColor,
      thickness: Number(input.thickness) || undefined,
    });
    await reload();
    return created;
  }, [reload]);

  const removeBook = useCallback(async (bookId) => {
    await bookApi.deleteLibraryBook(bookId);
    setBooks((prev) => prev.filter((b) => b.bookId !== bookId));
  }, []);

  /**
   * 독서 진행도(현재 페이지) 저장. 목록 모델엔 페이지가 없어 로컬 상태 변경은 없다.
   */
  const saveReadingProgress = useCallback((bookId, currentPage, totalPages) => {
    return bookApi.updateReadingProgress(bookId, currentPage, totalPages);
  }, []);

  /**
   * 도서 메타데이터 저장(제목/저자/상태 등). 백엔드 PATCH는 전체 페이로드를 요구하므로
   * 호출부(BookDetail)가 상세값을 합쳐 meta로 전달한다. 성공 시 목록 상태를 부분 갱신.
   */
  const saveBookMeta = useCallback(async (bookId, meta) => {
    await bookApi.updateLibraryBookMeta(bookId, meta);
    setBooks((prev) =>
      prev.map((b) =>
        b.bookId === bookId
          ? {
            ...b,
            title: meta.title ?? b.title,
            author: meta.author ?? b.author,
            genre: meta.genre ?? b.genre,
            status: meta.readingStatus ? bookApi.toKoreanStatus(meta.readingStatus) : b.status,
          }
          : b
      )
    );
  }, []);

  // ── 문장수집(scrap) ── 도서에 종속. 목록/추가/수정/삭제 모두 API 경유.
  const fetchScraps = useCallback(async (bookId) => {
    const scraps = await bookApi.listScraps(bookId);
    // 프론트 quote 모델로 변환. scrapImageUrl은 수정 시 재전송해야 하므로 함께 보관한다.
    return scraps.map((s) => ({
      id: s.scrapId,
      text: s.sentence,
      memo: s.memo || '',
      page: s.pageNumber ?? null,
      scrapImageUrl: s.scrapImageUrl ?? null,
    }));
  }, []);

  const addScrap = useCallback((bookId, { text, memo, page, scrapImageUrl }) => {
    return bookApi.createScrap(bookId, {
      sentence: text,
      memo: memo || null,
      pageNumber: Number(page) || null,
      scrapImageUrl,
    });
  }, []);

  const editScrap = useCallback((scrapId, { text, memo, page, scrapImageUrl }) => {
    return bookApi.updateScrap(scrapId, {
      sentence: text,
      memo: memo || null,
      pageNumber: Number(page) || null,
      scrapImageUrl,
    });
  }, []);

  const removeScrap = useCallback((scrapId) => {
    return bookApi.deleteScrap(scrapId);
  }, []);

  return (
    <BooksContext.Provider
      value={{
        books,
        loading,
        error,
        reload,
        addBook,
        removeBook,
        saveReadingProgress,
        saveBookMeta,
        fetchScraps,
        addScrap,
        editScrap,
        removeScrap,
      }}
    >
      {children}
    </BooksContext.Provider>
  );
}
