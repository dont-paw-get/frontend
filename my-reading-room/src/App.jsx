import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Gnb from './components/Gnb';
import { BooksProvider } from './store/BooksProvider';
import { ThemeProvider } from './store/ThemeProvider';
import MyLibrary from './pages/MyLibrary';
import RegisterBook from './pages/RegisterBook';
import MyPage from './pages/MyPage';

function App() {
  return (
    <ThemeProvider>
      <BooksProvider>
        <BrowserRouter>
          <Gnb />

          <Routes>
            <Route path="/" element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<MyLibrary />} />
            <Route path="/register" element={<RegisterBook />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="*" element={<Navigate to="/library" replace />} />
          </Routes>
        </BrowserRouter>
      </BooksProvider>
    </ThemeProvider>
  );
}

export default App;
