import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <img
        className="login-bg-img"
        src="/login-bg.webp"
        alt="Don't Paw-get Your Book"
        width={2560}
        height={1440}
        fetchPriority="high"
        decoding="async"
      />

      <button className="login-signup-btn" onClick={() => navigate('/signup')}>
        회원가입
      </button>
    </div>
  );
}
