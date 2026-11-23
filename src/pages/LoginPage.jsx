import { useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, IconButton, InputAdornment, Link, Stack, TextField, Typography,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LockIcon from '@mui/icons-material/LockOutlined';
import ShieldIcon from '@mui/icons-material/VerifiedUserOutlined';
import BoltIcon from '@mui/icons-material/BoltOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useBank } from '../bank/BankContext';

const points = [
  { icon: <BoltIcon />, text: 'Send money to any bank in the SharedBank network' },
  { icon: <ShieldIcon />, text: 'Every transfer is protected against double sending' },
  { icon: <LockIcon />, text: 'Balances are changed only by the bank’s servers' },
];

export default function LoginPage() {
  const { bank, session, signIn } = useBank();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (session) return <Navigate to={location.state?.from || '/'} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (failure) {
      setError(failure.message); // show the Worker's own message, as the original portal did
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  return <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, bgcolor: 'background.default' }}>
    <Box sx={{
      display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: 6, color: '#fff',
      background: 'linear-gradient(135deg, #0b1d48 0%, #14306e 55%, #0f8a80 130%)',
    }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <AccountBalanceIcon />
        <Typography sx={{ fontWeight: 800, letterSpacing: '.1em' }}>{bank.wordmark}</Typography>
      </Stack>
      <Box>
        <Typography variant="h3" component="p" sx={{ fontWeight: 780, letterSpacing: '-0.03em', mb: 2 }}>
          Banking that moves<br />across the network.
        </Typography>
        <Stack spacing={1.5}>
          {points.map(item => <Stack key={item.text} direction="row" spacing={1.5} sx={{ alignItems: 'center', opacity: 0.92 }}>
            {item.icon}<Typography>{item.text}</Typography>
          </Stack>)}
        </Stack>
      </Box>
      <Typography variant="body2" sx={{ opacity: 0.7 }}>
        {bank.name} · Bank ID {bank.id} · IFSC {bank.ifsc}
      </Typography>
    </Box>
    <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 2, sm: 4 } }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" component="h1">Sign in</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>Welcome to {bank.name}</Typography>
          <Box component="form" onSubmit={submit} noValidate>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="Email" type="email" autoComplete="username" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
              <TextField label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required
                value={password} onChange={e => setPassword(e.target.value)} disabled={busy}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">
                  <IconButton aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} edge="end">
                    {show ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment> } }} />
              <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
            </Stack>
          </Box>
          <Stack spacing={1} sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              New here? <Link component={RouterLink} to="/register">Open an account</Link> · <Link component={RouterLink} to="/status">Check application status</Link>
            </Typography>
            <Typography variant="body2" color="text.secondary"><Link component={RouterLink} to="/admin">Bank staff sign in</Link></Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  </Box>;
}
