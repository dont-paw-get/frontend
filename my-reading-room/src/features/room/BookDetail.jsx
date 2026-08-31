import { useEffect, useState } from 'react';
import { useBooks } from '../../store/booksStore';
import { getLibraryBook, toReadingStatus } from '../../api/bookApi';
import SentenceCollectModal from './SentenceCollectModal';

const STATUS_OPTIONS = ['시작전', '읽는 중', '잠시 멈춤', '완독'];

/**
 * BookDetail — 선택된 책의 상세 정보 팝업.
 *
 * @param {object} book - 선택된 책 데이터 (목록 요약: bookId/title/author/status 등)
 * @param {()=>void} onClose - 닫기 콜백
 */
export default function BookDetail({ book, onClose }) {
  const { removeBook, saveReadingProgress, saveBookMeta } = useBooks();
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPage, setTotalPage] = useState(0);
  const [status, setStatus] = useState(book.status || '시작전');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSentenceModal, setShowSentenceModal] = useState(false);
  const [detail, setDetail] = useState(null); // 서버 상세(전체 메타 — 저장 시 full payload에 필요)
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);

  // 목록 요약엔 페이지/장르 등이 없어, 상세를 조회해 현재/총 페이지·상태를 초기화한다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getLibraryBook(book.bookId);
        if (cancelled) return;
        setDetail(d);
        setCurrentPage(d.currentPage || 0);
        setTotalPage(d.totalPages || 0);
        if (d.readingStatus) {
          // 서버 상태를 우선 반영(한글 매핑은 provider와 동일 규칙)
          const kr = { PLANNED: '시작전', READING: '읽는 중', COMPLETED: '완독' }[d.readingStatus];
          if (kr) setStatus(kr);
        }
      } catch {
        // 상세 조회 실패 시 요약 기반 값 유지
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book.bookId]);

  const handleSave = async () => {
    if (saving) return;
    const cur = Number(currentPage) || 0;
    const total = Number(totalPage) || 0;
    setSaving(true);
    setActionError(null);
    try {
      // 메타(상태 포함) 저장 — 백엔드 PATCH는 전체 페이로드를 요구하므로 상세값과 합친다.
      await saveBookMeta(book.bookId, {
        title: detail?.title ?? book.title,
        author: detail?.author ?? book.author,
        isbn: detail?.isbn ?? null,
        genre: detail?.genre ?? 'NONE',
        publisher: detail?.publisher ?? null,
        publishedDate: detail?.publishedDate ?? null,
        coverUrl: detail?.coverUrl ?? null,
        readingStatus: toReadingStatus(status),
        totalPages: total || null,
      });
      // 진행도(현재 페이지) 저장
      await saveReadingProgress(book.bookId, cur, total || null);
      setEditing(false);
    } catch {
      setActionError('저장 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeBook(book.bookId);
      onClose();
    } catch {
      setActionError('삭제 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
      setConfirmDelete(false);
    }
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
      {/* 우측 상단 버튼: 수정 / 삭제 (세로 배치) */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--accent)',
              background: 'transparent', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            수정
          </button>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid #e74c3c',
            background: 'transparent', color: '#e74c3c', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          삭제
        </button>
      </div>

      {/* 닫기 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 12, left: 12,
          background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 16,
        }}
      >
        ✕
      </button>

      {/* 제목 */}
      <h3 style={{ margin: '0 70px 6px 24px', fontSize: 17, fontWeight: 700 }}>
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...btnStyle, flex: 1, background: 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={() => setEditing(false)} disabled={saving} style={{ ...btnStyle, flex: 1, background: 'var(--border)', color: 'var(--text-h)' }}>
            취소
          </button>
        </div>
      )}

      {actionError && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#e05a4e', textAlign: 'center' }}>{actionError}</p>
      )}

      {/* 문장 수집 */}
      <button
        onClick={() => setShowSentenceModal(true)}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 8,
          border: '1px solid var(--accent-border)', background: 'var(--accent-bg)',
          color: 'var(--text-h)', fontWeight: 600, cursor: 'pointer',
        }}
      >
        문장 수집
      </button>

      {showSentenceModal && (
        <SentenceCollectModal book={book} onClose={() => setShowSentenceModal(false)} />
      )}
    </div>
  );
}
