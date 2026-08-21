import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <div className="login-bg">
        <img src="/login-bg.png" alt="Don't Paw-get Your Book" />
      </div>

      <div className="login-panel">
        <div className="login-header">
          <img className="login-logo" src="/logo.jpg" alt="로고" />
          <h1 className="login-title">Don't Paw-get<br />Your Book</h1>
          <p className="login-subtitle">나만의 사서와 함께하는 독서 공간</p>
        </div>

        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          <div className="login-field">
            <label htmlFor="login-id">아이디</label>
            <input id="login-id" type="text" placeholder="아이디를 입력하세요" autoComplete="username" />
          </div>

          <div className="login-field">
            <label htmlFor="login-pw">비밀번호</label>
            <input id="login-pw" type="password" placeholder="비밀번호를 입력하세요" autoComplete="current-password" />
          </div>

          <button className="login-btn" type="submit">로그인</button>
        </form>

        <button className="login-signup-btn" onClick={() => navigate('/signup')}>
          회원가입
        </button>

        <div className="login-footer">
          <button className="login-footer-link" onClick={() => navigate('/signup')}>회원가입</button>
          <span className="login-divider">|</span>
          <a className="login-footer-link" href="#find">아이디/비밀번호 찾기</a>
        </div>
      </div>
    </div>
  );
}
