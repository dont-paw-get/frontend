import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/authStore';

/**
 * ProtectedRoute — 로그인이 필요한 화면을 감싸는 가드.
 *
 * - status 'loading'(세션 복원 중): 스플래시 표시 (깜빡임/조기 리다이렉트 방지)
 * - 'unauthenticated': /login으로 이동하며, 로그인 후 원래 위치로 돌아오도록 from 전달
 * - 'authenticated': children 렌더
 */
export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
          fontSize: 14,
        }}
      >
        불러오는 중이에요... 🐾
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
