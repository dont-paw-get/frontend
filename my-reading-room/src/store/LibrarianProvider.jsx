import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LibrarianContext,
  ACTIVE_LIBRARIAN_KEY,
  LIBRARIAN_NAMES_KEY,
} from './librarianStore';
import { LIBRARIANS, DEFAULT_LIBRARIAN_ID, getLibrarian } from '../data/librarians';

/**
 * 사서 전역 상태.
 * - activeId: 현재 서재/채팅에 적용된 사서
 * - names: 사용자가 지정한 사서 이름 (기본값은 각 사서의 defaultName — 고양이=블루, 황새=슈빌)
 *
 * DB 매핑 참고: librarian.name(사용자 지정 이름), librarian.is_representative(대표 사서)
 * 현재는 localStorage에 저장하며, 추후 Library 서비스 API로 교체 예정.
 */

function loadActiveId() {
  try {
    const saved = localStorage.getItem(ACTIVE_LIBRARIAN_KEY);
    if (saved && LIBRARIANS.some((l) => l.id === saved)) return saved;
  } catch {
    // 무시
  }
  return DEFAULT_LIBRARIAN_ID;
}

function defaultNames() {
  return LIBRARIANS.reduce((acc, l) => ({ ...acc, [l.id]: l.defaultName }), {});
}

function loadNames() {
  const base = defaultNames();
  try {
    const raw = localStorage.getItem(LIBRARIAN_NAMES_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    // 저장된 값 중 유효한 사서 id만 병합 (기본 이름을 fallback으로 유지)
    return LIBRARIANS.reduce(
      (acc, l) => ({ ...acc, [l.id]: parsed?.[l.id]?.trim() || l.defaultName }),
      base
    );
  } catch {
    return base;
  }
}

export function LibrarianProvider({ children }) {
  const [activeId, setActiveId] = useState(loadActiveId);
  const [names, setNames] = useState(loadNames);

  // 활성 사서를 테마 스코프(data-librarian)와 localStorage에 동기화
  useEffect(() => {
    document.documentElement.setAttribute('data-librarian', activeId);
    try {
      localStorage.setItem(ACTIVE_LIBRARIAN_KEY, activeId);
    } catch {
      // 무시
    }
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARIAN_NAMES_KEY, JSON.stringify(names));
    } catch {
      // 무시
    }
  }, [names]);

  /** 사서 이름 변경 (빈 값이면 기본 이름으로 되돌림) */
  const renameLibrarian = useCallback((id, name) => {
    const trimmed = (name || '').trim();
    setNames((prev) => ({
      ...prev,
      [id]: trimmed || getLibrarian(id).defaultName,
    }));
    // TODO: 실제 API 호출로 librarian.name 저장
  }, []);

  /** 사서 캐릭터 정보 + 사용자 지정 이름을 합친 객체 */
  const decorate = useCallback(
    (id) => {
      const base = getLibrarian(id);
      return { ...base, displayName: names[base.id] || base.defaultName };
    },
    [names]
  );

  const librarians = useMemo(
    () => LIBRARIANS.map((l) => ({ ...l, displayName: names[l.id] || l.defaultName })),
    [names]
  );

  const value = useMemo(
    () => ({
      activeId,
      setActiveId,
      librarian: decorate(activeId),
      librarians,
      names,
      renameLibrarian,
      // 대표 사서 = 기본 사서 (DB librarian.is_representative 대응)
      representativeId: DEFAULT_LIBRARIAN_ID,
    }),
    [activeId, decorate, librarians, names, renameLibrarian]
  );

  return <LibrarianContext.Provider value={value}>{children}</LibrarianContext.Provider>;
}
