import { useCallback, useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBooks } from '../store/booksStore';
import { colorPresets, extractDominantColorIndex, loadImage } from '../features/register/ocrUtils';
import { GENRE_DEFS, GENRE_NONE, genreLabel } from '../data/genres';
import { classifyGenre } from '../api/genreApi';
import { createOcrCover } from '../api/recordApi';
import { searchBookByIsbn, toReadingStatus } from '../api/bookApi';
import { setVisual } from '../store/bookVisuals';
import { ApiError } from '../api/authApi';
import { getBookThickness } from '../features/room/bookExtractor';

/**
 * 표지 OCR(ISBN 인식) 실패 원인을 사용자에게 구체적으로 안내한다.
 * 상태코드 규약은 SentenceCollectModal의 문장 OCR과 동일하되, 422는
 * '문장 없음'이 아니라 'ISBN을 못 찾음'으로 읽는다.
 */
function describeCoverOcrError(err) {
  if (err instanceof ApiError) {
    if (err.status === 422) return 'ISBN을 찾지 못했어요. 바코드 아래 13자리 숫자가 선명하게 보이도록 다시 찍어 주세요.';
    if (err.status === 404) return '해당 ISBN의 도서 정보를 찾지 못했어요. 아래에서 직접 입력해 주세요.';
    if (err.status === 400) return '인식한 ISBN이 올바르지 않아요. 바코드가 잘리지 않게 다시 찍어 주세요.';
    if (err.status === 413) return '이미지가 너무 커요. 더 작은 사진으로 다시 시도해 주세요.';
    if (err.status === 415) return '지원하지 않는 이미지 형식이에요. JPG 또는 PNG로 올려 주세요.';
    if (err.status === 504) return '인식이 오래 걸려 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.';
    if (err.status === 502) return '도서 조회 서비스에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.';
    if (err.status === 401) return '로그인이 만료됐어요. 다시 로그인해 주세요.';
    return err.message || 'ISBN 인식 중 문제가 발생했어요.';
  }
  return '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.';
}

// 페이지 진행 상황으로 진행 상태 자동 계산
function deriveStatus(currentPage, totalPage) {
  const cur = Number(currentPage) || 0;
  const total = Number(totalPage) || 0;
  if (total > 0 && cur >= total) return '완독';
  if (cur > 0) return '읽는중';
  return '시작전';
}

