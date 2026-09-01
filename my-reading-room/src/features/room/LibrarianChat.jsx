import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../../store/booksStore';
import { answerQuestion } from './chatEngine';
import { streamChatMessage } from '../../api/chatApi';
import { getUserLocation } from '../../api/geolocation';
import { extractBooksFromAnswer } from './bookExtractor';
import MarkdownRenderer from './MarkdownRenderer';
import WeatherMoodBadge from './WeatherMoodBadge';
import { useLibrarian } from '../../store/librarianStore';
import { toKoreanStatus } from '../../api/bookApi';

// 백엔드(discovery) ChatRequest.message max_length와 동일하게 맞춘다 (CLIAR-184/185)
const MAX_MESSAGE_LENGTH = 2000;

// 도서명 공백 및 특수기호 무시 정규화 (예: "성공하는 인생의 비밀" vs "성공하는인생의비밀" vs "『 성공하는 인생의 비밀 』")
function normalizeTitle(str) {
  return (str || '')
    .trim()
    .replace(/[\s\-_:.,·'"`『』《》()（）]/g, '')
    .toLowerCase();
}

/**
 * LibrarianChat — 오른쪽 하단 질문 입력 패널.
 * 백엔드(/api/v1/chat)로 스트리밍 요청하고, 실패 시 로컬 chatEngine을 fallback으로 사용합니다.
 *
 * @param {object} librarian - 현재 사서
 * @param {{text,switchTo,library_books,libraryBooks}|null} answer - 현재 답변
 * @param {(res)=>void} onAnswer - 답변 갱신
 * @param {(id)=>void} onSwitch - 사서 변경
 * @param {(bookOrId)=>void} [onOpenDetail] - 서재 도서 상세 보기(책 열기) 모달 열기 핸들러
 */
export default function LibrarianChat({ librarian, answer, onAnswer, onSwitch, onOpenDetail }) {
  const { books } = useBooks();
  const { names: librarianNames } = useLibrarian();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null); // 백엔드 세션 ID 유지
  const [lastUserMessage, setLastUserMessage] = useState(''); // 직전 질문 기억 (사서 전환 시 자동 질의용)

  // 1. 내 서재 도서 조회 결과
  // - 백엔드가 response.library_books로 전달한 경우 우선 사용
  // - 스트리밍 응답처럼 백엔드 배열이 비어있더라도, 내 서재(books)에 등록된 도서명이 답변 본문에 언급된 경우 공백/특수문자 무관 자동 매칭
  const backendLibraryBooks = answer?.library_books || answer?.libraryBooks || [];
  const isRecommendationText =
    Boolean(answer?.text && (answer.text.includes('### 📖') || answer.text.includes('###')) && backendLibraryBooks.length === 0);

  const libraryBooks = useMemo(() => {
    if (backendLibraryBooks.length > 0) return backendLibraryBooks;
    if (!answer?.text || isRecommendationText || loading) return [];

    // 본문에서 낫표(『...』) 또는 화살괄호(《...》)로 묶인 텍스트 추출 (앞뒤 공백 trim)
    const bracketedTitles = Array.from(
      answer.text.matchAll(/[『《]([^』》]+)[』》]/g)
    ).map((m) => m[1].trim());

    const normalizedAnswer = normalizeTitle(answer.text);

    return books.filter((b) => {
      if (!b.title || b.title.trim().length < 1) return false;
      const bTitle = b.title.trim();
      const normBTitle = normalizeTitle(bTitle);
      if (!normBTitle) return false;

      // 1) 낫표/화살괄호 안에 감싸진 제목과 공백 무관 일치
      const matchedInBracket = bracketedTitles.some(
        (t) => normalizeTitle(t) === normBTitle
      );
      if (matchedInBracket) return true;

      // 2) 본문 텍스트 내 완전 일치 또는 공백 무관 일치 (도서명이 2글자 이상인 경우)
      if (normBTitle.length >= 2 && normalizedAnswer.includes(normBTitle)) {
        return true;
      }

      return false;
    });
  }, [backendLibraryBooks, answer?.text, isRecommendationText, loading, books]);

  // 2. 도서 추천인 경우: 오직 '### 📖' 또는 '###' 마크다운 추천 포맷이 있고 내 서재 도서 결과가 아닐 때만 추출
  const recommendedBooks =
    isRecommendationText && !loading && !answer?.switchTo && libraryBooks.length === 0
      ? extractBooksFromAnswer(answer.text)
      : [];

  const handleRegisterBook = (book) => {
    navigate('/register', {
      state: {
        fromAIRecommendation: true,
        book: {
          title: book.title,
          author: book.author,
          totalPage: book.totalPage ?? 300,
          currentPage: book.currentPage ?? 0,
          colorIdx: book.colorIdx ?? 0,
          thickness: book.thickness ?? 0.22,
        },
      },
    });
  };

  const handleOpenDetail = (book) => {
    if (onOpenDetail) {
      onOpenDetail(book);
    }
  };

  const sendQuery = async (message, targetLibrarianId = librarian.id) => {
    setLoading(true);
    setLastUserMessage(message);

    // 사서별 로딩 초기 멘트 분기
    const isStork = targetLibrarianId === 'stork';
    const initialGreeting = isStork
      ? '🪿 두둥! 슈빌 사서가 전문 분야의 깊이 있는 명저를 선별하고 있습니다... 🪶'
      : '🐾 블루 사서가 딱 맞는 좋은 책을 찾고 있다냥...';
    onAnswer({ text: initialGreeting, library_books: [], libraryBooks: [] });

    // 날씨 연동을 위한 사용자 위치 (권한 거부/실패 시 null → 백엔드가 서울 기본값 사용)
    const location = await getUserLocation();

    const result = await streamChatMessage({
      message,
      sessionId,
      librarianId: targetLibrarianId,
      latitude: location?.latitude,
      longitude: location?.longitude,
      onChunk: (_chunk, fullText) => {
        onAnswer({ text: fullText });
      },
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
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 20,
    width: open ? 340 : 'auto',
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
        maxHeight: '85vh',
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

      {/* 날씨·무드 컨텍스트 뱃지 (백엔드 signals 기반) */}
      {answer?.signals && !loading && <WeatherMoodBadge signals={answer.signals} />}

      {/* 사서 답변 메시지 뷰 (마크다운 포매팅 렌더링) */}
      {answer?.text && (
        <div
          style={{
            marginBottom: 8,
            padding: '10px 12px',
            background: 'var(--code-bg)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          <MarkdownRenderer text={answer.text} />
        </div>
      )}

      {/* 1. 내 서재 도서 목록 카드 (조회된 도서 상세 보기 / 책 열기) */}
      {libraryBooks.length > 0 && !loading && (
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

      {/* 2. 추천 도서 바로 등록 카드 리스트 (오직 ### 📖 마크다운 추천 포맷일 때만 노출) */}
      {recommendedBooks.length > 0 && !loading && (
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

