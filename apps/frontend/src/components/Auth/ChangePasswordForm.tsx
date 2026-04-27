import { useState, FormEvent } from 'react'
import { TextField, Button, Alert, Box } from '@mui/material'
import { changePassword } from '../../api/auth'

interface Props {
  onSuccess: () => void
}

export default function ChangePasswordForm({ onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) {
      setError('Neue Passwörter stimmen nicht überein.')
      return
    }
    if (newPassword.length < 8) {
      setError('Neues Passwort muss mindestens 8 Zeichen haben.')
      return
    }
    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      onSuccess()
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Fehler beim Ändern des Passworts.'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Aktuelles Passwort"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <TextField
        label="Neues Passwort"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        autoComplete="new-password"
      />
      <TextField
        label="Neues Passwort bestätigen"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />
      <Button type="submit" loading={loading} fullWidth>
        Passwort ändern
      </Button>
    </Box>
  )
}
