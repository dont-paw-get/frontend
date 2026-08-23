import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignupPage.css';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    userId: '',
    birthDate: '',
    gender: '',
  });
  const [idChecked, setIdChecked] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'userId') setIdChecked(false);
  };

  const handleIdCheck = () => {
    // TODO: 실제 중복 확인 API 호출
    setIdChecked(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: 실제 회원가입 API 호출
  };

  return (
    <div className="signup-page">
      <div className="signup-panel">
        <div className="signup-header">
          <img className="signup-logo" src="/logo.png" alt="로고" />
          <h1 className="signup-title">회원가입</h1>
          <p className="signup-subtitle">나만의 사서와 함께할 준비를 해볼까요?</p>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          {/* 이메일 */}
          <div className="signup-field">
            <label htmlFor="signup-email">이메일</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              placeholder="example@email.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          {/* 비밀번호 */}
          <div className="signup-field">
            <label htmlFor="signup-pw">비밀번호</label>
            <input
              id="signup-pw"
              name="password"
              type="password"
              placeholder="8자 이상 영문+숫자 조합"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          {/* 비밀번호 재확인 */}
          <div className="signup-field">
            <label htmlFor="signup-pw-confirm">비밀번호 재확인</label>
            <input
              id="signup-pw-confirm"
              name="passwordConfirm"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={form.passwordConfirm}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            {form.passwordConfirm && form.password !== form.passwordConfirm && (
              <span className="signup-error">비밀번호가 일치하지 않습니다</span>
            )}
          </div>

          {/* 사용자 ID + 중복 확인 */}
          <div className="signup-field">
            <label htmlFor="signup-id">사용자 ID</label>
            <div className="signup-id-row">
              <input
                id="signup-id"
                name="userId"
                type="text"
                placeholder="영문/숫자 조합"
                value={form.userId}
                onChange={handleChange}
                autoComplete="username"
                required
              />
              <button
                type="button"
                className="signup-id-check-btn"
                onClick={handleIdCheck}
                disabled={!form.userId}
              >
                중복 확인
              </button>
            </div>
            {idChecked && (
              <span className="signup-success">사용 가능한 아이디입니다</span>
            )}
          </div>

          {/* 생년월일 */}
          <div className="signup-field">
            <label htmlFor="signup-birth">생년월일</label>
            <input
              id="signup-birth"
              name="birthDate"
              type="date"
              value={form.birthDate}
              onChange={handleChange}
              required
            />
          </div>

          {/* 성별 */}
          <div className="signup-field">
            <label>성별</label>
            <div className="signup-gender-row">
              <label className="signup-radio">
                <input
                  type="radio"
                  name="gender"
                  value="남성"
                  checked={form.gender === '남성'}
                  onChange={handleChange}
                />
                <span>남성</span>
              </label>
              <label className="signup-radio">
                <input
                  type="radio"
                  name="gender"
                  value="여성"
                  checked={form.gender === '여성'}
                  onChange={handleChange}
                />
                <span>여성</span>
              </label>
            </div>
          </div>

          {/* 약관 동의 */}
          <div className="signup-field signup-terms">
            <label className="signup-checkbox">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                required
              />
              <span>이용약관 및 개인정보처리방침에 동의합니다</span>
            </label>
          </div>

          <button className="signup-btn" type="submit" disabled={!agreeTerms}>
            가입하기
          </button>
        </form>

        <div className="signup-footer">
          <span>이미 계정이 있으신가요?</span>
          <button className="signup-login-link" onClick={() => navigate('/login')}>
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}
