import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

/**
 * 버튼/입력필드 이미지는 2560x1440 전체 화면 레이어 (투명 배경 + 위치 고정).
 */
const BUTTONS = [
  {
    id: 'login',
    src: '/button/button_login.png',
    tooltip: '로그인',
    left: 55.9, top: 61.9, width: 5.6, height: 8.8,
  },
  {
    id: 'signup',
    src: '/button/button_signup.png',
    tooltip: '회원가입',
    left: 40.9, top: 61.5, width: 7.8, height: 8.5,
  },
  {
    id: 'password',
    src: '/button/button_password.png',
    tooltip: '비밀번호 찾기',
    left: 50.2, top: 62.1, width: 4.3, height: 7.2,
  },
  {
    id: 'eye',
    src: '/button/button_eye.png',
    tooltip: '비밀번호 보기',
    left: 59.5, top: 53.9, width: 1.6, height: 2.7,
  },
];

// 입력 필드 위치 (bbox 비율)
const INPUT_FIELDS = {
  id: { left: 44.0, top: 45.6, width: 15.2, height: 3.8 },
  pw: { left: 44.0, top: 53.3, width: 15.2, height: 3.8 },
};

function LoginButton({ btn, onClick, disabled, active }) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <img
        className={`login-layer-img${hovered || active ? ' login-layer-img--hover' : ''}${disabled ? ' login-layer-img--disabled' : ''}`}
        src={btn.src}
        alt=""
        draggable={false}
      />
      <button
        className={`login-hit-area${disabled ? ' login-hit-area--disabled' : ''}`}
        style={{
          left: `${btn.left}%`,
          top: `${btn.top}%`,
          width: `${btn.width}%`,
          height: `${btn.height}%`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={btn.tooltip}
      >
        {hovered && !disabled && <span className="login-hit-tooltip">{btn.tooltip}</span>}
      </button>
    </>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [eyeActive, setEyeActive] = useState(false);
  const [userId, setUserId] = useState('');
  const [userPw, setUserPw] = useState('');

  const isLoginEnabled = userId.trim().length > 0 && userPw.trim().length > 0;

  const handleEyeClick = useCallback(() => {
    setEyeActive(true);
    setTimeout(() => setEyeActive(false), 3000);
  }, []);

  const handleClick = (id) => {
    switch (id) {
      case 'login':
        if (!isLoginEnabled) return;
        navigate('/library');
        break;
      case 'signup':
        navigate('/signup');
        break;
      case 'password':
        // TODO: 비밀번호 찾기 페이지
        break;
      case 'eye':
        handleEyeClick();
        break;
    }
  };

  return (
    <div className="login-page">
      <img className="login-bg-img" src="/login-bg.png" alt="Don't Paw-get Your Book" />

      {/* 로고 (3D 젤리 스티커 효과) */}
      <img
        className="login-logo-3d"
        src="/button/logo_bl.png"
        alt="Don't Paw-get Logo"
        draggable={false}
      />

      {/* 입력 필드 이미지 레이어 */}
      <img className="login-layer-img" src="/Input_field/id.png" alt="" draggable={false} />
      <img className="login-layer-img" src="/Input_field/pw.png" alt="" draggable={false} />

      {/* 실제 입력 필드 (이미지 위에 투명하게 겹침) */}
      <input
        className="login-input-field"
        style={{
          left: `${INPUT_FIELDS.id.left}%`,
          top: `${INPUT_FIELDS.id.top}%`,
          width: `${INPUT_FIELDS.id.width}%`,
          height: `${INPUT_FIELDS.id.height}%`,
        }}
        type="text"
        placeholder="아이디를 입력하세요"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        autoComplete="username"
      />
      <input
        className="login-input-field"
        style={{
          left: `${INPUT_FIELDS.pw.left}%`,
          top: `${INPUT_FIELDS.pw.top}%`,
          width: `${INPUT_FIELDS.pw.width}%`,
          height: `${INPUT_FIELDS.pw.height}%`,
        }}
        type={eyeActive ? 'text' : 'password'}
        placeholder="비밀번호를 입력하세요"
        value={userPw}
        onChange={(e) => setUserPw(e.target.value)}
        autoComplete="current-password"
      />

      {/* 버튼들 */}
      {BUTTONS.map((btn) => (
        <LoginButton
          key={btn.id}
          btn={btn}
          onClick={() => handleClick(btn.id)}
          active={btn.id === 'eye' && eyeActive}
          disabled={btn.id === 'login' && !isLoginEnabled}
        />
      ))}

      {/* 비밀번호 표시 상태 인디케이터 */}
      {eyeActive && (
        <div className="login-eye-indicator">
          비밀번호 표시 중...
        </div>
      )}
    </div>
  );
}
