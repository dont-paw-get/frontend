import { useState } from 'react';
import './MyPage.css';

// 임시 mock 데이터 (추후 Member 서비스 API 연동 시 교체)
// 사서 이름(닉네임)은 사서 프로필(/librarians)에서 관리하며, 이 페이지는 사용자 계정 정보만 다룸
const mockUser = {
  profileImage: '/profile.webp',
  userId: 'pawget_reader', // 로그인용 사용자 ID
  email: 'reader@dontpawget.com',
  birthDate: '1995-03-12',
  gender: '남성',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 8자 이상, 영문 대/소문자·숫자·특수문자 포함
const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function MyPage() {
  const { profileImage, userId, birthDate, gender } = mockUser;

  // ── 이메일 ──
  const [email, setEmail] = useState(mockUser.email);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(email);
  const [emailError, setEmailError] = useState('');

  // ── 비밀번호 ──
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // ── 알림 설정 ──
  const [notifyRecommend, setNotifyRecommend] = useState(true);
  const [notifyEvent, setNotifyEvent] = useState(false);

  // ── 계정 탈퇴 ──
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // 이메일 저장
  const handleEmailSave = () => {
    const trimmed = emailDraft.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('올바른 이메일 형식을 입력해 주세요.');
      return;
    }
    setEmail(trimmed);
    setEmailError('');
    setEditingEmail(false);
    // TODO: 실제 API 호출로 이메일 변경 (인증 메일 발송 등)
  };
  const handleEmailCancel = () => {
    setEmailDraft(email);
    setEmailError('');
    setEditingEmail(false);
  };

  // 비밀번호 변경
  const handlePwSubmit = (e) => {
    e.preventDefault();
    setPwSuccess(false);
    if (!curPw || !newPw || !confirmPw) {
      setPwError('모든 항목을 입력해 주세요.');
      return;
    }
    if (!PW_RE.test(newPw)) {
      setPwError('비밀번호는 8자 이상이며 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPw === curPw) {
      setPwError('현재 비밀번호와 다른 비밀번호를 사용해 주세요.');
      return;
    }
    // TODO: 실제 API 호출로 비밀번호 변경 (현재 비밀번호 검증 포함)
    setPwError('');
    setPwSuccess(true);
    setCurPw('');
    setNewPw('');
    setConfirmPw('');
    setPwOpen(false);
  };

  const handleWithdraw = () => {
    // TODO: 실제 API 호출로 계정 탈퇴 후 로그아웃/리다이렉트
    setWithdrawOpen(false);
  };

  return (
    <section className="mypage">
      <h2 className="mypage-heading">마이페이지</h2>

      {/* 프로필 카드 */}
      <div className="mypage-card">
        <div className="mypage-avatar-wrap">
          <img
            className="mypage-avatar"
            src={profileImage}
            alt={`${userId} 프로필 사진`}
            width={97}
            height={102}
            decoding="async"
          />
        </div>

        <dl className="mypage-info">
          <div className="mypage-info-row">
            <dt>사용자 ID</dt>
            <dd>{userId}</dd>
          </div>
          <div className="mypage-info-row">
            <dt>생년월일</dt>
            <dd>{birthDate}</dd>
          </div>
          <div className="mypage-info-row">
            <dt>성별</dt>
            <dd>{gender}</dd>
          </div>
        </dl>
      </div>

      {/* 계정 설정 카드 */}
      <div className="mypage-card mypage-card--section">
        <h3 className="mypage-section-title">계정 설정</h3>

        {/* 이메일 변경 */}
        <div className="mypage-field">
          <span className="mypage-field-label">이메일</span>
          {editingEmail ? (
            <div className="mypage-field-edit">
              <input
                className="mypage-text-input"
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="이메일 주소"
                autoFocus
              />
              <div className="mypage-btn-row">
                <button className="mypage-btn mypage-btn--primary" onClick={handleEmailSave}>저장</button>
                <button className="mypage-btn mypage-btn--ghost" onClick={handleEmailCancel}>취소</button>
              </div>
              {emailError && <p className="mypage-error">{emailError}</p>}
            </div>
          ) : (
            <div className="mypage-field-display">
              <span className="mypage-field-value">{email}</span>
              <button
                className="mypage-nickname-edit-btn"
                onClick={() => { setEmailDraft(email); setEmailError(''); setEditingEmail(true); }}
              >
                변경
              </button>
            </div>
          )}
        </div>

        {/* 비밀번호 변경 */}
        <div className="mypage-field">
          <div className="mypage-field-display">
            <span className="mypage-field-label">비밀번호</span>
            <button
              className="mypage-nickname-edit-btn"
              onClick={() => { setPwOpen((v) => !v); setPwError(''); setPwSuccess(false); }}
            >
              {pwOpen ? '닫기' : '변경'}
            </button>
          </div>

          {pwSuccess && <p className="mypage-success">비밀번호가 변경되었습니다.</p>}

          {pwOpen && (
            <form className="mypage-field-edit" onSubmit={handlePwSubmit}>
              <input
                className="mypage-text-input"
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
              />
              <input
                className="mypage-text-input"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="새 비밀번호"
                autoComplete="new-password"
              />
              <input
                className="mypage-text-input"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
              />
              <p className="mypage-hint">
                비밀번호는 8자 이상이며 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.
              </p>
              {pwError && <p className="mypage-error">{pwError}</p>}
              <div className="mypage-btn-row">
                <button type="submit" className="mypage-btn mypage-btn--primary">변경하기</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 알림 설정 카드 */}
      <div className="mypage-card mypage-card--section">
        <h3 className="mypage-section-title">알림 설정</h3>

        <label className="mypage-toggle-row">
          <span>추천 알림</span>
          <input
            type="checkbox"
            checked={notifyRecommend}
            onChange={(e) => setNotifyRecommend(e.target.checked)}
          />
        </label>
        <label className="mypage-toggle-row">
          <span>이벤트·공지 알림</span>
          <input
            type="checkbox"
            checked={notifyEvent}
            onChange={(e) => setNotifyEvent(e.target.checked)}
          />
        </label>
      </div>

      {/* 계정 관리 카드 */}
      <div className="mypage-card mypage-card--section">
        <h3 className="mypage-section-title">계정 관리</h3>
        <button className="mypage-withdraw-btn" onClick={() => setWithdrawOpen(true)}>
          계정 탈퇴
        </button>
      </div>

      {/* 탈퇴 확인 모달 */}
      {withdrawOpen && (
        <div className="mypage-modal-overlay" onClick={() => setWithdrawOpen(false)}>
          <div className="mypage-modal" onClick={(e) => e.stopPropagation()}>
            <p className="mypage-modal-title">정말 탈퇴하시겠습니까?</p>
            <p className="mypage-modal-desc">
              탈퇴 시 모든 서재·문장 기록이 삭제되며 복구할 수 없습니다.
            </p>
            <div className="mypage-btn-row mypage-btn-row--center">
              <button className="mypage-btn mypage-btn--danger" onClick={handleWithdraw}>탈퇴</button>
              <button className="mypage-btn mypage-btn--ghost" onClick={() => setWithdrawOpen(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
