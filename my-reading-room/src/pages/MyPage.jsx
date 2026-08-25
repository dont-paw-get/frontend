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
  const { profileImage, nickname, email, birthDate, gender } = mockUser;

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
            <dd>{nickname}</dd>
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
