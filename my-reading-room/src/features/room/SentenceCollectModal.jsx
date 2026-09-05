import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBooks } from '../../store/booksStore';
import { createOcrSentence } from '../../api/recordApi';
import { ApiError } from '../../api/authApi';
import WebcamCaptureModal from './WebcamCaptureModal';

/**
 * OCR 실패 원인을 사용자에게 구체적으로 안내한다.
 * backend-record는 상태코드별로 다른 detail을 준다(422: 인식 텍스트 없음,
 * 502: OCR/이미지 저장 오류, 504: 시간 초과). 예전엔 전부 뭉뚱그려 표시해
 * 원인 파악이 어려웠다.
 */
function describeOcrError(err) {
  if (err instanceof ApiError) {
    if (err.status === 422) return '이미지에서 문장을 찾지 못했어요. 글자가 선명하게 보이도록 다시 찍어 주세요.';
    if (err.status === 413) return '이미지가 너무 커요. 더 작은 사진으로 다시 시도해 주세요.';
    if (err.status === 415) return '지원하지 않는 이미지 형식이에요. JPG 또는 PNG로 올려 주세요.';
    if (err.status === 504) return '인식이 오래 걸려 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.';
    if (err.status === 502) return '문장 인식 서비스에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.';
    if (err.status === 401) return '로그인이 만료됐어요. 다시 로그인해 주세요.';
    // 그 외에는 서버가 준 메시지를 그대로 노출
    return err.message || '문장 인식 중 문제가 발생했어요.';
  }
  return '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.';
}

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
  const { fetchScraps, addScrap, editScrap, removeScrap } = useBooks();
  const captureInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [page, setPage] = useState('');
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  const [quotes, setQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [webcamOpen, setWebcamOpen] = useState(false);
  // OCR로 스캔한(또는 수정 중인 기존 스크랩의) 원본 이미지 URL.
  // backend-book이 scrapImageUrl을 필수로 요구하므로, 저장 시 이 값을 함께 보낸다.
  // 새 문장은 스캔을 해야 이 값이 생기고, 값이 없으면 저장할 수 없다.
  const [pendingImageUrl, setPendingImageUrl] = useState(null);

  // 문장 목록 로드 (서버)
  const reloadQuotes = useCallback(async () => {
    setQuotesLoading(true);
    try {
      const list = await fetchScraps(book.bookId);
      setQuotes(list);
    } catch {
      setQuotes([]);
    } finally {
      setQuotesLoading(false);
    }
  }, [fetchScraps, book.bookId]);

  useEffect(() => {
    reloadQuotes();
  }, [reloadQuotes]);

  /*
   * 확인 후 저장 흐름(CLIAR-228): 사진을 backend-record에 OCR-only(save_scrap=false)로
   * 보내 텍스트만 인식하고 원본 이미지는 S3에 저장한다. 인식 결과를 편집창에 채워
   * 사용자가 확인/수정한 뒤 "저장"을 누르면 그때 backend-book에 스크랩을 저장한다.
   * (여기서는 아직 저장하지 않는다)
   */
  async function handleFile(file) {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setOcrLoading(true);
    setOcrError('');
    setEditingQuoteId(null);
    try {
      const result = await createOcrSentence({
        imageFile: file,
        bookId: book.bookId,
        saveScrap: false,
      });
      setText(result.text || '');
      setPendingImageUrl(result.scrapImageUrl || null);
      if (!result.text?.trim()) {
        setOcrError('이미지에서 문장을 찾지 못했어요. 글자가 선명하게 보이도록 다시 찍어 주세요.');
      }
    } catch (err) {
      setOcrError(describeOcrError(err));
    } finally {
      setOcrLoading(false);
    }
  }

  // 웹캠 모달에서 캡처된 프레임(File)을 받아 기존 사진 업로드 흐름과 동일하게 처리 (CLIAR-210)
  function handleWebcamCapture(file) {
    setWebcamOpen(false);
    handleFile(file);
  }

  function resetForm() {
    setText('');
    setMemo('');
    setPage('');
    setPreviewUrl(null);
    setEditingQuoteId(null);
    setPendingImageUrl(null);
  }

  // 새 문장은 스캔한 이미지 URL이 있어야 저장 가능(backend-book scrapImageUrl 필수).
  // 기존 문장 수정은 이미 이미지 URL을 갖고 있으므로 항상 가능.
  const canSave = text.trim() && !saving && (editingQuoteId ? true : !!pendingImageUrl);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editingQuoteId) {
        await editScrap(editingQuoteId, { text, memo, page, scrapImageUrl: pendingImageUrl });
      } else {
        await addScrap(book.bookId, { text, memo, page, scrapImageUrl: pendingImageUrl });
      }
      resetForm();
      await reloadQuotes();
    } catch {
      // 저장 실패 시 폼 유지 (사용자가 재시도 가능)
    } finally {
      setSaving(false);
    }
  }

  function handleEditQuote(quote) {
    setEditingQuoteId(quote.id);
    setText(quote.text);
    setMemo(quote.memo || '');
    setPage(quote.page ? String(quote.page) : '');
    // 수정 시 기존 이미지 URL을 보관(저장 시 재전송)하고, 좌측 미리보기에 원본 이미지를 띄운다.
    setPendingImageUrl(quote.scrapImageUrl || null);
    setPreviewUrl(quote.scrapImageUrl || null);
  }

  async function handleDeleteQuote(quoteId) {
    try {
      await removeScrap(quoteId);
      if (editingQuoteId === quoteId) resetForm();
      await reloadQuotes();
    } catch {
      // 삭제 실패는 조용히 무시 (목록 유지)
    }
  }

  const fieldStyle = {
    padding: 8, fontSize: 14, borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--code-bg)', color: 'var(--text-h)', width: '100%', boxSizing: 'border-box',
  };
  const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6 };

  return (
    <>
      {createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
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
                  disabled={ocrLoading}
                  style={{ padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', cursor: ocrLoading ? 'not-allowed' : 'pointer', fontSize: 13, opacity: ocrLoading ? 0.6 : 1 }}
                >
                  📷 사진 촬영
                </button>
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={ocrLoading}
                  style={{ padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', cursor: ocrLoading ? 'not-allowed' : 'pointer', fontSize: 13, opacity: ocrLoading ? 0.6 : 1 }}
                >
                  🖼️ 이미지 선택
                </button>
                {/*
              모바일의 "사진 촬영" 버튼은 <input capture>로 OS 카메라 앱을 연다.
              데스크톱 브라우저는 이 속성을 지원하지 않아 파일 탐색기만 뜨므로,
              노트북/PC 웹캠으로 즉석 촬영할 수 있는 별도 경로를 추가한다 (CLIAR-210).
            */}
                <button
                  type="button"
                  onClick={() => setWebcamOpen(true)}
                  disabled={ocrLoading}
                  style={{ padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', cursor: ocrLoading ? 'not-allowed' : 'pointer', fontSize: 13, opacity: ocrLoading ? 0.6 : 1 }}
                >
                  💻 웹캠으로 촬영
                </button>
                <span style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
                  사진을 스캔하면 인식된 문장이 오른쪽에 채워집니다. 내용을 확인·수정하고 페이지·메모를 입력한 뒤 저장하세요.
                </span>

                {previewUrl && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', aspectRatio: '3/4', background: '#000' }}>
                    <img src={previewUrl} alt="문장 미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                {ocrLoading && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      background: 'var(--code-bg)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 12,
                      color: 'var(--text)',
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        border: '1.5px solid transparent',
                        borderTop: '1.5px solid var(--accent)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    문장을 인식하는 중이에요...
                  </div>
                )}
                {ocrError && <span style={{ fontSize: 12, color: '#e05a4e' }}>{ocrError}</span>}
              </div>

              {/* 중앙: 인식 결과 + 메모 + 페이지 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={labelStyle}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{editingQuoteId ? '문장 수정' : '인식된 문장'}</span>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="왼쪽에서 사진을 스캔하면 인식된 문장이 여기에 채워져요. 필요하면 직접 고칠 수 있어요."
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
                    disabled={!canSave}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                      background: canSave ? 'var(--accent)' : 'var(--border)',
                      color: canSave ? '#fff' : 'var(--text)',
                      fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {saving && (
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          border: '1.5px solid transparent',
                          borderTop: '1.5px solid currentColor',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                    )}
                    {saving ? '저장 중...' : editingQuoteId ? '수정 저장' : '문장 저장'}
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
                {/* 새 문장은 사진 스캔이 있어야 저장 가능(원본 이미지가 필요) */}
                {!editingQuoteId && !pendingImageUrl && text.trim() && (
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>
                    저장하려면 왼쪽에서 사진을 먼저 스캔해 주세요.
                  </span>
                )}
              </div>

              {/* 오른쪽: 저장된 문장 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>저장된 문장 ({quotes.length})</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
                  {quotesLoading && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 12px',
                        background: 'var(--code-bg)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        color: 'var(--text)',
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          border: '1.5px solid transparent',
                          borderTop: '1.5px solid var(--accent)',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                      문장을 불러오는 중이에요...
                    </div>
                  )}
                  {!quotesLoading && quotes.length === 0 && (
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
        </div>,
        document.body
      )}
      {webcamOpen && (
        <WebcamCaptureModal onCapture={handleWebcamCapture} onClose={() => setWebcamOpen(false)} />
      )}
    </>
  );
}
