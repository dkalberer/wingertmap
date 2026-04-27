import { useState, FormEvent } from 'react'
import { TextField, Button, Alert, Box } from '@mui/material'
import { useAuthStore } from '../../store/authStore'

interface Props {
  onSuccess: () => void
}

export default function RegisterForm({ onSuccess }: Props) {
  const register = useAuthStore((s) => s.register)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({ email, name, password })
      onSuccess()
    } catch {
      setError('Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      <TextField
        id="name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <TextField
        id="reg-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <TextField
        id="reg-password"
        label="Passwort"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
      />
      <Button type="submit" loading={loading} fullWidth>
        {loading ? 'Registrieren...' : 'Registrieren'}
      </Button>
    </Box>
  )
}
