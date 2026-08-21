import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <img className="login-bg-img" src="/login-bg.png" alt="Don't Paw-get Your Book" />

      <button className="login-signup-btn" onClick={() => navigate('/signup')}>
        회원가입
      </button>
    </div>
  );
}
