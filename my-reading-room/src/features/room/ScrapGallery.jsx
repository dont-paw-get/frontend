import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useBooks } from '../../store/booksStore';
import { SCRAP_PAGE_SIZE } from '../../api/bookApi';
import './ScrapGallery.css';

/**
 * ScrapGallery — 수집한 문장을 인스타그램 포스트처럼 보여주는 가로 스크롤 갤러리 (CLIAR-241).
 *
 * 카드 한 장 = 문장 사진(위) + 문장/메모 텍스트(아래).
 * 좌우로 스크롤하며 보고, 오른쪽 끝에 가까워지면 다음 페이지를 이어서 불러온다
 * (무한 스크롤). 한 번에 전부 로드하면 문장이 많을 때 버벅이므로 backend-book의
 * page/size 페이징으로 20개씩 가져온다.
 *
 * memo는 목록 응답(ScrapSummary)에 없어 상세 조회로만 얻을 수 있다. 카드가 늦게
 * 뜨지 않도록 목록으로 먼저 렌더하고, 해당 페이지의 memo만 뒤이어 채운다.
 *
 * 수정 모드(editing)에서는 문장·메모를 직접 고칠 수 있고, 각 사진 우측 상단의 ✕로
 * 카드를 삭제할 수 있다. 고친 내용은 부모(BookDetail)가 "완료"를 누를 때 ref의
 * saveEdits()로 한 번에 저장한다.
 *
 * 처음부터 다시 로드해야 할 때(책 변경, 문장 저장 후)는 호출부에서 key를 바꿔
 * 이 컴포넌트를 remount 한다.
 *
 * @param {number|string} bookId - 대상 도서 ID
 * @param {boolean} [editing] - 수정 모드 여부
 * @param {object} [ref] - { saveEdits(): Promise<void> } 를 노출
 */

// 다음 페이지를 미리 당겨올 오른쪽 여백(px). 카드 폭의 약 1.5배.
const PREFETCH_MARGIN = 300;

// backend-book Scrap 도메인 제약 (sentence 1~2000, memo 0~2000)
const SENTENCE_MAX = 2000;
const MEMO_MAX = 2000;

const INITIAL_FEED = { items: [], nextPage: 0, totalPages: null, totalElements: null };

