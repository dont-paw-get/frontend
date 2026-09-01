/**
 * 마크다운 형식의 AI 사서 답변 텍스트를 파싱하여 깔끔한 React 컴포넌트로 렌더링하는 뷰어
 */

/**
 * 인라인 볼드(**...**) 및 특수문자를 React 노드로 변환
 */
function renderInline(text) {
  if (!text) return null;

  // 낫표/화살괄호 내부의 불필요한 공백 정제 (예: 『 도서명 』 -> 『도서명』)
  const cleanedText = text
    .replace(/『\s+/g, '『')
    .replace(/\s+』/g, '』')
    .replace(/《\s+/g, '《')
    .replace(/\s+》/g, '》');

  // **볼드** 패턴 분리
  const parts = cleanedText.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--text-h)', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/**
 * 도서 카드를 감싸는 프리미엄 북 카드 컴포넌트
 * - type='recommend' (### 📖): [서재에 등록 ➔] 버튼
 * - type='library'   (### 📚): [책 열기 ➔] 버튼
 */
function BookCardView({ type = 'recommend', title, author, reason, status, onRegister, onOpenDetail, keyPrefix }) {
  const isLibrary = type === 'library';

  return (
    <div
      key={`book-card-${keyPrefix}`}
      style={{
        margin: '10px 0',
        padding: '12px 14px',
        backgroundColor: 'var(--accent-bg, rgba(140, 90, 50, 0.05))',
        borderLeft: isLibrary ? '3.5px solid #10b981' : '3.5px solid var(--accent, #6366f1)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* 도서 제목 + 액션 버튼 (헤더) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 13.5,
            color: isLibrary ? '#10b981' : 'var(--accent, #6366f1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          <span style={{ fontSize: 15 }}>{isLibrary ? '📚' : '📖'}</span>
          <span>{title}</span>
        </div>

        {/* 액션 버튼 */}
        {isLibrary && onOpenDetail && (
          <button
            type="button"
            onClick={() => onOpenDetail({ title, author, status })}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: '#10b981',
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            책 열기 ➔
          </button>
        )}
        {!isLibrary && onRegister && (
          <button
            type="button"
            onClick={() => onRegister({ title, author })}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--accent-border, var(--accent))',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            등록 ➔
          </button>
        )}
      </div>

      {/* 저자 및 독서 상태 칩 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {author && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              color: 'var(--text-muted, #666)',
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              padding: '2px 8px',
              borderRadius: 4,
              width: 'fit-content',
              fontWeight: 500,
            }}
          >
            <span>👤 {author}</span>
          </div>
        )}
        {status && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              color: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              padding: '2px 8px',
              borderRadius: 4,
              width: 'fit-content',
              fontWeight: 600,
            }}
          >
            <span>🔖 {status}</span>
          </div>
        )}
      </div>

      {/* 추천 이유 (외부 추천 도서인 경우) */}
      {reason && (
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--text-h)',
            lineHeight: 1.6,
            marginTop: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid rgba(0, 0, 0, 0.04)',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--accent, #6366f1)', marginRight: 4 }}>💡 추천 이유:</span>
          {renderInline(reason)}
        </div>
      )}
    </div>
  );
}

/**
 * 마크다운 텍스트를 줄 단위로 분석하여 도서 카드(추천/내서재), 헤딩, 목록, 일반 단락으로 렌더링
 * @param {object} props
 * @param {string} props.text - 마크다운 텍스트
 * @param {(book: object) => void} [props.onRegister] - 추천 도서 등록 콜백
 * @param {(book: object) => void} [props.onOpenDetail] - 내 서재 도서 상세 열기 콜백
 */
