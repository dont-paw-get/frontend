import { useCallback, useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBooks } from '../store/booksStore';
import { colorPresets, recognizeCover, extractDominantColorIndex, loadImage } from '../features/register/ocrUtils';
import { GENRE_DEFS, GENRE_NONE, genreLabel } from '../data/genres';
import { classifyGenre } from '../api/genreApi';
import { getBookThickness } from '../features/room/bookExtractor';

// 페이지 진행 상황으로 진행 상태 자동 계산
function deriveStatus(currentPage, totalPage) {
  const cur = Number(currentPage) || 0;
  const total = Number(totalPage) || 0;
  if (total > 0 && cur >= total) return '완독';
  if (cur > 0) return '읽는중';
  return '시작전';
}

export default function RegisterBook() {
  const { addBook, saveReadingProgress } = useBooks();
  const navigate = useNavigate();
  const location = useLocation();

  const captureInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fromRecommendation, setFromRecommendation] = useState(false);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [colorIdx, setColorIdx] = useState(null);
  // 장르 (CLIAR-241): backend-discovery 분류 결과를 기본값으로 채우고 사용자가 바꿀 수 있다.
  const [genre, setGenre] = useState(GENRE_NONE);
  const [genreLoading, setGenreLoading] = useState(false);

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

  async function handleFile(file) {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setOcrLoading(true);
    setOcrDone(false);
    setEditing(false);

    try {
      const [ocrResult, img] = await Promise.all([recognizeCover(file), loadImage(file)]);
      setTitle(ocrResult.title || '');
      setAuthor(ocrResult.author || '');
      setColorIdx(extractDominantColorIndex(img));
      /*
       * 인식된 제목·저자로 장르를 자동 분류 (실패해도 등록은 계속 가능).
       * recognizeCover는 { title, author, rawText }만 주고 ISBN·카테고리는 없어
       * 제목·저자만 넘긴다. ISBN 기반 조회가 붙으면 isbn도 함께 전달하면 된다.
       */
      autoClassifyGenre({ title: ocrResult.title, author: ocrResult.author });
    } catch {
      setColorIdx(0);
    } finally {
      setOcrLoading(false);
      setOcrDone(true);
    }
  }

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
    try {
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
      // 현재 읽은 페이지가 있으면 진행도까지 반영 (생성 API엔 currentPage가 없음)
      if (created?.bookId && initialPage > 0) {
        try {
          await saveReadingProgress(created.bookId, initialPage, Number(totalPage) || null);
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
          ⚠️ UI 문구만 ISBN 방식으로 전환 (CLIAR-154). 실제 인식 로직(recognizeCover)은
          아직 표지 텍스트 OCR 그대로이며, ISBN 숫자 추출 + 외부 도서 API 연동은 후속 티켓에서 진행.
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
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
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
