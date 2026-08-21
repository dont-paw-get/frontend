import { useState } from 'react';
import { useBooks } from '../../store/booksStore';
import { answerQuestion } from './chatEngine';

/**
 * LibrarianChat — 오른쪽 하단 질문 입력 패널.
 * 답변 텍스트는 따라다니는 사서 말풍선(LibrarianCursor)에 표시되고,
 * 사서 변경 버튼은 여기(정적 패널)에 노출된다.
 *
 * @param {object} librarian - 현재 사서
 * @param {{text,switchTo}|null} answer - 현재 답변
 * @param {(res)=>void} onAnswer - 답변 갱신
 * @param {(id)=>void} onSwitch - 사서 변경
 */
export default function LibrarianChat({ librarian, answer, onAnswer, onSwitch }) {
  const { books } = useBooks();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('search'); // 'search' | 'recommend'
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const res = answerQuestion({ text: input, mode, books, librarian });
    onAnswer(res);
    setInput('');
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
          <option value="search">일반 검색</option>
          <option value="recommend">도서 추천</option>
        </select>

        {mode === 'search' && (
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
                  position: 'absolute', bottom: '130%', right: 0, width: 200, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8, padding: 10,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.35)', lineHeight: 1.6, zIndex: 30,
                }}
              >
                이렇게 물어보세요
                <br />· 저자로 검색 (예: 김영하)
                <br />· 제목으로 검색 (예: 아몬드)
                <br />· 장르로 검색 (예: 로맨스)
              </div>
            )}
          </div>
        )}
      </div>

      {/* 입력 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'recommend' ? '예: 로맨스 추천해줘' : '저자·제목·장르로 검색'}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }}
        />
        <button
          type="submit"
          style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          ↵
        </button>
      </form>
    </div>
  );
}