export default function RegisterBook() {
  const { addBook, saveReadingProgress, saveBookMeta, reload } = useBooks();
  const navigate = useNavigate();
  const location = useLocation();

  const captureInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  // 연속 업로드 시 늦게 끝난 이전 요청이 최신 결과를 덮어쓰지 않도록 하는 실행 번호
  const runIdRef = useRef(0);
  // 마지막으로 만든 미리보기 object URL (언마운트 시 해제용)
  const previewUrlRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrNotice, setOcrNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [fromRecommendation, setFromRecommendation] = useState(false);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [colorIdx, setColorIdx] = useState(null);
  // 장르 (CLIAR-241): backend-discovery 분류 결과를 기본값으로 채우고 사용자가 바꿀 수 있다.
  const [genre, setGenre] = useState(GENRE_NONE);
  const [genreLoading, setGenreLoading] = useState(false);

  // 인식한 ISBN과, /ocr/covers가 서재에 만들어 둔 도서 ID.
  // bookId가 있으면 등록 시 새로 만들지 않고 이 책을 갱신한다(중복 등록 방지).
  const [isbn, setIsbn] = useState('');
  const [ocrBookId, setOcrBookId] = useState(null);
  // 화면에서 편집하지 않지만 PATCH 시 그대로 돌려보내야 하는 조회 결과
  // (updateLibraryBookMeta는 전체 페이로드를 요구해, 안 넘기면 null로 덮인다)
  const [extraMeta, setExtraMeta] = useState({ publisher: null, publishedDate: null, coverUrl: null });

  const [totalPage, setTotalPage] = useState('');
  const [currentPage, setCurrentPage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  /**
   * 인식/전달된 도서 정보로 장르를 자동 분류해 채운다 (CLIAR-241).
   * 알라딘 검색은 장르를 주지 않으므로 backend-discovery의 분류 API를 쓴다.
   * 실패하면 '미지정'으로 남기고 사용자가 직접 고르게 한다(등록은 막지 않음).
   */
  const autoClassifyGenre = useCallback(async ({ title: t, author: a, isbn = '', rawCategory = '' }) => {
    if (!t?.trim()) return;
    setGenreLoading(true);
    try {
      const result = await classifyGenre({ title: t, author: a, isbn, rawCategory });
      if (result?.genre) setGenre(result.genre);
    } finally {
      setGenreLoading(false);
    }
  }, []);

  // AI 도서 추천 등 외부 state로 넘어온 도서 정보 자동 채움 (CLIAR-229)
  useEffect(() => {
    if (location.state?.book) {
      const { book } = location.state;
      setTitle(book.title || '');
      // 저자: recommended_books[i].author 사용 (쪽수 제외된 순수 저자명)
      setAuthor(book.author || '');
      setColorIdx(book.colorIdx ?? 0);
      // 총 페이지 수: recommended_books[i].page_count 사용 (정수, 확인 불가 시 null -> 수동 입력 유도)
      const parsedTotalPage =
        book.page_count != null
          ? book.page_count
          : book.totalPage != null
            ? book.totalPage
            : '';
      setTotalPage(parsedTotalPage !== '' && parsedTotalPage !== null ? String(parsedTotalPage) : '');
      setCurrentPage(String(book.currentPage !== undefined && book.currentPage !== null ? book.currentPage : 0));
      setOcrDone(true);
      setEditing(true);
      setFromRecommendation(true);
      // 추천 응답에 장르가 있으면 그대로 쓰고, 없으면 제목·저자로 분류한다.
      if (book.genre) {
        setGenre(book.genre);
      } else {
        autoClassifyGenre({ title: book.title, author: book.author });
      }
    }
  }, [location.state, autoClassifyGenre]);

  /**
   * 촬영/업로드한 사진으로 도서 정보를 채운다.
   *
   *  1) POST /ocr/covers (backend-record) — 표지에서 ISBN과 제목·저자 후보를 인식
   *  2) GET /books/search?isbn= (backend-book) — 그 ISBN으로 알라딘 도서 정보 조회
   *  3) 조회 결과로 제목·저자·총 페이지 수를 채우고, 없으면 OCR 후보로 폴백
   *
   * 책 색상은 어느 API도 주지 않으므로 업로드한 이미지의 평균색으로 고른다.
   */
  async function handleFile(file) {
    if (!file) return;

    // 같은 파일을 다시 올릴 때도 처음부터 다시 인식되도록 이전 결과를 모두 비운다.
    const runId = ++runIdRef.current;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(file);
    setPreviewUrl(previewUrlRef.current);
    setOcrLoading(true);
    setOcrDone(false);
    setEditing(false);
    setOcrError('');
    setOcrNotice('');
    setTitle('');
    setAuthor('');
    setGenre(GENRE_NONE);
    setTotalPage('');
    setIsbn('');
    setOcrBookId(null);
    setExtraMeta({ publisher: null, publishedDate: null, coverUrl: null });
    setFromRecommendation(false);

    // 색상 추출은 인식 성공 여부와 무관하게 진행 (실패 시 첫 번째 색으로 폴백)
    const colorPromise = loadImage(file)
      .then((img) => extractDominantColorIndex(img))
      .catch(() => 0);

    try {
      const cover = await createOcrCover({ imageFile: file });
      if (runId !== runIdRef.current) return; // 더 최신 업로드가 진행 중이면 버린다

      setIsbn(cover.isbn || '');
      setOcrBookId(cover.bookId ?? null);

      // 인식한 ISBN으로 backend-book에서 도서 정보를 조회한다.
      // 조회가 실패해도 OCR 후보(제목/저자)로 등록을 이어갈 수 있게 한다.
      let found = null;
      if (cover.isbn) {
        try {
          const searched = await searchBookByIsbn(cover.isbn);
          if (runId !== runIdRef.current) return;
          found = searched.book;
          if (searched.bookId) setOcrBookId(searched.bookId);
          if (found) {
            setExtraMeta({
              publisher: found.publisher ?? null,
              publishedDate: found.publishedDate ?? null,
              coverUrl: found.coverUrl ?? null,
            });
          }
          if (searched.alreadyRegistered) {
            setOcrNotice('이미 서재에 있는 책이에요. 등록하면 기존 책 정보가 갱신됩니다.');
          }
        } catch (err) {
          if (runId !== runIdRef.current) return;
          setOcrError(describeCoverOcrError(err));
        }
      } else {
        setOcrError('ISBN을 찾지 못했어요. 바코드 아래 13자리 숫자가 보이도록 다시 찍거나, 아래에서 직접 입력해 주세요.');
      }

      const nextTitle = found?.title || cover.titleCandidate || '';
      const nextAuthor = found?.author || cover.authorCandidates[0] || '';
      setTitle(nextTitle);
      setAuthor(nextAuthor);
      // 알라딘이 쪽수를 주면 총 페이지 수까지 채운다 (없으면 사용자가 직접 입력)
      if (found?.totalPages) setTotalPage(String(found.totalPages));

      if (found?.genre) {
        // 이미 서재에 있는 책은 저장된 장르를 그대로 쓴다
        setGenre(found.genre);
      } else {
        // 인식된 ISBN·제목·저자로 장르를 자동 분류 (실패해도 등록은 계속 가능)
        autoClassifyGenre({ title: nextTitle, author: nextAuthor, isbn: cover.isbn || '' });
      }

      // 자동으로 채우지 못한 값이 있으면 바로 고칠 수 있게 수정 모드로 연다.
      if (!nextTitle || !nextAuthor || !found?.totalPages) setEditing(true);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      // 인식에 실패해도 직접 입력해 등록할 수 있도록 폼은 수정 모드로 열어 준다.
      setOcrError(describeCoverOcrError(err));
      setEditing(true);
    } finally {
      if (runId === runIdRef.current) {
        setColorIdx(await colorPromise);
        setOcrLoading(false);
        setOcrDone(true);
      }
    }
  }

  /**
   * 파일 선택 핸들러. 같은 파일을 연속으로 고르면 input의 value가 그대로라
   * change 이벤트가 발생하지 않으므로, 처리 후 value를 비워 다시 고를 수 있게 한다.
   */
  function handleInputChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    handleFile(file);
  }

  // 미리보기로 만든 object URL은 화면을 떠날 때 정리한다.
  // (StrictMode의 이펙트 두 번 실행에 사용 중인 URL이 해제되지 않도록 ref로 들고 있는다)
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // 두께는 더 이상 사용자가 고르지 않고 총 페이지 수로 자동 계산한다 (CLIAR-247)
  const thickness = getBookThickness(Number(totalPage) || null);

  const allFilled =
    title.trim() &&
    author.trim() &&
    colorIdx !== null &&
    String(totalPage).trim() !== '' &&
    String(currentPage).trim() !== '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!allFilled || submitting) return;
    const color = colorPresets[colorIdx];
    const initialPage = Number(currentPage) || 0;
    setSubmitting(true);
    setSubmitError(null);
    const readingStatus = toReadingStatus(deriveStatus(currentPage, totalPage));

    try {
      let bookId = ocrBookId;

      if (bookId) {
        /*
         * /ocr/covers가 이미 서재에 등록해 둔 책이다. 여기서 또 생성하면 같은 책이
         * 두 권 꽂히므로, 사용자가 확인·수정한 값으로 그 책을 갱신한다.
         * PATCH는 전체 페이로드를 요구하므로 화면의 값을 모두 채워 보낸다.
         */
        await saveBookMeta(bookId, {
          title,
          author,
          isbn: isbn || null,
          genre,
          publisher: extraMeta.publisher,
          publishedDate: extraMeta.publishedDate,
          coverUrl: extraMeta.coverUrl,
          totalPages: Number(totalPage) || null,
          readingStatus,
        });
        // 색/두께는 서버가 저장하지 않는 시각 정보라 로컬에 따로 보관한다.
        setVisual(bookId, { spineColor: color.spine, coverColor: color.cover, thickness });
        await reload();
      } else {
        // 서버에 도서 생성 (색은 선택값, 두께는 총 페이지 수로 자동 계산 — provider가 로컬 bookVisuals에 저장)
        const created = await addBook({
          title,
          author,
          spineColor: color.spine,
          coverColor: color.cover,
          thickness,
          totalPage: Number(totalPage),
          status: deriveStatus(currentPage, totalPage),
          genre,
        });
        bookId = created?.bookId ?? null;
      }

      // 현재 읽은 페이지가 있으면 진행도까지 반영 (생성 API엔 currentPage가 없음)
      if (bookId && initialPage > 0) {
        try {
          await saveReadingProgress(bookId, initialPage, Number(totalPage) || null);
        } catch {
          // 진행도 저장 실패는 등록 자체를 막지 않는다 (서재에서 다시 수정 가능)
        }
      }
      navigate('/library');
    } catch (err) {
      setSubmitError(
        err?.status === 409
          ? '이미 서재에 등록된 책이에요.'
          : '책 등록 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const fieldStyle = { padding: 8, fontSize: 15, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' };
  const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6 };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', textAlign: 'left' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 16 }}>책 등록</h2>

      {fromRecommendation && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--accent-bg, rgba(0, 229, 255, 0.1))',
            border: '1px solid var(--accent-border, var(--accent))',
            borderRadius: 10,
            padding: '10px 16px',
            marginBottom: 20,
            fontSize: 14,
            color: 'var(--text-h)',
          }}
        >
          <span>✨ <strong>AI 사서 추천 도서</strong> 정보가 자동으로 입력되었습니다. (필요 시 수정 가능)</span>
          <button
            type="button"
            onClick={() => setFromRecommendation(false)}
            style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
          >
            ✕
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: 'grid', gridTemplateColumns: '220px 1fr 200px', gap: 24, alignItems: 'start' }}
      >
        {/*
          왼쪽: ISBN 바코드 촬영/업로드
          사진은 backend-record의 POST /ocr/covers로 올라가 ISBN이 인식되고,
          backend-book이 알라딘에서 조회한 제목·저자·쪽수가 아래 인식 결과에 채워진다.
        */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontWeight: 600 }}>ISBN 촬영</span>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>
            책 뒷면이나 표지 안쪽 바코드 아래에 있는 13자리 ISBN 숫자를 촬영해주세요.
            <br />
            예: ISBN 979-11-6479-434-8
          </span>

          <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />

          <button
            type="button"
            onClick={() => captureInputRef.current?.click()}
            style={{ padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', cursor: 'pointer' }}
          >
            📷 사진 촬영
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            style={{ padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', cursor: 'pointer' }}
          >
            🖼️ 이미지 업로드
          </button>

          {previewUrl && (
            <div
              style={{
                marginTop: 8,
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
                aspectRatio: '3/4',
                background: '#000',
              }}
            >
              <img src={previewUrl} alt="표지 미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {ocrLoading && <span style={{ fontSize: 13, color: 'var(--text)' }}>ISBN 인식 중입니다...</span>}
          {ocrError && <span style={{ fontSize: 13, color: '#e05a4e' }}>{ocrError}</span>}
          {ocrNotice && <span style={{ fontSize: 13, color: 'var(--text-h)' }}>{ocrNotice}</span>}
          {isbn && !ocrLoading && (
            <span style={{ fontSize: 12, color: 'var(--text)' }}>인식된 ISBN: {isbn}</span>
          )}
        </div>

        {/* 중앙: 인식 결과 + 수정 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>인식 결과</span>
            {ocrDone && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--accent-border)',
                  background: editing ? 'var(--accent)' : 'var(--accent-bg)',
                  color: editing ? '#fff' : 'var(--text-h)',
                  cursor: 'pointer',
                }}
              >
                {editing ? '수정 완료' : '수정'}
              </button>
            )}
          </div>

          {!ocrDone ? (
            <p style={{ color: 'var(--text)', fontSize: 14 }}>
              왼쪽에서 ISBN 바코드 번호를 촬영하거나 업로드하면 제목·저자를 자동으로 인식합니다.
            </p>
          ) : (
            <>
              <label style={labelStyle}>
                <span>제목</span>
                {editing ? (
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="책 제목" style={fieldStyle} />
                ) : (
                  <div style={{ ...fieldStyle, background: 'transparent' }}>{title || '(인식된 제목 없음)'}</div>
                )}
              </label>

              <label style={labelStyle}>
                <span>저자</span>
                {editing ? (
                  <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="저자명" style={fieldStyle} />
                ) : (
                  <div style={{ ...fieldStyle, background: 'transparent' }}>{author || '(인식된 저자 없음)'}</div>
                )}
              </label>

              {/* 장르 (CLIAR-241): 자동 분류 결과를 기본값으로, 수정 모드에서 변경 가능 */}
              <label style={labelStyle}>
                <span>
                  장르
                  {genreLoading && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text)' }}>분류 중...</span>
                  )}
                </span>
                {editing ? (
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={fieldStyle}>
                    <option value={GENRE_NONE}>미지정</option>
                    {GENRE_DEFS.map((g) => (
                      <option key={g.code} value={g.code}>{g.label}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ ...fieldStyle, background: 'transparent' }}>
                    {genreLabel(genre) || '미지정'}
                  </div>
                )}
              </label>

              <div style={labelStyle}>
                <span>책 색상</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {colorPresets.map((p, i) => (
                    <button
                      type="button"
                      key={i}
                      disabled={!editing}
                      onClick={() => editing && setColorIdx(i)}
                      title={`색상 ${i + 1}`}
                      style={{
                        width: 36,
                        height: 50,
                        borderRadius: 4,
                        border: colorIdx === i ? '3px solid var(--accent)' : '1px solid var(--border)',
                        background: `linear-gradient(90deg, ${p.spine} 0 40%, ${p.cover} 40% 100%)`,
                        cursor: editing ? 'pointer' : 'default',
                        opacity: editing ? 1 : 0.85,
                      }}
                    />
                  ))}
                </div>
              </div>

            </>
          )}
        </div>

        {/* 오른쪽: 페이지 기록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontWeight: 600 }}>읽기 기록</span>

          <label style={labelStyle}>
            <span>총 페이지 수</span>
            <input
              type="number"
              min={1}
              value={totalPage}
              onChange={(e) => setTotalPage(e.target.value)}
              placeholder="예: 320"
              style={fieldStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>현재 읽은 페이지 📖</span>
            <input
              type="number"
              min={0}
              value={currentPage}
              onChange={(e) => setCurrentPage(e.target.value)}
              placeholder="예: 0"
              style={fieldStyle}
            />
          </label>

          {totalPage && currentPage !== '' && (
            <span style={{ fontSize: 12, color: 'var(--text)' }}>
              진행 상태: {deriveStatus(currentPage, totalPage)}
            </span>
          )}

          {/* 두께는 총 페이지 수로 자동 계산되므로 별도 입력 없이 안내만 표시 (CLIAR-247) */}
          {String(totalPage).trim() !== '' && (
            <span style={{ fontSize: 12, color: 'var(--text)' }}>
              책 두께는 총 페이지 수에 맞춰 자동으로 정해져요.
            </span>
          )}
        </div>

        {/* 완료 버튼 */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {submitError && (
            <span style={{ color: '#e05a4e', fontSize: 13 }}>{submitError}</span>
          )}
          <button
            type="submit"
            disabled={!allFilled || submitting}
            style={{
              padding: '10px 32px',
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              background: allFilled && !submitting ? 'var(--accent)' : 'var(--border)',
              color: allFilled && !submitting ? '#fff' : 'var(--text)',
              cursor: allFilled && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? '등록 중...' : '등록하고 서재에 꽂기'}
          </button>
        </div>
      </form>
    </div>
  );
}
