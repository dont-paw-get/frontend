import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Gnb from './components/Gnb';
import { BooksProvider } from './store/BooksProvider';
import { ThemeProvider } from './store/ThemeProvider';
import MyLibrary from './pages/MyLibrary';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// 방문 빈도가 낮고 무거운 페이지는 필요 시점에 로드 (RegisterBook은 OCR 청크를 끌어옴)
const RegisterBook = lazy(() => import('./pages/RegisterBook'));
const MyPage = lazy(() => import('./pages/MyPage'));

const routeFallback = <div style={{ padding: 40, textAlign: 'center' }}>불러오는 중…</div>;

function AppLayout() {
  return (
    <>
      <Gnb />
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/library" element={<MyLibrary />} />
          <Route path="/register" element={<RegisterBook />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BooksProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </BrowserRouter>
      </BooksProvider>
    </ThemeProvider>
  );
}

export default App;
