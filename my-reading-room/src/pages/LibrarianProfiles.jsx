import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrarian } from '../store/librarianStore';
import { genreLabelForLibrarian } from '../data/librarians';
import './LibrarianProfiles.css';

/**
 * LibrarianProfiles — 보유 사서 목록/프로필 페이지.
 *
 * - 사서 카드를 데이터(LIBRARIANS)로 렌더링하므로 캐릭터가 추가되면 자동 반영됩니다.
 * - 카드에서 사서를 선택하면 내 서재가 해당 사서 기준으로 즉시 전환됩니다.
 * - 사서 이름(닉네임)은 이 페이지에서 사용자가 직접 변경합니다. (기본값: 고양이=블루, 황새=슈빌)
 */
export default function LibrarianProfiles() {
  const { librarians, activeId, setActiveId, renameLibrarian, representativeId } = useLibrarian();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

  const startEdit = (lib) => {
    setEditingId(lib.id);
    setDraft(lib.displayName);
  };

  const saveEdit = (id) => {
    renameLibrarian(id, draft);
    setEditingId(null);
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter') saveEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  const handleSelect = (id) => {
    setActiveId(id);
    navigate('/library');
  };

  return (
    <section className="lp">
      <h2 className="lp-heading">사서 프로필</h2>
      <p className="lp-desc">
        사서를 선택하면 내 서재가 그 사서의 공간으로 바뀝니다. 사서 이름은 자유롭게 바꿀 수 있어요.
      </p>

      <div className="lp-grid">
        {librarians.map((lib) => {
          const isActive = lib.id === activeId;
          const isEditing = editingId === lib.id;

          return (
            <article key={lib.id} className={`lp-card${isActive ? ' lp-card--active' : ''}`}>
              {isActive && <span className="lp-badge lp-badge--active">활동 중</span>}
              {lib.id === representativeId && (
                <span className="lp-badge lp-badge--rep">대표 사서</span>
              )}

              <div className="lp-avatar">
                {lib.image ? (
                  <img src={lib.image} alt={`${lib.displayName} 프로필`} width={96} height={96} decoding="async" />
                ) : (
                  <span className="lp-avatar-fallback" aria-hidden="true">{lib.icon}</span>
                )}
              </div>

              {/* 사서 이름 (사용자 지정) */}
              <div className="lp-name-row">
                {isEditing ? (
                  <>
                    <input
                      className="lp-name-input"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, lib.id)}
                      maxLength={20}
                      autoFocus
                      aria-label="사서 이름"
                    />
                    <button className="lp-btn lp-btn--primary" onClick={() => saveEdit(lib.id)}>저장</button>
                    <button className="lp-btn lp-btn--ghost" onClick={() => setEditingId(null)}>취소</button>
                  </>
                ) : (
                  <>
                    <strong className="lp-name">{lib.displayName}</strong>
                    <button className="lp-btn lp-btn--ghost" onClick={() => startEdit(lib)}>이름 수정</button>
                  </>
                )}
              </div>

              <dl className="lp-meta">
                <div className="lp-meta-row">
                  <dt>종</dt>
                  <dd>{lib.species}</dd>
                </div>
                <div className="lp-meta-row">
                  <dt>특화 장르</dt>
                  <dd>{genreLabelForLibrarian(lib)}</dd>
                </div>
                <div className="lp-meta-row">
                  <dt>말투</dt>
                  <dd>{lib.persona}</dd>
                </div>
              </dl>

              <button
                className="lp-select-btn"
                onClick={() => handleSelect(lib.id)}
                disabled={isActive}
              >
                {isActive ? '현재 서재의 사서' : '이 사서로 서재 열기'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
