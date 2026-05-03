import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { useAuthStore } from './store/authStore'
import LoginForm from './components/Auth/LoginForm'
import MainLayout from './components/Layout/MainLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function AuthPage() {
  const navigate = useNavigate()
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ bgcolor: 'background.paper', p: 4, borderRadius: 2, boxShadow: 3, width: '100%', maxWidth: 400 }}>
        <Typography variant="h4" color="primary" gutterBottom>Wingertmap</Typography>
        <LoginForm onSuccess={() => navigate('/')} />
      </Box>
    </Box>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/*" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
