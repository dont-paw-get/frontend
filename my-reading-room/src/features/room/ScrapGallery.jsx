import { useCallback, useEffect, useRef, useState } from 'react';
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
 * 처음부터 다시 로드해야 할 때(책 변경, 문장 저장 후)는 호출부에서 key를 바꿔
 * 이 컴포넌트를 remount 한다.
 *
 * @param {number|string} bookId - 대상 도서 ID
 */

// 다음 페이지를 미리 당겨올 오른쪽 여백(px). 카드 폭의 약 1.5배.
const PREFETCH_MARGIN = 300;

const INITIAL_FEED = { items: [], nextPage: 0, totalPages: null, totalElements: null };

export default function ScrapGallery({ bookId }) {
  const { fetchScrapsPage, hydrateScrapMemos } = useBooks();
  const scrollRef = useRef(null);
  // 동시/중복 요청 방지 (스크롤 이벤트는 연속으로 들어온다)
  const loadingRef = useRef(false);
  // 언마운트 후 늦게 도착한 응답으로 상태를 건드리지 않도록 하는 플래그
  const aliveRef = useRef(true);

  // 페이징 상태를 한 덩어리로 묶어 리렌더 횟수를 줄인다.
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const { items, nextPage, totalPages, totalElements } = feed;
  const hasMore = totalPages === null || nextPage < totalPages;

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

  const cardStyle = {
    flex: '0 0 auto',
    width: 200,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          수집한 문장 {totalElements != null ? `(${totalElements})` : ''}
        </span>
        {items.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text)' }}>← 좌우로 스크롤해서 넘겨보세요 →</span>
        )}
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
            </div>

            {/* 문장 + 메모 + 페이지 */}
            <figcaption style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-h)' }}>
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
    </div>
  );
}
