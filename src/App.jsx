import { useMemo, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { BankProvider, useBank } from './bank/BankContext';
import { buildTheme } from './theme';
import { readStorage, saveStorage } from './live-api';
import AppShell from './layout/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransferPage from './pages/TransferPage';
import HistoryPage from './pages/HistoryPage';
import PortfolioPage from './pages/PortfolioPage';
import PayeesPage from './pages/PayeesPage';
import LoansPage from './pages/LoansPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicLayout from './layout/PublicLayout';
import RegisterPage from './pages/RegisterPage';
import StatusPage from './pages/StatusPage';
import AdminPage from './pages/AdminPage';

// Signed-out users are sent to /login and returned to the page they wanted afterwards.
function RequireSession({ children }) {
  const { session } = useBank();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App({ bank, switchUrl }) {
  const [mode, setMode] = useState(() => readStorage(localStorage, 'nb-color-mode', 'light') === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(mode), [mode]);
  function toggleMode() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    saveStorage(localStorage, 'nb-color-mode', next);
  }

  // HashRouter keeps routes working on GitHub Pages (no server-side rewrites there).
  return <ThemeProvider theme={theme}>
    <CssBaseline />
    <BankProvider bank={bank}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Pages that need no customer sign-in (they talk to the bank's own backend, not the Worker) */}
          <Route element={<PublicLayout />}>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/status" element={<StatusPage />} />
          </Route>
          <Route element={<PublicLayout wide />}><Route path="/admin" element={<AdminPage />} /></Route>
          <Route element={<RequireSession><AppShell switchUrl={switchUrl} mode={mode} toggleMode={toggleMode} /></RequireSession>}>
            <Route index element={<DashboardPage />} />
            <Route path="transfer" element={<TransferPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="payees" element={<PayeesPage />} />
            <Route path="loans" element={<LoansPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </BankProvider>
  </ThemeProvider>;
}
