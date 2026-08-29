/**
 * TermsModal — 약관 전문 표시 모달.
 * content는 plain text(마크다운/HTML 아님)이므로 white-space: pre-wrap으로 줄바꿈만 살려서 표시.
 *
 * @param {string} name - 약관명 (예: '이용약관')
 * @param {string|null} content - 약관 전문. null이면 로딩/오류 상태로 간주
 * @param {boolean} loading
 * @param {string} error - 에러 메시지 (있으면 표시)
 * @param {()=>void} onClose
 */
export default function TermsModal({ name, content, loading, error, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} 전문`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(480px, 90vw)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <strong style={{ fontSize: 15, color: 'var(--text-h)' }}>{name}</strong>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
          {loading && <p style={{ color: 'var(--text)', fontSize: 13 }}>약관을 불러오는 중입니다...</p>}
          {!loading && error && <p className="signup-error">{error}</p>}
          {!loading && !error && (
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>
              {content}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
