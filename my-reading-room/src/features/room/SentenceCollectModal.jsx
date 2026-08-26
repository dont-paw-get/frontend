import { useRef, useState } from 'react';
import { useBooks } from '../../store/booksStore';
import { recognizeText } from '../register/ocrUtils';

/**
 * SentenceCollectModal — "문장 수집" 팝업.
 * 왼쪽: OCR용 사진 촬영/선택
 * 중앙: 인식 결과 수정 + 메모 + 페이지 입력
 * 오른쪽: 저장된 문장 목록 (수정/삭제)
 *
 * @param {object} book - 대상 책
 * @param {()=>void} onClose - 닫기 콜백
 */
export default function SentenceCollectModal({ book, onClose }) {
  const { updateQuote, removeQuote, addQuote } = useBooks();
  const captureInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [page, setPage] = useState('');
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  const quotes = book.quotes || [];

  async function handleFile(file) {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setOcrLoading(true);
    try {
      const recognized = await recognizeText(file);
      setText(recognized);
    } catch {
      // 인식 실패 시 빈 텍스트로 유지, 사용자가 직접 입력
    } finally {
      setOcrLoading(false);
    }
  }

  function resetForm() {
    setText('');
    setMemo('');
    setPage('');
    setPreviewUrl(null);
    setEditingQuoteId(null);
  }

  function handleSave() {
    if (!text.trim()) return;
    if (editingQuoteId) {
      updateQuote(book.id, editingQuoteId, { text, memo, page: Number(page) || null });
    } else {
      addQuote(book.id, { text, memo, page });
    }
    resetForm();
  }

  function handleEditQuote(quote) {
    setEditingQuoteId(quote.id);
    setText(quote.text);
    setMemo(quote.memo || '');
    setPage(quote.page ? String(quote.page) : '');
  }

  function handleDeleteQuote(quoteId) {
    removeQuote(book.id, quoteId);
    if (editingQuoteId === quoteId) resetForm();
  }

  const fieldStyle = {
    padding: 8, fontSize: 14, borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--code-bg)', color: 'var(--text-h)', width: '100%', boxSizing: 'border-box',
  };
  const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6 };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1280px, 95vw)', maxHeight: '88vh', overflowY: 'auto',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16,
          padding: 24, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', color: 'var(--text-h)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>📝 문장 수집 — {book.title}</h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 320px', gap: 28, alignItems: 'start' }}>
          {/* 왼쪽: OCR 촬영/선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>문장 스캔</span>

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
              style={{ padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', cursor: 'pointer', fontSize: 13 }}
            >
              📷 사진 촬영
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              style={{ padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', cursor: 'pointer', fontSize: 13 }}
            >
              🖼️ 이미지 선택
            </button>

            {previewUrl && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', aspectRatio: '3/4', background: '#000' }}>
                <img src={previewUrl} alt="문장 미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {ocrLoading && <span style={{ fontSize: 12, color: 'var(--text)' }}>문장 인식 중이에요냥... 🐾</span>}
          </div>

          {/* 중앙: 인식 결과 + 메모 + 페이지 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{editingQuoteId ? '문장 수정' : '인식된 문장'}</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="사진을 스캔하거나 직접 문장을 입력하세요"
                rows={5}
                style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </label>

            <label style={labelStyle}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>메모</span>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="이 문장에 대한 생각을 남겨보세요"
                rows={3}
                style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </label>

            <label style={labelStyle}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>페이지</span>
              <input
                type="number"
                min={0}
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder="예: 128"
                style={{ ...fieldStyle, maxWidth: 120 }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={!text.trim()}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                  background: text.trim() ? 'var(--accent)' : 'var(--border)',
                  color: text.trim() ? '#fff' : 'var(--text)',
                  fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed', fontSize: 13,
                }}
              >
                {editingQuoteId ? '수정 저장' : '문장 저장'}
              </button>
              {editingQuoteId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-h)', cursor: 'pointer', fontSize: 13 }}
                >
                  취소
                </button>
              )}
            </div>
          </div>

          {/* 오른쪽: 저장된 문장 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>저장된 문장 ({quotes.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
              {quotes.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text)' }}>아직 저장된 문장이 없어요 📖</p>
              )}
              {quotes.map((q) => (
                <div
                  key={q.id}
                  style={{
                    padding: 10, borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--code-bg)', fontSize: 12.5,
                  }}
                >
                  <p style={{ margin: '0 0 6px', lineHeight: 1.5, color: 'var(--text-h)' }}>“{q.text}”</p>
                  {q.memo && (
                    <p style={{ margin: '0 0 6px', color: 'var(--text)', fontSize: 11.5 }}>💭 {q.memo}</p>
                  )}
                  {q.page != null && (
                    <p style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 11 }}>p. {q.page}</p>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleEditQuote(q)}
                      style={{
                        flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid var(--accent)',
                        background: 'transparent', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteQuote(q.id)}
                      style={{
                        flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid #e74c3c',
                        background: 'transparent', color: '#e74c3c', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
