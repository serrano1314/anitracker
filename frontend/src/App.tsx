import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { DialogProvider } from './components/DialogProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AnimeDetailPage } from './pages/AnimeDetailPage'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { SearchPage } from './pages/SearchPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DialogProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<LibraryPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/anime/:anilistId" element={<AnimeDetailPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </DialogProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
