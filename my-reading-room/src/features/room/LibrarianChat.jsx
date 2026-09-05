import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../../store/booksStore';
import { answerQuestion } from './chatEngine';
import { sendChatMessage } from '../../api/chatApi';
import { getUserLocation } from '../../api/geolocation';
import { formatRecommendedBooks, extractLibraryBooksFromAnswer, getColorIndex, getBookThickness } from './bookExtractor';
import MarkdownRenderer from './MarkdownRenderer';
import WeatherMoodBadge from './WeatherMoodBadge';
import { useLibrarian, loadSavedChatSession, saveChatSession } from '../../store/librarianStore';
import { toKoreanStatus } from '../../api/bookApi';
import LoadingSequence from '../../components/LoadingSequence';

// 백엔드(discovery) ChatRequest.message max_length와 동일하게 맞춘다 (CLIAR-184/185)
const MAX_MESSAGE_LENGTH = 2000;

// 도서명 공백 및 특수기호 무시 정규화 (책 매칭용)
function normalizeTitle(str) {
  return (str || '')
    .trim()
    .replace(/[\s\-_:.,·'"`『』《》()（）]/g, '')
    .toLowerCase();
}

/**
 * 질문 의도에 따른 사서별 맥락 맞춤형 로딩 안내 멘트 생성
 */
function getContextualLoadingMessage(message, librarianId) {
  const q = (message || '').trim().toLowerCase();
  const isStork = librarianId === 'stork';

  // 1. 단순 인사 및 소개
  if (/^(안녕|반가|하이|hi|hello|누구|소개|안뇽)/i.test(q)) {
    return isStork
      ? '🪿 정중하게 인사를 준비하고 있습니다... 🪶'
      : '🐾 반갑게 인사를 건네려고 준비 중이다냥...';
  }

  // 2. 내 서재 조회 (서재, 읽던 책, 진행률, 내 책, 목록, 읽은 책)
  if (/(서재|읽던|내\s*책|내책|진행|완독|기록|보유|내가\s*읽|목록)/i.test(q)) {
    return isStork
      ? '🪿 서재의 독서 기록을 차분히 살피고 있습니다... 🪶'
      : '🐾 서재에서 집사님의 책 기록을 찾아보고 있다냥...';
  }

  // 3. 도서 추천 (추천, 골라, 책 찾아, 소설, 장르 등)
  if (/(추천|골라|책\s*찾|도서\s*찾|소설|인문|경제|경영|스릴러|미스터리)/i.test(q)) {
    return isStork
      ? '🪿 슈빌 사서가 전문 분야의 맞춤 명저를 선별하고 있습니다... 🪶'
      : '🐾 블루 사서가 딱 맞는 좋은 책을 찾고 있다냥...';
  }

  // 4. 날씨 / 분위기 / 기분
  if (/(날씨|비|눈|더위|추위|기분|우울|신나|위로)/i.test(q)) {
    return isStork
      ? '🪿 오늘의 날씨와 기분에 어울리는 이야기를 생각하고 있습니다... 🪶'
      : '🐾 오늘 분위기에 맞는 이야기를 떠올리고 있다냥...';
  }

  // 5. 일반 질문 / 일상 대화
  return isStork
    ? '🪿 슈빌 사서가 답변을 정리하고 있습니다... 🪶'
    : '🐾 블루 사서가 열심히 생각하고 있다냥...';
}

/**
 * LibrarianChat — 오른쪽 하단 질문 입력 패널.
 * 백엔드(/api/v1/chat)로 동기 요청(stream: false)하고, 실패 시 로컬 chatEngine을 fallback으로 사용합니다.
 *
 * @param {object} librarian - 현재 사서
 * @param {{text,switchTo,library_books,libraryBooks,recommended_books,recommendedBooks}|null} answer - 현재 답변
 * @param {(res)=>void} onAnswer - 답변 갱신
 * @param {(id)=>void} onSwitch - 사서 변경
 * @param {(bookOrId)=>void} [onOpenDetail] - 서재 도서 상세 보기(책 열기) 모달 열기 핸들러
 */
export default function LibrarianChat({ librarian, answer, onAnswer, onSwitch, onOpenDetail }) {
  const { books } = useBooks();
  const { names: librarianNames } = useLibrarian();
  const navigate = useNavigate();

  // CLIAR-257: 추천 도서 등록 후 뒤로가기 시 대화/추천 카드 복원
  const [open, setOpen] = useState(() => {
    const saved = loadSavedChatSession();
    if (saved?.open !== undefined) return saved.open;
    return Boolean(answer?.text);
  });
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    const saved = loadSavedChatSession();
    return saved?.sessionId || answer?.sessionId || null;
  });
  const [lastUserMessage, setLastUserMessage] = useState(() => {
    const saved = loadSavedChatSession();
    return saved?.lastUserMessage || '';
  });

  // CLIAR-257: 대화 응답이나 세션 정보 변경 시 sessionStorage에 동기화
  useEffect(() => {
    if (answer || sessionId || lastUserMessage) {
      saveChatSession({
        answer,
        sessionId,
        lastUserMessage,
        open,
      });
    }
  }, [answer, sessionId, lastUserMessage, open]);

  // 1. 내 서재 도서 조회 결과 (ADR 0006: 백엔드 response.library_books 또는 ### 📚 마크다운 블록 또는 내 서재 본문 매칭)
  const backendLibraryBooks = useMemo(
    () => answer?.library_books || answer?.libraryBooks || [],
    [answer?.library_books, answer?.libraryBooks]
  );

  const answerText = answer?.text;

  const libraryBooks = useMemo(() => {
    if (backendLibraryBooks.length > 0) return backendLibraryBooks;
    if (!answerText || loading) return [];

    // 1) ADR 0006 표준: ### 📚 마크다운 블록 우선 파싱
    const fromMarkdown = extractLibraryBooksFromAnswer(answerText);
    if (fromMarkdown.length > 0) return fromMarkdown;

    // 2) 백엔드가 자연어로 서재 도서를 설명한 경우:
    //    내 서재(books)에서 본문에 언급된 도서를 자동 탐색하여 [책 열기]로 연결!
    //    (단, 신규 도서 추천(### 📖)인 경우는 절대 서재 도서로 오인하지 않음)
    if (!answerText.includes('### 📖')) {
      const bracketedTitles = Array.from(
        answerText.matchAll(/[『《]\s*([^』》]+?)\s*[』》]/g)
      ).map((m) => m[1].trim());
      const normalizedAnswer = normalizeTitle(answerText);

      return books.filter((b) => {
        if (!b.title || b.title.trim().length < 1) return false;
        const normBTitle = normalizeTitle(b.title);
        if (!normBTitle) return false;
        return (
          bracketedTitles.some((t) => normalizeTitle(t) === normBTitle) ||
          (normBTitle.length >= 2 && normalizedAnswer.includes(normBTitle))
        );
      });
    }

    return [];
  }, [backendLibraryBooks, answerText, loading, books]);

  // 2. 외부 도서 추천: 백엔드 recommended_books 구조화 배열 직접 활용 (CLIAR-229)
  const backendRecommendedBooks = useMemo(
    () => answer?.recommended_books || answer?.recommendedBooks || [],
    [answer?.recommended_books, answer?.recommendedBooks]
  );
  const switchTo = answer?.switchTo;

  const recommendedBooks = useMemo(() => {
    if (backendRecommendedBooks.length > 0 && !loading && !switchTo) {
      return formatRecommendedBooks(backendRecommendedBooks);
    }
    return [];
  }, [backendRecommendedBooks, loading, switchTo]);

  const handleRegisterBook = (book) => {
    // API 응답의 recommended_books 배열에서 매칭되는 항목 확인
    const matchedBook = backendRecommendedBooks.find(
      (b) =>
        (b.title || '').trim() === (book.title || '').trim() ||
        normalizeTitle(b.title) === normalizeTitle(book.title)
    );

    const title = (matchedBook?.title || book.title || '').trim();
    // 1. "저자" 입력란 -> recommended_books[i].author 사용 (쪽수 제외된 순수 저자명)
    const author = (matchedBook?.author ?? book.author ?? '').trim();
    // 2. "총 페이지 수" 입력란 -> recommended_books[i].page_count 사용 (정수, 확인 불가 시 null)
    const pageCount =
      typeof matchedBook?.page_count === 'number' && Number.isFinite(matchedBook.page_count)
        ? matchedBook.page_count
        : typeof book.page_count === 'number' && Number.isFinite(book.page_count)
          ? book.page_count
          : typeof book.totalPage === 'number' && Number.isFinite(book.totalPage)
            ? book.totalPage
            : null;
    // 3. "장르" 입력란 -> recommended_books[i].genre 사용 (16개 표준 Enum). (CLIAR-244)
    //    추천 시점에 판단된 장르를 그대로 등록 폼에 자동 매칭한다. 없으면 undefined로
    //    남겨 RegisterBook이 미지정 처리하도록 한다(classify-genre는 ISBN 전용이라
    //    title/author 재분류로는 못 채움).
    const genre = matchedBook?.genre || book.genre || undefined;

    // CLIAR-257: 추천 도서 등록 화면으로 이동하기 직전 현재 대화 상태를 sessionStorage에 저장
    saveChatSession({
      answer,
      sessionId,
      lastUserMessage,
      open: true, // 복귀 시 패널이 열린 상태로 복원되도록
    });

    navigate('/register', {
      state: {
        fromAIRecommendation: true,
        book: {
          title,
          author,
          page_count: pageCount,
          totalPage: pageCount,
          genre,
          currentPage: book.currentPage ?? 0,
          colorIdx: book.colorIdx ?? getColorIndex(title),
          thickness: book.thickness ?? getBookThickness(pageCount),
        },
      },
    });
  };

  const handleOpenDetail = (bookOrId) => {
    if (!onOpenDetail) return;
    if (typeof bookOrId === 'object' && bookOrId !== null) {
      const targetTitle = (bookOrId.title || '').trim();
      const targetId = bookOrId.book_id ?? bookOrId.bookId ?? bookOrId.id;
      const found = books.find(
        (b) =>
          (targetId && (b.bookId === targetId || b.id === String(targetId) || b.id === targetId)) ||
          normalizeTitle(b.title) === normalizeTitle(targetTitle) ||
          b.title.trim() === targetTitle
      );
      if (found) {
        onOpenDetail(found);
        return;
      }
    }
    onOpenDetail(bookOrId);
  };

  const sendQuery = async (message, targetLibrarianId = librarian.id) => {
    setLoading(true);
    setLastUserMessage(message);

    // 질문 의도(인사/서재/추천/날씨 등)에 따른 사서별 맥락 맞춤형 로딩 안내 멘트
    const initialLoadingMsg = getContextualLoadingMessage(message, targetLibrarianId);
    onAnswer({
      text: initialLoadingMsg,
      library_books: [],
      libraryBooks: [],
      recommended_books: [],
      recommendedBooks: [],
    });

    // 날씨 연동을 위한 사용자 위치 (권한 거부/실패 시 null → 백엔드가 서울 기본값 사용)
    const location = await getUserLocation();

    // 도서 등록 자동 입력 연동 플로우: 동기 요청(stream: false) 사용 (CLIAR-229)
    const result = await sendChatMessage({
      message,
      sessionId,
      librarianId: targetLibrarianId,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });

    if (result) {
      if (result.sessionId) {
        setSessionId(result.sessionId);
      }
      onAnswer({
        text: result.text,
        switchTo: result.switchTo,
        signals: result.signals,
        libraryBooks: result.libraryBooks || result.library_books || [],
        library_books: result.library_books || result.libraryBooks || [],
        recommendedBooks: result.recommendedBooks || result.recommended_books || [],
        recommended_books: result.recommended_books || result.recommendedBooks || [],
      });
    } else {
      // 백엔드 연결 실패 시에만 로컬 서재 검색으로 폴백
      const localResult = answerQuestion({ text: message, books, librarian, librarianNames });
      onAnswer(localResult);
    }

    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const message = input.trim();
    setInput('');
    await sendQuery(message, librarian.id);
  };

  const handleSwitchClick = async (targetId) => {
    onSwitch(targetId);
    if (lastUserMessage) {
      // 사서 전환 시 직전 질문을 새 사서의 관점으로 즉시 자동 재질의!
      await sendQuery(lastUserMessage, targetId);
    }
  };

  const box = {
    position: 'fixed', // absolute → fixed로 변경하여 뷰포트 기준으로 고정 (CLIAR-284)
    right: 'min(16px, 2vw)', // 작은 화면에서 여백 조정 (CLIAR-284)
    bottom: 'min(16px, 2vh)', // 작은 화면에서 여백 조정 (CLIAR-284)
    zIndex: 20,
    width: open ? 'min(340px, calc(100vw - 32px))' : 'auto', // 작은 화면에서 반응형 조정 (CLIAR-284)
    fontSize: 13,
    cursor: 'auto',
  };

  if (!open) {
    return (
      <div style={box}>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 18 }}>{librarian.icon}</span>
          사서에게 질문하기
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        ...box,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        color: 'var(--text-h)',
        maxHeight: 'calc(100vh - 32px)', // 뷰포트 높이에서 여백 고려하여 조정 (CLIAR-284)
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>
          {librarian.icon} {librarian.displayName || librarian.name}
        </span>
        <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>✕</button>
      </div>

      {/* 사서 변경 버튼 (전문 장르 벗어난 추천일 때) */}
      {answer?.switchTo && (
        <button
          onClick={() => handleSwitchClick(answer.switchTo.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
            marginBottom: 8, padding: '8px 10px', borderRadius: 999, border: '1px solid var(--accent-border)',
            background: 'var(--accent-bg)', color: 'var(--text-h)', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 16 }}>{answer.switchTo.icon}</span>
          {librarianNames[answer.switchTo.id] || answer.switchTo.name}로 바꾸기
        </button>
      )}

      {/* 질문 팁 안내 (모드 선택 없이 자유롭게 질문 → 백엔드 오케스트레이터가 알아서 처리) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 8 }}>
        <div onMouseEnter={() => setShowHelp(true)} onMouseLeave={() => setShowHelp(false)} style={{ position: 'relative' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
              borderRadius: '50%', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'help',
            }}
          >
            ?
          </span>
          {showHelp && (
            <div
              style={{
                position: 'absolute', bottom: '130%', right: 0, width: 230, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 8, padding: 10,
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)', lineHeight: 1.6, zIndex: 30,
              }}
            >
              <strong>💬 이렇게 물어보세요</strong>
              <br />
              · 따뜻하고 힐링되는 소설 추천해줘
              <br />· 오늘 날씨에 어울리는 책 있어?
              <br />· 내 서재에서 김영하 책 찾아줘
              <br />· 아몬드라는 책 있어?
            </div>
          )}
        </div>
      </div>

      {/* 로딩 중일 때 순차 로딩 애니메이션과 안내 문구 표시 (CLIAR-285) */}
      {loading && (
        <div
          style={{
            marginBottom: 8,
            background: 'var(--code-bg)',
            borderRadius: 10,
            border: '1px solid var(--border)',
          }}
        >
          <LoadingSequence
            size={120}
            padding={20}
            label={
              <>
                따스한 햇살 아래 포근히 잠든{' '}
                <strong>{librarianNames[librarian.id] || librarian.name} 사서</strong>를 살며시 깨우고 있어요...
              </>
            }
          />
        </div>
      )}

      {/* 날씨·무드 컨텍스트 뱃지 (백엔드 signals 기반) */}
      {answer?.signals && !loading && <WeatherMoodBadge signals={answer.signals} />}

      {/* 사서 답변 메시지 뷰 (마크다운 포매팅 렌더링 - ADR 0006: ### 📖 추천, ### 📚 내 서재 카드 실시간 렌더링) */}
      {answer?.text && (
        <div
          style={{
            marginBottom: 8,
            padding: '10px 12px',
            background: 'var(--code-bg)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          <MarkdownRenderer
            text={answer.text}
            recommendedBooks={recommendedBooks}
            onRegister={handleRegisterBook}
            onOpenDetail={handleOpenDetail}
          />
        </div>
      )}

      {/* 1. 내 서재 도서 목록 카드 (백엔드 JSON response.library_books가 마크다운 본문 카드와 별도로 내려온 경우 노출) */}
      {libraryBooks.length > 0 && !loading && !answer?.text?.includes('### 📚') && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            background: 'var(--code-bg)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            📖 내 서재 도서 ({libraryBooks.length}권):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {libraryBooks.map((b, idx) => {
              const bookId = b.book_id ?? b.bookId ?? b.id;
              const statusKr = toKoreanStatus(b.reading_status ?? b.readingStatus ?? b.status);
              const progress = b.progress != null ? `${b.progress}%` : null;
              return (
                <div
                  key={bookId || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    padding: '6px 8px',
                    background: 'var(--bg)',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{b.title}</span>
                    {b.author && <span style={{ fontSize: 11, color: 'var(--text)', marginLeft: 4 }}>({b.author})</span>}
                    {(statusKr || progress) && (
                      <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6, fontWeight: 500 }}>
                        [{statusKr}{progress ? ` · ${progress}` : ''}]
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(b)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--accent-border, var(--accent))',
                      background: 'var(--accent-bg, rgba(0, 229, 255, 0.1))',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    책 열기 ➔
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. 추천 도서 바로 등록 카드 리스트 (마크다운 본문에 ### 📖 카드가 없는 JSON 응답 대응) */}
      {recommendedBooks.length > 0 && !loading && !answer?.text?.includes('### 📖') && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            background: 'var(--code-bg)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            📚 추천 도서 바로 서재에 등록하기:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recommendedBooks.map((b, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  padding: '6px 8px',
                  background: 'var(--bg)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{b.title}</span>
                  {b.author && <span style={{ fontSize: 11, color: 'var(--text)', marginLeft: 4 }}>({b.author})</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleRegisterBook(b)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--accent-border, var(--accent))',
                    background: 'var(--accent)',
                    color: '#fff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  등록 ➔
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 입력 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={loading ? '사서가 답변 중...' : '무엇이든 물어보세요 (추천·검색·날씨 등)'}
            disabled={loading}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', opacity: loading ? 0.6 : 1 }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            ↵
          </button>
        </div>
        {/* 백엔드 max_length(2000자)에 근접했을 때만 카운터를 노출해 평소엔 UI가 조용하게 유지 */}
        {input.length > MAX_MESSAGE_LENGTH * 0.8 && (
          <span
            style={{
              alignSelf: 'flex-end',
              fontSize: 11,
              color: input.length >= MAX_MESSAGE_LENGTH ? '#e05a4e' : 'var(--text)',
            }}
          >
            {input.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </form>
    </div>
  );
}

