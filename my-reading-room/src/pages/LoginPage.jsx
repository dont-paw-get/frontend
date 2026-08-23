import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

/**
 * 버튼 이미지는 2560x1440 전체 화면 레이어 (투명 배경 + 버튼 위치 고정).
 * 전체 화면에 레이어로 깔되, 클릭 가능 영역(bbox)만 잡아서 pointer-events 처리.
 */
const BUTTONS = [
  {
    id: 'login',
    src: '/button/button_login.png',
    tooltip: '로그인',
    // 불투명 영역 bbox (비율)
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
];

function LoginButton({ btn, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      {/* 전체 화면 이미지 레이어 (시각적 표시용, 클릭 불가) */}
      <img
        className={`login-layer-img${hovered ? ' login-layer-img--hover' : ''}`}
        src={btn.src}
        alt=""
        draggable={false}
      />
      {/* 클릭 가능 히트 영역 (bbox만큼만) */}
      <button
        className="login-hit-area"
        style={{
          left: `${btn.left}%`,
          top: `${btn.top}%`,
          width: `${btn.width}%`,
          height: `${btn.height}%`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
        aria-label={btn.tooltip}
      >
        {hovered && <span className="login-hit-tooltip">{btn.tooltip}</span>}
      </button>
    </>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();

  const handleClick = (id) => {
    switch (id) {
      case 'login':
        // TODO: 실제 로그인 처리 (지금은 메인으로 이동)
        navigate('/library');
        break;
      case 'signup':
        navigate('/signup');
        break;
      case 'password':
        // TODO: 비밀번호 찾기 페이지
        break;
    }
  };

  return (
    <div className="login-page">
      <img className="login-bg-img" src="/login-bg.png" alt="Don't Paw-get Your Book" />

      {BUTTONS.map((btn) => (
        <LoginButton key={btn.id} btn={btn} onClick={() => handleClick(btn.id)} />
      ))}
    </div>
  );
}
