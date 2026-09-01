import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, deleteMe, logout, ApiError } from '../api/authApi';
import { useAuth } from '../store/authStore';
import './MyPage.css';

// 회원이 프로필 사진을 올리지 않았을 때 쓰는 기본 아바타 (고양이 사서 프로필 이미지 재사용)
const DEFAULT_PROFILE_IMAGE = '/profile/cat.webp';
// 백엔드 gender(MALE/FEMALE) → 화면 표시용 한글
const GENDER_LABEL = { MALE: '남성', FEMALE: '여성' };

// 8자 이상, 영문 대/소문자·숫자·특수문자 포함
const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const MENU_ITEMS = [
  { id: 'info', label: '내 정보' },
  { id: 'manage', label: '계정 관리' },
  { id: 'notify', label: '알림 설정' },
];

export default function MyPage() {
  const navigate = useNavigate();
  const { member } = useAuth();

  // member는 로그인 시점에 GET /users/me 응답으로 채워짐 (AuthProvider)
  const profileImage = member?.profile_image_url || DEFAULT_PROFILE_IMAGE;
  const email = member?.email ?? '';
  const birthDate = member?.birth_date ?? '';
  const gender = GENDER_LABEL[member?.gender] ?? '';

  // 마이페이지 진입 시 기본으로 '내 정보'만 보이도록, 왼쪽 메뉴로 섹션 전환
  const [activeTab, setActiveTab] = useState('info');

  // ── 비밀번호 ──
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // ── 알림 설정 ──
  const [notifyRecommend, setNotifyRecommend] = useState(true);
  const [notifyEvent, setNotifyEvent] = useState(false);

  // ── 계정 탈퇴 ──
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // 비밀번호 변경 (로그인 상태)
  const handlePwSubmit = async (e) => {
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
    setPwLoading(true);
    setPwError('');
    try {
      await changePassword({ currentPassword: curPw, newPassword: newPw });
      setPwSuccess(true);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      setPwOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setPwError('현재 비밀번호가 올바르지 않습니다.');
        } else if (err.status === 400) {
          setPwError(err.message || '비밀번호 정책에 맞지 않습니다.');
        } else {
          setPwError('비밀번호 변경 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
        }
      } else {
        setPwError('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setPwLoading(false);
    }
  };

  // 계정 탈퇴: DELETE /users/me 후 쿠키 정리를 위해 logout 호출 → 로그인 화면
  const handleWithdraw = async () => {
    if (withdrawLoading) return;
    setWithdrawLoading(true);
    try {
      await deleteMe();
      await logout(); // refresh_token/refresh_sub 쿠키 정리 + 메모리 토큰 제거
      navigate('/login');
    } catch {
      // 탈퇴 실패 시에도 안전하게 로그아웃 처리 후 로그인 화면으로
      try { await logout(); } catch { /* 무시 */ }
      navigate('/login');
    } finally {
      setWithdrawLoading(false);
      setWithdrawOpen(false);
    }
  };

  return (
    <section className="mypage">
      <div className="mypage-layout">
        {/* 왼쪽 메뉴바 */}
        <nav className="mypage-sidebar" aria-label="마이페이지 메뉴">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`mypage-sidebar-item${activeTab === item.id ? ' mypage-sidebar-item--active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* 오른쪽 콘텐츠 */}
        <div className="mypage-content">
          {/* 내 정보 */}
          {activeTab === 'info' && (
            <div className="mypage-card">
              <div className="mypage-avatar-wrap">
                <img
                  className="mypage-avatar"
                  src={profileImage}
                  alt="프로필 사진"
                  width={97}
                  height={102}
                  decoding="async"
                />
              </div>

              <dl className="mypage-info">
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
          )}

          {/* 알림 설정 */}
          {activeTab === 'notify' && (
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
          )}

          {/* 계정 관리: 이메일/비밀번호 설정 + 탈퇴(마지막 줄) */}
          {activeTab === 'manage' && (
            <div className="mypage-card mypage-card--section">
              <h3 className="mypage-section-title">계정 관리</h3>

              {/* 이메일 (변경 불가 — 읽기 전용), 라벨과 값을 한 줄에 표시 */}
              <div className="mypage-field mypage-field--row">
                <span className="mypage-field-label">이메일</span>
                <span className="mypage-field-value">{email}</span>
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
                      <button type="submit" className="mypage-btn mypage-btn--primary" disabled={pwLoading}>
                        {pwLoading ? '변경 중...' : '변경하기'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* 계정 탈퇴 (마지막 줄, 버튼은 오른쪽) */}
              <div className="mypage-field mypage-field--row">
                <span className="mypage-field-label">계정 탈퇴</span>
                <button className="mypage-withdraw-btn" onClick={() => setWithdrawOpen(true)}>
                  탈퇴하기
                </button>
              </div>
            </div>
          )}
        </div>
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
              <button className="mypage-btn mypage-btn--danger" onClick={handleWithdraw} disabled={withdrawLoading}>
                {withdrawLoading ? '처리 중...' : '탈퇴'}
              </button>
              <button className="mypage-btn mypage-btn--ghost" onClick={() => setWithdrawOpen(false)} disabled={withdrawLoading}>취소</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
