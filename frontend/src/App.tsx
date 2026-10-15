import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { AuthPageLayout } from './components/AuthPageLayout'
import { DialogProvider } from './components/DialogProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AnimeDetailPage } from './pages/AnimeDetailPage'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { SearchPage } from './pages/SearchPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DialogProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AuthPageLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<LibraryPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/anime/:anilistId" element={<AnimeDetailPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </DialogProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
