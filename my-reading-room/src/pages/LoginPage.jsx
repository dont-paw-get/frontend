import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/authStore';
import { ApiError } from '../api/authApi';
import './LoginPage.css';

/**
 * 버튼/입력필드 이미지는 2560x1440 전체 화면 레이어 (투명 배경 + 위치 고정).
 */
const BUTTONS = [
  {
    id: 'login',
    src: '/button/button_login.webp',
    tooltip: '로그인',
    left: 55.9, top: 61.9, width: 5.6, height: 8.8,
  },
  {
    id: 'signup',
    src: '/button/button_signup.webp',
    tooltip: '회원가입',
    left: 40.9, top: 61.5, width: 7.8, height: 8.5,
  },
  {
    id: 'password',
    src: '/button/button_password.webp',
    tooltip: '비밀번호 찾기',
    left: 50.2, top: 62.1, width: 4.3, height: 7.2,
  },
  {
    id: 'eye',
    src: '/button/button_eye.webp',
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
        width={2560}
        height={1440}
        decoding="async"
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
  const location = useLocation();
  const { login } = useAuth();
  // 보호 라우트에서 리다이렉트된 경우 로그인 후 원래 위치로 복귀
  const from = location.state?.from || '/library';
  const [eyeActive, setEyeActive] = useState(false);
  const [email, setEmail] = useState('');
  const [userPw, setUserPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLoginEnabled = email.trim().length > 0 && userPw.trim().length > 0 && !loading;

  const handleEyeClick = useCallback(() => {
    setEyeActive(true);
    setTimeout(() => setEyeActive(false), 3000);
  }, []);

  const handleLogin = async () => {
    if (!isLoginEnabled) return;
    setLoading(true);
    setError('');
    try {
      await login({ email: email.trim(), password: userPw });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403 && err.code === 'EMAIL_NOT_VERIFIED') {
          // 이메일 인증 미완료 → 인증 화면으로 유도 (email 전달)
          navigate('/signup', { state: { verifyEmail: email.trim() } });
          return;
        }
        if (err.status === 403) {
          setError('탈퇴한 계정이에요. 다른 계정으로 로그인해 주세요.');
        } else if (err.status === 401) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else if (err.status === 429) {
          setError('요청이 많아요. 잠시 후 다시 시도해 주세요.');
        } else {
          setError('로그인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
        }
      } else {
        setError('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (id) => {
    switch (id) {
      case 'login':
        handleLogin();
        break;
      case 'signup':
        navigate('/signup');
        break;
      case 'password':
        navigate('/password/forgot');
        break;
      case 'eye':
        handleEyeClick();
        break;
    }
  };

  return (
    <div className="login-page">
      <img
        className="login-bg-img"
        src="/login-bg.webp"
        alt="Don't Paw-get Your Book"
        width={1920}
        height={1080}
        decoding="async"
      />

      {/* 로고 (3D 젤리 스티커 효과) */}
      <img
        className="login-logo-3d"
        src="/button/logo_bl.webp"
        alt="Don't Paw-get Logo"
        width={2560}
        height={1440}
        decoding="async"
        draggable={false}
      />

      {/* 입력 필드 이미지 레이어 (투명) */}
      <img
        className="login-layer-img login-layer-img--input"
        src="/Input_field/id.webp"
        alt=""
        width={2560}
        height={1440}
        decoding="async"
        draggable={false}
      />
      <img
        className="login-layer-img login-layer-img--input"
        src="/Input_field/pw.webp"
        alt=""
        width={2560}
        height={1440}
        decoding="async"
        draggable={false}
      />

      {/* 실제 입력 필드 (이미지 위에 투명하게 겹침) */}
      <input
        className="login-input-field"
        style={{
          left: `${INPUT_FIELDS.id.left}%`,
          top: `${INPUT_FIELDS.id.top}%`,
          width: `${INPUT_FIELDS.id.width}%`,
          height: `${INPUT_FIELDS.id.height}%`,
        }}
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
        autoComplete="email"
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
        placeholder="비밀번호"
        value={userPw}
        onChange={(e) => { setUserPw(e.target.value); if (error) setError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
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

      {/* 로그인 에러 메시지 */}
      {error && <div className="login-error">{error}</div>}
    </div>
  );
}
