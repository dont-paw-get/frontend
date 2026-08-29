import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signup, getTerms, ApiError } from '../api/authApi';
import EmailVerification from './EmailVerification';
import TermsModal from './TermsModal';
import './SignupPage.css';

// 체크박스 code ↔ 표시용 fallback 이름 (API 응답이 늦거나 실패해도 라벨은 항상 보이도록)
const TERMS_FALLBACK_NAME = {
  TERMS_OF_SERVICE: '이용약관',
  PRIVACY: '개인정보 처리방침',
  AI_ANALYSIS: 'AI 분석 활용 동의',
};

// 비밀번호 정책: 8자 이상, 영문 대/소문자·숫자·특수문자 포함
const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
// 폼 표시용 성별(한글) → 백엔드 계약(MALE/FEMALE) 매핑
const GENDER_MAP = { 남성: 'MALE', 여성: 'FEMALE' };

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    nickname: '',
    birthDate: '',
    gender: '',
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAI, setAgreeAI] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // 회원가입 성공(201) 후, 또는 로그인에서 EMAIL_NOT_VERIFIED로 넘어온 경우 이메일 인증 단계로 전환
  const [verifyEmail, setVerifyEmail] = useState(location.state?.verifyEmail ?? null);

  // ── 약관 전문 ──
  const [termsByCode, setTermsByCode] = useState({}); // { [code]: { name, content } }
  const [termsLoading, setTermsLoading] = useState(true);
  const [termsError, setTermsError] = useState('');
  const [openTermsCode, setOpenTermsCode] = useState(null); // 현재 모달로 열린 약관 code

  // 페이지 마운트 시 약관 전문 미리 조회 (클릭 시 지연 없이 바로 표시)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getTerms();
        if (cancelled) return;
        const byCode = {};
        (list || []).forEach((t) => {
          byCode[t.code] = { name: t.name, content: t.content };
        });
        setTermsByCode(byCode);
        setTermsError('');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 503) {
          setTermsError('약관을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.');
        } else {
          setTermsError('약관을 불러오는 중 오류가 발생했어요.');
        }
      } finally {
        if (!cancelled) setTermsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'password' && !pwTouched) setPwTouched(true);
    if (submitError) setSubmitError('');
  };

  const pwValid = PW_RE.test(form.password);
  const pwMatch = form.password === form.passwordConfirm;
  const allRequired =
    agreeTerms &&
    agreePrivacy &&
    form.email.trim() &&
    pwValid &&
    pwMatch &&
    form.nickname.trim() &&
    form.birthDate &&
    form.gender;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allRequired || loading) return;

    setLoading(true);
    setSubmitError('');
    try {
      await signup({
        email: form.email.trim(),
        password: form.password,
        nickname: form.nickname.trim(),
        birth_date: form.birthDate, // YYYY-MM-DD (date input)
        gender: GENDER_MAP[form.gender],
        agree_terms: agreeTerms,
        agree_privacy: agreePrivacy,
        agree_ai_analysis: agreeAI,
      });
      // 201 → 이메일 인증 코드 입력 단계로 전환
      setVerifyEmail(form.email.trim());
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setSubmitError('이미 가입된 이메일이에요. 로그인해 주세요.');
        } else if (err.status === 429) {
          setSubmitError('요청이 많아요. 잠시 후 다시 시도해 주세요.');
        } else if (err.status === 400 || err.status === 422) {
          setSubmitError(err.message || '입력값을 다시 확인해 주세요.');
        } else {
          setSubmitError('회원가입 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
        }
      } else {
        setSubmitError('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 이메일 인증 단계
  if (verifyEmail) {
    return (
      <div className="signup-page">
        <EmailVerification email={verifyEmail} onVerified={() => navigate('/login')} />
      </div>
    );
  }

  return (
    <div className="signup-page">
      <div className="signup-panel">
        <div className="signup-header">
          <img className="signup-logo" src="/logo.webp" alt="로고" width={48} height={48} decoding="async" />
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
              placeholder="8자 이상 영문+숫자+특수문자"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            {pwTouched && (
              <span className="signup-hint">
                비밀번호는 8자 이상이며 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.
              </span>
            )}
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

          {/* 사용자 ID (백엔드 계약상 nickname 필드로 전송) */}
          <div className="signup-field">
            <label htmlFor="signup-userid">사용자 ID</label>
            <input
              id="signup-userid"
              name="nickname"
              type="text"
              placeholder="사용할 사용자 ID 입력"
              value={form.nickname}
              onChange={handleChange}
              autoComplete="username"
              required
            />
          </div>

          {/* 생년월일 + 성별 (같은 행) */}
          <div className="signup-row">
            <div className="signup-field signup-field--half">
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
            <div className="signup-field signup-field--half">
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
          </div>

          {/* 약관 동의 (3개) */}
          <div className="signup-field signup-terms">
            <div className="signup-checkbox-row">
              <label className="signup-checkbox">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                />
                <span>[필수] 이용약관 동의</span>
              </label>
              <button
                type="button"
                className="signup-terms-view-btn"
                onClick={() => setOpenTermsCode('TERMS_OF_SERVICE')}
                disabled={termsLoading}
              >
                보기
              </button>
            </div>
            <div className="signup-checkbox-row">
              <label className="signup-checkbox">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  required
                />
                <span>[필수] 개인정보 처리방침 동의</span>
              </label>
              <button
                type="button"
                className="signup-terms-view-btn"
                onClick={() => setOpenTermsCode('PRIVACY')}
                disabled={termsLoading}
              >
                보기
              </button>
            </div>
            <div className="signup-checkbox-row">
              <label className="signup-checkbox">
                <input
                  type="checkbox"
                  checked={agreeAI}
                  onChange={(e) => setAgreeAI(e.target.checked)}
                />
                <span>[선택] AI 분석 활용 동의</span>
              </label>
              <button
                type="button"
                className="signup-terms-view-btn"
                onClick={() => setOpenTermsCode('AI_ANALYSIS')}
                disabled={termsLoading}
              >
                보기
              </button>
            </div>
          </div>

          {submitError && (
            <span className="signup-error" style={{ textAlign: 'center' }}>{submitError}</span>
          )}

          <button className="signup-btn" type="submit" disabled={!allRequired || loading}>
            {loading ? '가입 처리 중...' : '가입하기'}
          </button>
        </form>

        <div className="signup-footer">
          <span>이미 계정이 있으신가요?</span>
          <button className="signup-login-link" onClick={() => navigate('/login')}>
            로그인
          </button>
        </div>
      </div>

      {openTermsCode && (
        <TermsModal
          name={termsByCode[openTermsCode]?.name || TERMS_FALLBACK_NAME[openTermsCode]}
          content={
            termsByCode[openTermsCode]?.content ??
            (!termsLoading && !termsError ? '등록된 약관 내용이 없어요.' : null)
          }
          loading={termsLoading}
          error={termsError}
          onClose={() => setOpenTermsCode(null)}
        />
      )}
    </div>
  );
}
