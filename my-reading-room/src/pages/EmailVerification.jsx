import { useState } from 'react';
import { confirmSignup, resendSignupCode, ApiError } from '../api/authApi';

/**
 * EmailVerification — 회원가입 직후 이메일 인증 코드 입력 단계.
 * SignupPage 내부에서 회원가입 성공(201) 후 렌더된다.
 *
 * @param {string} email - 인증 대상 이메일
 * @param {()=>void} onVerified - 인증 완료(ACTIVE) 콜백 → 로그인 화면 이동
 */
export default function EmailVerification({ email, onVerified }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError('');
    setResendMsg('');
    try {
      await confirmSignup({ email, code: code.trim() });
      onVerified();
    } catch (err) {
      if (err instanceof ApiError) {
        // 400: 코드 오류/만료 등은 백엔드 메시지를 그대로 노출
        setError(err.message || '인증에 실패했습니다. 코드를 다시 확인해 주세요.');
      } else {
        setError('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError('');
    setResendMsg('');
    try {
      await resendSignupCode({ email });
      setResendMsg('인증 코드를 재전송했습니다. 메일함을 확인해 주세요.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setResendMsg('요청이 많아요. 잠시 후 다시 시도해 주세요.');
      } else {
        setResendMsg('재전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="signup-panel">
      <div className="signup-header">
        <img className="signup-logo" src="/logo.webp" alt="로고" width={48} height={48} decoding="async" />
        <h1 className="signup-title">이메일 인증</h1>
        <p className="signup-subtitle">
          <strong>{email}</strong> 으로 보낸 인증 코드를 입력해 주세요.
        </p>
      </div>

      <form className="signup-form" onSubmit={handleConfirm}>
        <div className="signup-field">
          <label htmlFor="verify-code">인증 코드</label>
          <input
            id="verify-code"
            type="text"
            inputMode="numeric"
            placeholder="메일로 받은 6자리 코드"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          {error && <span className="signup-error">{error}</span>}
          {resendMsg && <span className="signup-hint">{resendMsg}</span>}
        </div>

        <button className="signup-btn" type="submit" disabled={loading || !code.trim()}>
          {loading ? '인증 중...' : '인증 완료'}
        </button>
      </form>

      <div className="signup-footer">
        <span>코드를 받지 못하셨나요?</span>
        <button className="signup-login-link" onClick={handleResend} disabled={resending}>
          {resending ? '재전송 중...' : '인증 코드 재전송'}
        </button>
      </div>
    </div>
  );
}
