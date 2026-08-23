import { useState } from 'react';
import { useBooks } from '../../store/booksStore';
import { answerQuestion } from './chatEngine';
import { streamChatMessage } from '../../api/chatApi';

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
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('recommend'); // 'recommend' (AI 추천 에이전트) | 'search' (로컬 서재 검색)
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null); // 백엔드 세션 ID 유지

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const message = input.trim();
    setInput('');
    setLoading(true);

    if (mode === 'recommend') {
      // 🌟 [도서 추천 모드] 백엔드 AI 추천 에이전트 호출 (도서 검색 도구 활용 및 실시간 스트리밍)
      onAnswer({ text: `${librarian.icon} 추천 도서를 찾고 있어요냥... 🐾` });

      const result = await streamChatMessage({
        message,
        sessionId,
        onChunk: (_chunk, fullText) => {
          onAnswer({ text: fullText });
        },
      });

      if (result) {
        if (result.sessionId) {
          setSessionId(result.sessionId);
        }
        onAnswer({ text: result.text });
      } else {
        // 백엔드 실패 시 로컬 fallback
        const localResult = answerQuestion({ text: message, mode, books, librarian });
        onAnswer(localResult);
      }
    } else {
      // 🔍 [일반 검색 모드] 내 서재 보유 도서 즉시 로컬 검색
      const localResult = answerQuestion({ text: message, mode, books, librarian });
      onAnswer(localResult);
    }

    setLoading(false);
  };

  const box = { position: 'absolute', right: 16, bottom: 16, zIndex: 20, width: open ? 300 : 'auto', fontSize: 13, cursor: 'auto' };

  if (!open) {
    return (
      <div style={box}>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999,
            border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer',
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
        ...box, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', color: 'var(--text-h)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>{librarian.icon} {librarian.name}</span>
        <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>✕</button>
      </div>

      {/* 사서 변경 버튼 (전문 장르 벗어난 추천일 때) */}
      {answer?.switchTo && (
        <button
          onClick={() => onSwitch(answer.switchTo.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
            marginBottom: 8, padding: '8px 10px', borderRadius: 999, border: '1px solid var(--accent-border)',
            background: 'var(--accent-bg)', color: 'var(--text-h)', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 16 }}>{answer.switchTo.icon}</span>
          {answer.switchTo.name}로 바꾸기
        </button>
      )}

      {/* 모드 드롭다운 + 도움말 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }}
        >
          <option value="recommend">✨ 도서 추천 (AI)</option>
          <option value="search">🔍 일반 검색 (내 서재)</option>
        </select>

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
                position: 'absolute', bottom: '130%', right: 0, width: 220, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 8, padding: 10,
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)', lineHeight: 1.6, zIndex: 30,
              }}
            >
              <strong>{mode === 'recommend' ? '✨ AI 도서 추천 질문 팁' : '🔍 일반 검색 팁'}</strong>
              <br />
              {mode === 'recommend' ? (
                <>
                  · 따뜻하고 힐링되는 소설 추천해줘
                  <br />· 반전이 멋진 추리/스릴러 있어?
                  <br />· 요즘 읽기 좋은 에세이 알려줘
                </>
              ) : (
                <>
                  · 저자로 검색 (예: 김영하)
                  <br />· 제목으로 검색 (예: 아몬드)
                  <br />· 장르로 검색 (예: 소설)
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 입력 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            loading
              ? '사서가 답변 중...'
              : mode === 'recommend'
              ? '예: 따뜻하고 힐링되는 소설 추천해줘'
              : '저자·제목·장르로 내 서재 검색'
          }
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
      </form>
    </div>
  );
}
