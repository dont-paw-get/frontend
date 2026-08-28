import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword, ApiError } from '../api/authApi';
import './SignupPage.css';

// 비밀번호 정책: 8자 이상, 영문 대/소문자·숫자·특수문자 포함
const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * PasswordReset — 비밀번호 찾기/재설정 (2단계).
 *  1) request: 이메일 입력 → forgotPassword로 인증 코드 발송 (204, 중립 안내)
 *  2) reset:   코드 + 새 비밀번호 입력 → resetPassword (204) → 로그인 이동
 *
 * 보안상 가입 여부를 노출하지 않으므로 '가입되지 않은 이메일' 분기는 두지 않는다.
 */
export default function PasswordReset() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 1단계: 인증 코드 발송
  const handleForgot = async (e) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      await forgotPassword({ email: email.trim() });
      setNotice('가입된 이메일인 경우 인증 코드를 발송했어요. 메일함을 확인해 주세요.');
      setStep('reset');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('요청이 많아요. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2단계: 비밀번호 재설정
  const handleReset = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!code.trim() || !newPw || !newPwConfirm) {
      setError('모든 항목을 입력해 주세요.');
      return;
    }
    if (!PW_RE.test(newPw)) {
      setError('비밀번호는 8자 이상이며 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.');
      return;
    }
    if (newPw !== newPwConfirm) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword({ email: email.trim(), code: code.trim(), newPassword: newPw });
      navigate('/login', { state: { passwordReset: true } });
    } catch (err) {
      if (err instanceof ApiError) {
        // 400: 코드 오류/만료, 비밀번호 정책 위반 등 백엔드 메시지 노출
        setError(err.message || '비밀번호 재설정에 실패했어요. 코드를 다시 확인해 주세요.');
      } else {
        setError('일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-panel">
        <div className="signup-header">
          <img className="signup-logo" src="/logo.webp" alt="로고" width={48} height={48} decoding="async" />
          <h1 className="signup-title">비밀번호 재설정</h1>
          <p className="signup-subtitle">
            {step === 'request'
              ? '가입한 이메일로 인증 코드를 보내드려요.'
              : '메일로 받은 인증 코드와 새 비밀번호를 입력해 주세요.'}
          </p>
        </div>

        {step === 'request' ? (
          <form className="signup-form" onSubmit={handleForgot}>
            <div className="signup-field">
              <label htmlFor="pr-email">이메일</label>
              <input
                id="pr-email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                autoComplete="email"
                autoFocus
              />
              {error && <span className="signup-error">{error}</span>}
            </div>
            <button className="signup-btn" type="submit" disabled={loading || !email.trim()}>
              {loading ? '발송 중...' : '인증 코드 받기'}
            </button>
          </form>
        ) : (
          <form className="signup-form" onSubmit={handleReset}>
            {notice && <span className="signup-hint">{notice}</span>}
            <div className="signup-field">
              <label htmlFor="pr-code">인증 코드</label>
              <input
                id="pr-code"
                type="text"
                inputMode="numeric"
                placeholder="메일로 받은 코드"
                value={code}
                onChange={(e) => { setCode(e.target.value); if (error) setError(''); }}
                autoFocus
              />
            </div>
            <div className="signup-field">
              <label htmlFor="pr-newpw">새 비밀번호</label>
              <input
                id="pr-newpw"
                type="password"
                placeholder="8자 이상 영문 대/소문자+숫자+특수문자"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); if (error) setError(''); }}
                autoComplete="new-password"
              />
            </div>
            <div className="signup-field">
              <label htmlFor="pr-newpw-confirm">새 비밀번호 확인</label>
              <input
                id="pr-newpw-confirm"
                type="password"
                placeholder="새 비밀번호를 다시 입력하세요"
                value={newPwConfirm}
                onChange={(e) => { setNewPwConfirm(e.target.value); if (error) setError(''); }}
                autoComplete="new-password"
              />
              {error && <span className="signup-error">{error}</span>}
            </div>
            <button className="signup-btn" type="submit" disabled={loading}>
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}

        <div className="signup-footer">
          <span>로그인으로 돌아가시겠어요?</span>
          <button className="signup-login-link" onClick={() => navigate('/login')}>
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}