export default function ScrapGallery({ bookId, editing = false, ref }) {
  const { fetchScrapsPage, hydrateScrapMemos, editScrap, removeScrap } = useBooks();
  const scrollRef = useRef(null);
  // 동시/중복 요청 방지 (스크롤 이벤트는 연속으로 들어온다)
  const loadingRef = useRef(false);
  // 언마운트 후 늦게 도착한 응답으로 상태를 건드리지 않도록 하는 플래그
  const aliveRef = useRef(true);

  // 페이징 상태를 한 덩어리로 묶어 리렌더 횟수를 줄인다.
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 수정 중인 값 { [scrapId]: { text, memo } } — 저장 전까지 원본과 분리해 보관
  const [drafts, setDrafts] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [editError, setEditError] = useState('');

  const { items, nextPage, totalPages, totalElements } = feed;
  const hasMore = totalPages === null || nextPage < totalPages;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /**
   * 페이지를 불러와 뒤에 이어 붙인다. reset=true면 목록을 새로 채운다.
   */
  const loadPage = useCallback(
    async (pageToLoad, { reset = false } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError('');
      try {
        const res = await fetchScrapsPage(bookId, { page: pageToLoad, size: SCRAP_PAGE_SIZE });
        if (!aliveRef.current) return;

        setFeed((prev) => ({
          items: reset ? res.items : [...prev.items, ...res.items],
          nextPage: pageToLoad + 1,
          totalPages: res.totalPages,
          totalElements: res.totalElements,
        }));

        // 이 페이지의 memo만 뒤이어 채운다 (목록 응답엔 memo가 없음)
        if (res.items.length > 0) {
          hydrateScrapMemos(res.items)
            .then((memoMap) => {
              if (!aliveRef.current) return;
              setFeed((prev) => ({
                ...prev,
                items: prev.items.map((it) =>
                  memoMap[it.id] !== undefined ? { ...it, memo: memoMap[it.id] } : it
                ),
              }));
            })
            .catch(() => {
              // memo 조회 실패는 무시 (문장·사진은 이미 보인다)
            });
        }
      } catch {
        if (aliveRef.current) {
          setError('문장을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      } finally {
        loadingRef.current = false;
        if (aliveRef.current) setLoading(false);
      }
    },
    [bookId, fetchScrapsPage, hydrateScrapMemos]
  );

  /*
   * 첫 페이지 로드.
   * 책이 바뀌거나 문장을 저장했을 때는 호출부(BookDetail)가 key를 바꿔 이 컴포넌트를
   * 다시 마운트시킨다. 그래서 여기서 상태를 수동으로 초기화하지 않아도 되고,
   * 이전 책의 카드가 잠깐 남아 보이는 일도 없다.
   */
  useEffect(() => {
    loadPage(0, { reset: true });
  }, [loadPage]);

  /**
   * 가로 스크롤이 오른쪽 끝에 가까워지면 다음 페이지를 당겨온다.
   */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingRef.current || !hasMore) return;
    const remaining = el.scrollWidth - el.scrollLeft - el.clientWidth;
    if (remaining < PREFETCH_MARGIN) {
      loadPage(nextPage);
    }
  }, [hasMore, loadPage, nextPage]);

  /*
   * 카드가 한 화면에 다 들어와 스크롤이 생기지 않으면 스크롤 이벤트가 발생하지 않아
   * 다음 페이지를 못 불러온다. 렌더 후 스크롤 여유가 없으면 바로 이어 받는다.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || loading || !hasMore || items.length === 0) return;
    if (el.scrollWidth <= el.clientWidth) {
      loadPage(nextPage);
    }
  }, [items.length, loading, hasMore, nextPage, loadPage]);

  // 마우스 휠(세로)을 가로 스크롤로 변환 — 휠만 있는 마우스로도 좌우 탐색이 쉽도록
  const handleWheel = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  }, []);

  /** 현재 카드에 표시할 값 (수정 중이면 draft 우선) */
  const valueOf = useCallback(
    (it, field) => {
      const draft = drafts[it.id];
      if (draft && draft[field] !== undefined) return draft[field];
      return (field === 'memo' ? it.memo : it.text) ?? '';
    },
    [drafts]
  );

  const patchDraft = useCallback((id, field, value) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setEditError('');
  }, []);

  /**
   * 카드(수집한 문장) 삭제.
   *
   * backend-book은 scrapImageUrl을 필수(non-blank)로 요구해 "사진만 비우기"가
   * 불가능하다. 그래서 사진 위의 ✕는 해당 문장 스크랩 자체를 삭제한다(soft delete).
   */
  const handleDelete = useCallback(
    async (id) => {
      if (deletingId) return;
      setDeletingId(id);
      setEditError('');
      try {
        await removeScrap(id);
        if (!aliveRef.current) return;
        setFeed((prev) => ({
          ...prev,
          items: prev.items.filter((it) => it.id !== id),
          totalElements: prev.totalElements != null ? Math.max(0, prev.totalElements - 1) : null,
        }));
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch {
        if (aliveRef.current) setEditError('문장을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        if (aliveRef.current) setDeletingId(null);
      }
    },
    [deletingId, removeScrap]
  );

  /**
   * 수정한 문장·메모를 저장한다 (부모의 "완료" 버튼에서 호출).
   * 변경된 카드만 PATCH 한다. backend-book PATCH는 네 필드를 항상 요구하므로
   * 기존 page/scrapImageUrl을 함께 보낸다.
   *
   * @throws {Error} 검증 실패나 저장 실패 시
   */
  const saveEdits = useCallback(async () => {
    const dirty = items.filter((it) => {
      const d = drafts[it.id];
      if (!d) return false;
      const textChanged = d.text !== undefined && d.text !== (it.text ?? '');
      const memoChanged = d.memo !== undefined && d.memo !== (it.memo ?? '');
      return textChanged || memoChanged;
    });
    if (dirty.length === 0) return;

    // 문장은 비울 수 없다 (backend-book: sentence 1~2000자 필수)
    const invalid = dirty.find((it) => !String(valueOf(it, 'text')).trim());
    if (invalid) {
      setEditError('문장은 비워 둘 수 없어요.');
      // 갤러리가 자체 메시지를 이미 띄웠음을 부모에 알려 중복 안내를 막는다.
      const err = new Error('문장은 비워 둘 수 없어요.');
      err.handled = true;
      throw err;
    }

    const payloads = dirty.map((it) => ({
      id: it.id,
      text: String(valueOf(it, 'text')).trim().slice(0, SENTENCE_MAX),
      memo: String(valueOf(it, 'memo')).slice(0, MEMO_MAX),
      page: it.page,
      scrapImageUrl: it.scrapImageUrl,
    }));

    await Promise.all(
      payloads.map((p) =>
        editScrap(p.id, { text: p.text, memo: p.memo, page: p.page, scrapImageUrl: p.scrapImageUrl })
      )
    );

    if (!aliveRef.current) return;
    // 저장한 값을 목록에 반영하고 draft를 비운다 (재조회 없이 화면 일치)
    const byId = new Map(payloads.map((p) => [p.id, p]));
    setFeed((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        byId.has(it.id) ? { ...it, text: byId.get(it.id).text, memo: byId.get(it.id).memo } : it
      ),
    }));
    setDrafts({});
  }, [items, drafts, valueOf, editScrap]);

  /** 저장하지 않은 편집값을 버린다 (부모의 "취소" 버튼에서 호출). */
  const discardEdits = useCallback(() => {
    setDrafts({});
    setEditError('');
  }, []);

  useImperativeHandle(ref, () => ({ saveEdits, discardEdits }), [saveEdits, discardEdits]);

  const cardStyle = {
    flex: '0 0 auto',
    width: 200,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  const editFieldStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '5px 7px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--code-bg)',
    color: 'var(--text-h)',
    fontSize: 12,
    fontFamily: 'inherit',
    lineHeight: 1.5,
    resize: 'vertical',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          수집한 문장 {totalElements != null ? `(${totalElements})` : ''}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text)' }}>
          {editing
            ? '문장·메모를 고치고 “완료”를 누르세요. 사진의 ✕는 그 문장을 삭제해요'
            : items.length > 0
              ? '← 좌우로 스크롤해서 넘겨보세요 →'
              : ''}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className="scrap-gallery-strip"
        style={{
          display: 'flex',
          gap: 14,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 10,
          flex: 1,
          minHeight: 0,
          alignItems: 'flex-start',
          // 카드 단위로 부드럽게 멈추도록 (인스타그램 피드 느낌)
          scrollSnapType: 'x proximity',
        }}
      >
        {items.map((it) => (
          <figure key={it.id} style={{ ...cardStyle, margin: 0, scrollSnapAlign: 'start' }}>
            {/* 문장 사진 (스캔 원본) */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--code-bg)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {it.scrapImageUrl ? (
                <img
                  src={it.scrapImageUrl}
                  alt={it.text ? `수집한 문장 사진: ${it.text.slice(0, 20)}` : '수집한 문장 사진'}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text)' }}>사진 없음</span>
              )}

              {/* 수정 모드: 사진 우측 상단 ✕ 로 이 문장 삭제 */}
              {editing && (
                <button
                  type="button"
                  onClick={() => handleDelete(it.id)}
                  disabled={deletingId === it.id}
                  title="이 문장 삭제"
                  aria-label={`문장 삭제: ${(it.text || '').slice(0, 20)}`}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.5)',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: 13,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: deletingId === it.id ? 'wait' : 'pointer',
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* 문장 + 메모 + 페이지 */}
            <figcaption style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-h)' }}>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea
                    value={valueOf(it, 'text')}
                    onChange={(e) => patchDraft(it.id, 'text', e.target.value)}
                    rows={3}
                    maxLength={SENTENCE_MAX}
                    placeholder="문장"
                    aria-label="문장"
                    style={editFieldStyle}
                  />
                  <textarea
                    value={valueOf(it, 'memo')}
                    onChange={(e) => patchDraft(it.id, 'memo', e.target.value)}
                    rows={2}
                    maxLength={MEMO_MAX}
                    placeholder="메모"
                    aria-label="메모"
                    style={editFieldStyle}
                  />
                </div>
              ) : (
                <>
                  <p
                    style={{
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    “{it.text}”
                  </p>
                  {it.memo && (
                    <p
                      style={{
                        margin: '6px 0 0',
                        fontSize: 11.5,
                        color: 'var(--text)',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      💭 {it.memo}
                    </p>
                  )}
                </>
              )}
              {it.page != null && (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text)' }}>p. {it.page}</p>
              )}
            </figcaption>
          </figure>
        ))}

        {/* 다음 페이지 로딩 표시 (가로로 이어짐) */}
        {loading && (
          <div
            style={{
              ...cardStyle,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            불러오는 중...
          </div>
        )}
      </div>

      {!loading && items.length === 0 && !error && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text)' }}>
          아직 수집한 문장이 없어요 📖 왼쪽의 “문장 수집”으로 첫 문장을 담아보세요.
        </p>
      )}
      {error && <p style={{ margin: 0, fontSize: 12, color: '#e05a4e' }}>{error}</p>}
      {editError && <p style={{ margin: 0, fontSize: 12, color: '#e05a4e' }}>{editError}</p>}
    </div>
  );
}
