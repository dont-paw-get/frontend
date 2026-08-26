import { useState } from 'react';
import { useBooks } from '../../store/booksStore';

const STATUS_OPTIONS = ['시작전', '읽는 중', '잠시 멈춤', '완독'];

/**
 * BookDetail — 선택된 책의 상세 정보 팝업.
 *
 * @param {object} book - 선택된 책 데이터
 * @param {()=>void} onClose - 닫기 콜백
 */
export default function BookDetail({ book, onClose }) {
  const { updateBook, removeBook } = useBooks();
  const [currentPage, setCurrentPage] = useState(book.currentPage || 0);
  const [totalPage, setTotalPage] = useState(book.totalPage || 0);
  const [status, setStatus] = useState(book.status || '시작전');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    const cur = Number(currentPage) || 0;
    const total = Number(totalPage) || 0;
    updateBook(book.id, { currentPage: cur, totalPage: total, status });
    setEditing(false);
  };

  const handleDelete = () => {
    removeBook(book.id);
    onClose();
  };

  const panelStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 320,
    maxWidth: '90vw',
    boxSizing: 'border-box',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 20,
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    color: 'var(--text-h)',
    zIndex: 25,
    fontSize: 14,
    lineHeight: 1.6,
  };

  const iconBtnStyle = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--code-bg)',
    color: 'var(--text-h)',
    cursor: 'pointer',
    fontSize: 13,
  };

  const btnStyle = {
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 12,
  };

  // 삭제 확인 팝업
  if (confirmDelete) {
    return (
      <div style={panelStyle}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
          정말 삭제하시겠습니까?
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text)', textAlign: 'center' }}>
          삭제된 도서는 복구할 수 없습니다.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={handleDelete}
            style={{ ...btnStyle, background: '#e74c3c', color: '#fff' }}
          >
            삭제
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{ ...btnStyle, background: 'var(--border)', color: 'var(--text-h)' }}
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* 우측 상단 아이콘 버튼: 수정/삭제/닫기 */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            title="수정"
            aria-label="수정"
            style={iconBtnStyle}
          >
            ✎
          </button>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          title="삭제"
          aria-label="삭제"
          style={{ ...iconBtnStyle, color: '#e74c3c', borderColor: 'rgba(231,76,60,0.4)' }}
        >
          🗑
        </button>
        <button
          onClick={onClose}
          title="닫기"
          aria-label="닫기"
          style={{ ...iconBtnStyle, fontSize: 15 }}
        >
          ✕
        </button>
      </div>

      {/* 제목 */}
      <h3 style={{ margin: '0 40px 6px 0', fontSize: 17, fontWeight: 700 }}>
        {book.title}
      </h3>

      {/* 저자 */}
      <div style={{ color: 'var(--text)', marginBottom: 14 }}>
        {book.author || '저자 미입력'}
      </div>

      {/* 진행 상태 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>진행 상태</span>
        {editing ? (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)',
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 14, color: 'var(--text-h)' }}>{status}</span>
        )}
      </label>

      {/* 현재 읽은 페이지 / 총 페이지 (같은 행) */}
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
          페이지 📖
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
          <input
            type="number"
            min={0}
            value={currentPage}
            onChange={(e) => setCurrentPage(e.target.value)}
            disabled={!editing}
            placeholder="현재"
            style={{
              flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)',
              opacity: editing ? 1 : 0.7,
            }}
          />
          <span style={{ color: 'var(--text)', fontSize: 13, flexShrink: 0 }}>/</span>
          <input
            type="number"
            min={0}
            value={totalPage}
            onChange={(e) => setTotalPage(e.target.value)}
            disabled={!editing}
            placeholder="총"
            style={{
              flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)',
              opacity: editing ? 1 : 0.7,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text)', flexShrink: 0 }}>쪽</span>
        </div>
      </div>

      {/* 저장/취소 (편집 모드일 때만) */}
      {editing && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} style={{ ...btnStyle, flex: 1, background: 'var(--accent)', color: '#fff' }}>
            저장
          </button>
          <button onClick={() => setEditing(false)} style={{ ...btnStyle, flex: 1, background: 'var(--border)', color: 'var(--text-h)' }}>
            취소
          </button>
        </div>
      )}
    </div>
  );
}
