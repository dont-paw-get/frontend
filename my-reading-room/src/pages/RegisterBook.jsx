import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../store/booksStore';
import { colorPresets, recognizeCover, extractDominantColorIndex, loadImage } from '../features/register/ocrUtils';

const thicknessPresets = [
  { label: '얇음', value: 0.16 },
  { label: '보통', value: 0.22 },
  { label: '두꺼움', value: 0.3 },
];

// 페이지 진행 상황으로 진행 상태 자동 계산
function deriveStatus(currentPage, totalPage) {
  const cur = Number(currentPage) || 0;
  const total = Number(totalPage) || 0;
  if (total > 0 && cur >= total) return '완독';
  if (cur > 0) return '읽는중';
  return '시작전';
}

export default function RegisterBook() {
  const { addBook } = useBooks();
  const navigate = useNavigate();

  const captureInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [colorIdx, setColorIdx] = useState(null);
  const [thickness, setThickness] = useState(null);

  const [totalPage, setTotalPage] = useState('');
  const [currentPage, setCurrentPage] = useState('');

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
      setThickness(0.22); // 기본 두께(보통), 이후 수정 가능
    } catch {
      setColorIdx(0);
      setThickness(0.22);
    } finally {
      setOcrLoading(false);
      setOcrDone(true);
    }
  }

  const allFilled =
    title.trim() &&
    author.trim() &&
    colorIdx !== null &&
    thickness !== null &&
    String(totalPage).trim() !== '' &&
    String(currentPage).trim() !== '';

  function handleSubmit(e) {
    e.preventDefault();
    if (!allFilled) return;
    const color = colorPresets[colorIdx];
    addBook({
      title,
      author,
      spineColor: color.spine,
      coverColor: color.cover,
      thickness,
      totalPage: Number(totalPage),
      currentPage: Number(currentPage),
      status: deriveStatus(currentPage, totalPage),
    });
    navigate('/library');
  }

  const fieldStyle = { padding: 8, fontSize: 15, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' };
  const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6 };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', textAlign: 'left' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>책 등록</h2>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'grid', gridTemplateColumns: '220px 1fr 200px', gap: 24, alignItems: 'start' }}
      >
        {/* 왼쪽: 표지 촬영/업로드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontWeight: 600 }}>표지 스캔</span>

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

          {ocrLoading && <span style={{ fontSize: 13, color: 'var(--text)' }}>표지 인식 중이에요냥... 🐾</span>}
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
              왼쪽에서 표지를 촬영하거나 업로드하면 제목·저자·색상·두께를 자동으로 인식해요냥 📚
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

              <div style={labelStyle}>
                <span>두께</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {thicknessPresets.map((t) => (
                    <button
                      type="button"
                      key={t.value}
                      disabled={!editing}
                      onClick={() => editing && setThickness(t.value)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: thickness === t.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: thickness === t.value ? 'var(--accent-bg)' : 'transparent',
                        color: 'var(--text-h)',
                        cursor: editing ? 'pointer' : 'default',
                        opacity: editing ? 1 : 0.85,
                      }}
                    >
                      {t.label}
                    </button>
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
        </div>

        {/* 완료 버튼 */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <button
            type="submit"
            disabled={!allFilled}
            style={{
              padding: '10px 32px',
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              background: allFilled ? 'var(--accent)' : 'var(--border)',
              color: allFilled ? '#fff' : 'var(--text)',
              cursor: allFilled ? 'pointer' : 'not-allowed',
            }}
          >
            등록하고 서재에 꽂기
          </button>
        </div>
      </form>
    </div>
  );
}
