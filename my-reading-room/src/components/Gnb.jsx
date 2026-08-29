import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../store/themeStore';
import { useLibrarian } from '../store/librarianStore';
import { useAuth } from '../store/authStore';
import './Gnb.css';

function SunIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
    );
}

function MoonIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
    );
}

export default function Gnb() {
    const { theme, setTheme } = useTheme();
    const { librarian } = useLibrarian();
    const { logout } = useAuth();
    const [showDropdown, setShowDropdown] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    // 내 서재 페이지에서는 GNB를 배경 이미지 위에 투명 오버레이로 띄운다 (다른 페이지는 기존처럼 상단 고정 바)
    const isLibraryPage = location.pathname === '/library';

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            // backend-auth 로그아웃 (Refresh Token revoke + 쿠키 삭제) 후 메모리 토큰 제거
            await logout();
        } catch {
            // 로그아웃 실패해도 클라이언트 상태는 초기화하고 로그인 화면으로 이동
        } finally {
            navigate('/login');
        }
    };

    const goTo = (path) => {
        setShowDropdown(false);
        navigate(path);
    };

    return (
        <nav className={`gnb${isLibraryPage ? ' gnb--overlay' : ''}`}>
            <NavLink to="/library" className="gnb-left">
                <span className="gnb-logo-wrap">
                    <img className="gnb-logo" src="/logo_nv.webp" alt="Don't Paw-get Your Book" width={30} height={30} decoding="async" />
                </span>
                <img className="gnb-service-name" src="/service name.webp" alt="Don't Paw-get Your Book" width={174} height={25} decoding="async" />
            </NavLink>

            <div className="gnb-menu">
                <NavLink to="/library" className={({ isActive }) => (isActive ? 'on' : undefined)}>내 서재</NavLink>
                <NavLink to="/register" className={({ isActive }) => (isActive ? 'on' : undefined)}>책 등록</NavLink>
                <NavLink to="/mypage" className={({ isActive }) => (isActive ? 'on' : undefined)}>마이페이지</NavLink>
            </div>

            <div className="gnb-right">
                {/* 순서: 로그아웃 - 테마 스위치 - 사서이름+프로필사진(하나의 버튼) */}
                <button className="gnb-logout-btn" onClick={handleLogout} disabled={loggingOut}>
                    {loggingOut ? '로그아웃 중...' : '로그아웃'}
                </button>

                <div className="gnb-theme">
                    <button
                        className={theme === 'light' ? 'on' : undefined}
                        onClick={() => setTheme('light')}
                        title="라이트 모드"
                        aria-label="라이트 모드"
                    >
                        <SunIcon />
                    </button>
                    <button
                        className={theme === 'dark' ? 'on' : undefined}
                        onClick={() => setTheme('dark')}
                        title="다크 모드 (손전등)"
                        aria-label="다크 모드"
                    >
                        <MoonIcon />
                    </button>
                </div>

                <div className="gnb-profile-wrap">
                    <button
                        className="gnb-profile-btn"
                        onClick={() => setShowDropdown((prev) => !prev)}
                        aria-label="사서 메뉴"
                        aria-expanded={showDropdown}
                    >
                        <span className="gnb-profile-name">{librarian.displayName}</span>
                        <img className="gnb-profile" src="/profile.webp" alt="" width={32} height={32} decoding="async" />
                    </button>

                    {showDropdown && (
                        <div className="gnb-dropdown">
                            {/* 사서 프로필 페이지에서 사서 선택(변경)과 이름 편집을 함께 처리 */}
                            <button className="gnb-dropdown-item" onClick={() => goTo('/librarians')}>
                                사서 프로필
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
