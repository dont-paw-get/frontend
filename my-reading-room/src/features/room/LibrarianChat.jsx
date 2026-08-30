import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../../store/booksStore';
import { answerQuestion } from './chatEngine';
import { streamChatMessage } from '../../api/chatApi';
import { getUserLocation } from '../../api/geolocation';
import { extractBooksFromAnswer } from './bookExtractor';
import MarkdownRenderer from './MarkdownRenderer';
import WeatherMoodBadge from './WeatherMoodBadge';
import { useLibrarian } from '../../store/librarianStore';

// 백엔드(discovery) ChatRequest.message max_length와 동일하게 맞춘다 (CLIAR-184/185)
const MAX_MESSAGE_LENGTH = 2000;

/**
 * LibrarianChat — 오른쪽 하단 질문 입력 패널.
 * 백엔드(/api/v1/chat)로 스트리밍 요청하고, 실패 시 로컬 chatEngine을 fallback으로 사용합니다.
 *
 * @param {object} librarian - 현재 사서
 * @param {{text,switchTo}|null} answer - 현재 답변
 * @param {(res)=>void} onAnswer - 답변 갱신
 * @param {(id)=>void} onSwitch - 사서 변경
 */
export default function LibrarianChat({ librarian, answer, onAnswer, onSwitch }) {
  const { books } = useBooks();
  const { names: librarianNames } = useLibrarian();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null); // 백엔드 세션 ID 유지
  const [lastUserMessage, setLastUserMessage] = useState(''); // 직전 질문 기억 (사서 전환 시 자동 질의용)

  // 답변 텍스트에서 추천 도서 정보 자동 추출 (사서 전환 제안 멘트일 때는 도서 등록 버튼 비활성화)
  const recommendedBooks =
    answer?.text && !loading && !answer?.switchTo
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

  const sendQuery = async (message, targetLibrarianId = librarian.id) => {
    setLoading(true);
    setLastUserMessage(message);

    // 사서별 로딩 초기 멘트 분기
    const isStork = targetLibrarianId === 'stork';
    const initialGreeting = isStork
      ? '🪿 두둥! 슈빌 사서가 전문 분야의 깊이 있는 명저를 선별하고 있습니다... 🪶'
      : '🐾 블루 사서가 딱 맞는 좋은 책을 찾고 있다냥...';
    onAnswer({ text: initialGreeting });

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
      onAnswer({ text: result.text, switchTo: result.switchTo, signals: result.signals });
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

      {/* 추천 도서 바로 등록 카드 리스트 */}
      {recommendedBooks.length > 0 && (
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

