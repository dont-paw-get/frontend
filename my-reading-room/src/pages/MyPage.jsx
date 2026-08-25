import { useState } from 'react';
import './MyPage.css';

// 임시 mock 데이터 (추후 API 연동 시 교체)
const mockUser = {
  profileImage: '/profile.png',
  nickname: 'pawget_reader',
  email: 'reader@dontpawget.com',
  birthDate: '1995-03-12',
  gender: '남성',
};

export default function MyPage() {
  const { profileImage, email, birthDate, gender } = mockUser;
  const [nickname, setNickname] = useState(mockUser.nickname);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);

  const handleEdit = () => {
    setDraft(nickname);
    setEditing(true);
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      setNickname(trimmed);
      // TODO: 실제 API 호출로 닉네임 저장
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <section className="mypage">
      <h2 className="mypage-heading">마이페이지</h2>

      <div className="mypage-card">
        {/* 프로필 이미지 */}
        <div className="mypage-avatar-wrap">
          <img
            className="mypage-avatar"
            src={profileImage}
            alt={`${nickname} 프로필 사진`}
          />
        </div>

        {/* 프로필 정보 */}
        <dl className="mypage-info">
          <div className="mypage-info-row">
            <dt>닉네임</dt>
            <dd className="mypage-nickname-cell">
              {editing ? (
                <div className="mypage-nickname-edit">
                  <input
                    className="mypage-nickname-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                  <button className="mypage-nickname-save" onClick={handleSave}>저장</button>
                  <button className="mypage-nickname-cancel" onClick={handleCancel}>취소</button>
                </div>
              ) : (
                <div className="mypage-nickname-display">
                  <span>{nickname}</span>
                  <button className="mypage-nickname-edit-btn" onClick={handleEdit}>수정</button>
                </div>
              )}
            </dd>
          </div>
          <div className="mypage-info-row">
            <dt>이메일</dt>
            <dd>{email}</dd>
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
    </section>
  );
}
