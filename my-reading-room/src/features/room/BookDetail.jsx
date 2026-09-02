import { useEffect, useState } from 'react';
import { useBooks } from '../../store/booksStore';
import { getLibraryBook, toReadingStatus } from '../../api/bookApi';
import SentenceCollectModal from './SentenceCollectModal';
import ScrapGallery from './ScrapGallery';

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
  // 문장 수집 모달을 닫을 때 값을 올려 갤러리를 처음부터 다시 로드시킨다 (CLIAR-241)
  const [scrapVersion, setScrapVersion] = useState(0);
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

  /*
   * 팝업 기본 스타일 (CLIAR-241).
   * 좌측 상세 + 우측 문장 갤러리 2단 구성을 담기 위해 폭을 크게 늘렸다.
   * 삭제 확인 등 단독 화면은 좁은 폭(narrowPanelStyle)을 그대로 쓴다.
   */
  const basePanelStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
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

  const panelStyle = {
    ...basePanelStyle,
    width: 'min(1000px, 94%)',
    maxHeight: '88%',
    // 내부(문장 갤러리)가 남은 높이를 다 쓰도록 flex 컨테이너로 둔다.
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const narrowPanelStyle = { ...basePanelStyle, width: 320, maxWidth: '90vw' };

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
      <div style={narrowPanelStyle}>
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
      {/* 우측 상단 버튼: 수정 / 삭제 (가로 배치) */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
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

      {/*
       * 2단 레이아웃 (CLIAR-241): 왼쪽은 기존 책 상세, 오른쪽은 수집한 문장 갤러리.
       * 가운데 세로 구분선으로 영역을 나눈다.
       */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 300px) 1px minmax(0, 1fr)',
          gap: 20,
          alignItems: 'stretch',
          marginTop: 30,
          minHeight: 320,
          flex: 1,
          // 좌측 열이 길어도 갤러리가 넘치지 않도록 (내부에서 각자 스크롤)
          minWidth: 0,
        }}
      >
        {/* ── 왼쪽: 책 상세 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
          {/* 제목 */}
          <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, wordBreak: 'break-word' }}>
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
        </div>

        {/* ── 가운데 구분선 ── */}
        <div style={{ background: 'var(--border)', width: 1, alignSelf: 'stretch' }} />

        {/*
         * ── 오른쪽: 수집한 문장 갤러리 (가로 무한 스크롤) ──
         * key에 scrapVersion을 넣어, 문장 수집 후에는 갤러리를 remount해
         * 첫 페이지부터 다시 불러오게 한다.
         */}
        <ScrapGallery key={`${book.bookId}-${scrapVersion}`} bookId={book.bookId} />
      </div>

      {showSentenceModal && (
        <SentenceCollectModal
          book={book}
          onClose={() => {
            setShowSentenceModal(false);
            // 모달에서 문장을 추가/수정/삭제했을 수 있으니 갤러리를 새로 로드한다.
            setScrapVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
