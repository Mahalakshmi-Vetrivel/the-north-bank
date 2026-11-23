import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { nbApi } from '../nbapi';
import { PageHeader } from '../components/common';

const copy = {
  PENDING: { severity: 'info', title: 'Pending approval', text: 'The bank is reviewing your application.' },
  HELD: { severity: 'warning', title: 'On hold', text: 'The bank needs something more from you.' },
  APPROVED: { severity: 'success', title: 'Approved', text: 'Your account is open. Sign in with your email and password.' },
  REJECTED: { severity: 'error', title: 'Not approved', text: 'The bank could not approve this application.' },
};

export default function StatusPage() {
  const [params] = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') || '');
  const [email, setEmail] = useState(params.get('email') || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup(event) {
    event.preventDefault();
    setError(''); setResult(null);
    if (!ref.trim() || !email.trim()) { setError('Enter your reference number and email.'); return; }
    setBusy(true);
    try { setResult(await nbApi(`/applications/${encodeURIComponent(ref.trim())}/status?email=${encodeURIComponent(email.trim())}`)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const info = result && (copy[result.status] || copy.PENDING);

  return <>
    <PageHeader title="Application status" subtitle="Use the reference number you received when you applied." />
    <Card><CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
      <Box component="form" onSubmit={lookup}>
        <Stack spacing={2.5}>
          <TextField label="Reference number" value={ref} onChange={e => setRef(e.target.value)} placeholder="APP-…" />
          <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          {error && <Alert severity="error">{error}</Alert>}
          <Box><Button type="submit" variant="contained" disabled={busy}>{busy ? 'Checking…' : 'Check status'}</Button></Box>
        </Stack>
      </Box>
      {info && <Alert severity={info.severity} sx={{ mt: 3 }}>
        <Typography sx={{ fontWeight: 700 }}>{info.title}</Typography>
        <Typography variant="body2">{info.text}</Typography>
        {result.reason && <Typography variant="body2" sx={{ mt: 0.5 }}>Reason: {result.reason}</Typography>}
        {result.accountNumber && <Typography variant="body2" sx={{ mt: 0.5 }}>Account number: <strong>{result.accountNumber}</strong></Typography>}
      </Alert>}
      {result?.status === 'APPROVED' && <Button component={RouterLink} to="/login" variant="contained" sx={{ mt: 2 }}>Sign in</Button>}
    </CardContent></Card>
  </>;
}
