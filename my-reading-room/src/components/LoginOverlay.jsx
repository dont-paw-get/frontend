export default function LoginOverlay({ show }) {
    if (!show) return null;

    return (
        <div className="login-overlay show">
            <img src="/shelves/login.png" alt="로그인 페이지" />
            <div className="login-inputs">
                <input type="text" className="login-field" placeholder="이메일 입력" />
                <input type="password" className="login-field" placeholder="비밀번호 입력" />
            </div>
        </div>
    );
}