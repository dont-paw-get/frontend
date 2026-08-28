import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Gnb from './components/Gnb';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './store/AuthProvider';
import { BooksProvider } from './store/BooksProvider';
import { ThemeProvider } from './store/ThemeProvider';
import { LibrarianProvider } from './store/LibrarianProvider';
import MyLibrary from './pages/MyLibrary';
import RegisterBook from './pages/RegisterBook';
import MyPage from './pages/MyPage';
import LibrarianProfiles from './pages/LibrarianProfiles';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PasswordReset from './pages/PasswordReset';

// 로그인 필요한 화면들 — ProtectedRoute로 감싸 비로그인 시 /login으로 유도
function AppLayout() {
  return (
    <ProtectedRoute>
      <Gnb />
      <Routes>
        <Route path="/library" element={<MyLibrary />} />
        <Route path="/register" element={<RegisterBook />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/librarians" element={<LibrarianProfiles />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LibrarianProvider>
          <BooksProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/password/forgot" element={<PasswordReset />} />
                <Route path="/*" element={<AppLayout />} />
              </Routes>
            </BrowserRouter>
          </BooksProvider>
        </LibrarianProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
