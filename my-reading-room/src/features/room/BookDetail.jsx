import { useState } from 'react';
import { useBooks } from '../../store/booksStore';

const STATUS_OPTIONS = ['시작전', '읽는중', '완독'];

/**
 * BookDetail — 선택된 책의 상세 정보 팝업.
 * 확대된 책 오른쪽에 표시됨.
 *
 * @param {object} book - 선택된 책 데이터
 * @param {()=>void} onClose - 닫기 콜백
 */
export default function BookDetail({ book, onClose }) {
  const { updateBook } = useBooks();
  const [page, setPage] = useState(book.currentPage || 0);

  const handleStatusChange = (e) => {
    updateBook(book.id, { status: e.target.value });
  };

  const handlePageSave = () => {
    const cur = Number(page) || 0;
    const total = book.totalPage || 0;
    const status = total > 0 && cur >= total ? '완독' : cur > 0 ? '읽는중' : '시작전';
    updateBook(book.id, { currentPage: cur, status });
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 260,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        color: 'var(--text-h)',
        zIndex: 25,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      {/* 닫기 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          background: 'transparent',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 16,
        }}
      >
        ✕
      </button>

      {/* 제목 */}
      <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>
        {book.title}
      </h3>

      {/* 저자 */}
      <div style={{ color: 'var(--text)', marginBottom: 14 }}>
        {book.author || '저자 미입력'}
      </div>

      {/* 진행 상태 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>진행 상태</span>
        <select
          value={book.status || '시작전'}
          onChange={handleStatusChange}
          style={{
            padding: '6px 8px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--code-bg)',
            color: 'var(--text-h)',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      {/* 현재 읽은 페이지 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>
          현재 읽은 페이지 📖{book.totalPage ? ` (총 ${book.totalPage}쪽)` : ''}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="number"
            min={0}
            max={book.totalPage || undefined}
            value={page}
            onChange={(e) => setPage(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--code-bg)',
              color: 'var(--text-h)',
            }}
          />
          <button
            onClick={handlePageSave}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            저장
          </button>
        </div>
      </label>

      {/* 스크랩 확인하기 */}
      <button
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: '1px solid var(--accent-border)',
          background: 'var(--accent-bg)',
          color: 'var(--text-h)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        스크랩 확인하기
      </button>
    </div>
  );
}
