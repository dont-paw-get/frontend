import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../store/themeStore';
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
    const [showDropdown, setShowDropdown] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        setShowDropdown(false);
        // TODO: 실제 로그아웃 로직 (토큰 삭제 등) 추가
        navigate('/login');
    };

    return (
        <nav className="gnb">
            <NavLink to="/library" className="gnb-left">
                <img className="gnb-logo" src="/logo.png" alt="Don't Paw-get Your Book" />
                <img className="gnb-service-name" src="/service name.png" alt="Don't Paw-get Your Book" />
            </NavLink>

            <div className="gnb-menu">
                <NavLink to="/library" className={({ isActive }) => (isActive ? 'on' : undefined)}>내 서재</NavLink>
                <NavLink to="/register" className={({ isActive }) => (isActive ? 'on' : undefined)}>책 등록</NavLink>
                <NavLink to="/mypage" className={({ isActive }) => (isActive ? 'on' : undefined)}>마이페이지</NavLink>
            </div>

            <div className="gnb-right">
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
                <span className="gnb-badge">고양이 사서</span>

                <div className="gnb-profile-wrap">
                    <button
                        className="gnb-profile-btn"
                        onClick={() => setShowDropdown((prev) => !prev)}
                        aria-label="프로필 메뉴"
                    >
                        <img className="gnb-profile" src="/profile.png" alt="사서 프로필" />
                    </button>

                    {showDropdown && (
                        <div className="gnb-dropdown">
                            <button className="gnb-dropdown-item" onClick={handleLogout}>
                                로그아웃
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