export default function MarkdownRenderer({ text, onRegister, onOpenDetail }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];

  let currentList = [];
  let currentBook = null;

  const flushBook = (keyPrefix) => {
    if (currentBook) {
      elements.push(
        <BookCardView
          key={`book-card-${keyPrefix}-${currentBook.title}`}
          keyPrefix={`${keyPrefix}-${currentBook.title}`}
          type={currentBook.type}
          title={currentBook.title}
          author={currentBook.author}
          reason={currentBook.reason}
          status={currentBook.status}
          onRegister={onRegister}
          onOpenDetail={onOpenDetail}
        />
      );
      currentBook = null;
    }
  };

  const flushList = (keyPrefix) => {
    if (currentList.length > 0) {
      elements.push(
        <ul
          key={`${keyPrefix}-list`}
          style={{
            margin: '4px 0 8px 0',
            paddingLeft: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            lineHeight: 1.5,
          }}
        >
          {currentList.map((item, idx) => (
            <li key={idx} style={{ color: 'var(--text-h)', fontSize: 12.5 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 1. 빈 줄
    if (!trimmed) {
      flushList(idx);
      return;
    }

    // 2-A. 추천 도서 카드 시작: ### 📖 {도서 제목}
    if (/^#{1,4}\s*📖\s*/.test(trimmed)) {
      flushList(idx);
      flushBook(idx);
      const rawTitle = trimmed.replace(/^#{1,4}\s*📖\s*/, '').trim();
      const title = rawTitle.replace(/^[『《"'\s]+|[』》"'\s]+$/g, '').trim();
      currentBook = { type: 'recommend', title, author: '', reason: '' };
      return;
    }

    // 2-B. 내 서재 도서 카드 시작: ### 📚 {도서 제목}
    if (/^#{1,4}\s*📚\s*/.test(trimmed)) {
      flushList(idx);
      flushBook(idx);
      const rawTitle = trimmed.replace(/^#{1,4}\s*📚\s*/, '').trim();
      const title = rawTitle.replace(/^[『《"'\s]+|[』》"'\s]+$/g, '').trim();
      currentBook = { type: 'library', title, author: '', status: '' };
      return;
    }

    // 2-1. 도서 카드 내부 항목 파싱 (- **저자**:, - **추천 이유**:, - **독서 상태**:)
    if (currentBook) {
      if (/^[-*•]\s*\*\*저자\*\*\s*[:：]\s*/.test(trimmed)) {
        currentBook.author = trimmed.replace(/^[-*•]\s*\*\*저자\*\*\s*[:：]\s*/, '').trim();
        return;
      }
      if (/^[-*•]\s*\*\*추천\s*이유\*\*\s*[:：]\s*/.test(trimmed)) {
        currentBook.reason = trimmed.replace(/^[-*•]\s*\*\*추천\s*이유\*\*\s*[:：]\s*/, '').trim();
        return;
      }
      if (/^[-*•]\s*\*\*독서\s*상태\*\*\s*[:：]\s*/.test(trimmed)) {
        currentBook.status = trimmed.replace(/^[-*•]\s*\*\*독서\s*상태\*\*\s*[:：]\s*/, '').trim();
        return;
      }
      // 도서 카드가 끝난 후 일반 마크다운이 시작될 때 flush
      if (/^#{1,4}\s+/.test(trimmed) || !trimmed.startsWith('-')) {
        flushBook(idx);
      }
    }

    // 3. 일반 헤딩 (###, ##, #)
    if (/^#{1,4}\s+/.test(trimmed)) {
      flushList(idx);
      flushBook(idx);
      const headingContent = trimmed.replace(/^#{1,4}\s+/, '');
      elements.push(
        <div
          key={idx}
          style={{
            fontWeight: 700,
            fontSize: 13.5,
            color: 'var(--accent)',
            marginTop: elements.length > 0 ? 10 : 2,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {renderInline(headingContent)}
        </div>
      );
      return;
    }

    // 4. 글머리 기호 목록 (- , * , • )
    if (/^[-*•]\s+/.test(trimmed)) {
      const listItemContent = trimmed.replace(/^[-*•]\s+/, '');
      currentList.push(listItemContent);
      return;
    }

    // 5. 번호 매김 목록 (1. , 2. )
    if (/^\d+\.\s+/.test(trimmed)) {
      flushList(idx);
      flushBook(idx);
      elements.push(
        <div
          key={idx}
          style={{
            margin: '4px 0',
            fontSize: 12.5,
            color: 'var(--text-h)',
            lineHeight: 1.5,
          }}
        >
          {renderInline(trimmed)}
        </div>
      );
      return;
    }

    // 6. 일반 본문 단락 (사서 서두/마무리 멘트 등)
    flushList(idx);
    flushBook(idx);
    elements.push(
      <p
        key={idx}
        style={{
          margin: '4px 0',
          fontSize: 12.5,
          color: 'var(--text-h)',
          lineHeight: 1.55,
        }}
      >
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList('final');
  flushBook('final');

  return (
    <div
      style={{
        lineHeight: 1.55,
        wordBreak: 'break-word',
      }}
    >
      {elements}
    </div>
  );
}
