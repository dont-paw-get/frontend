import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Gnb from './components/Gnb';
import { BooksProvider } from './store/BooksProvider';
import { ThemeProvider } from './store/ThemeProvider';
import MyLibrary from './pages/MyLibrary';
import RegisterBook from './pages/RegisterBook';
import MyPage from './pages/MyPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

function AppLayout() {
  return (
    <>
      <Gnb />
      <Routes>
        <Route path="/library" element={<MyLibrary />} />
        <Route path="/register" element={<RegisterBook />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>
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
