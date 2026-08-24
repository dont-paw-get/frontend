/**
 * 마크다운 형식의 AI 사서 답변 텍스트를 파싱하여 깔끔한 React 컴포넌트로 렌더링하는 뷰어
 */

/**
 * 인라인 볼드(**...**) 및 특수문자를 React 노드로 변환
 */
function renderInline(text) {
  if (!text) return null;

  // **볼드** 패턴 분리
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
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
 * 마크다운 텍스트를 줄 단위로 분석하여 헤딩, 목록, 일반 단락으로 렌더링
 */
export default function MarkdownRenderer({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];

  let currentList = [];

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

    // 2. 헤딩 (###, ##, #)
    if (/^#{1,4}\s+/.test(trimmed)) {
      flushList(idx);
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

    // 3. 글머리 기호 목록 (- , * , • )
    if (/^[-*•]\s+/.test(trimmed)) {
      const listItemContent = trimmed.replace(/^[-*•]\s+/, '');
      currentList.push(listItemContent);
      return;
    }

    // 4. 번호 매김 목록 (1. , 2. )
    if (/^\d+\.\s+/.test(trimmed)) {
      flushList(idx);
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

    // 5. 일반 본문 단락
    flushList(idx);
    elements.push(
      <p
        key={idx}
        style={{
          margin: '3px 0',
          fontSize: 12.5,
          color: 'var(--text-h)',
          lineHeight: 1.5,
        }}
      >
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList('final');

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
