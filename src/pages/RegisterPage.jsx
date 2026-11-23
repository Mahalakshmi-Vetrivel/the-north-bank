import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Link, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadIcon from '@mui/icons-material/UploadFileOutlined';
import { nbApi } from '../nbapi';
import { PageHeader } from '../components/common';

const idTypes = [['AADHAAR', 'Aadhaar'], ['PAN', 'PAN card'], ['PASSPORT', 'Passport'], ['VOTER_ID', 'Voter ID'], ['DRIVING_LICENSE', 'Driving licence']];
const empty = { fullName: '', email: '', password: '', phone: '', dob: '', address: '', idType: 'PAN' };

export default function RegisterPage() {
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = key => event => setForm({ ...form, [key]: event.target.value });

  function check() {
    const next = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    if (!/^\d{10}$/.test(form.phone.replace(/[\s-]/g, ''))) next.phone = 'Enter a 10-digit mobile number.';
    if (!form.dob) next.dob = 'Enter your date of birth.';
    else if ((Date.now() - Date.parse(form.dob)) / (365.25 * 864e5) < 18) next.dob = 'You must be at least 18.';
    if (form.address.trim().length < 5) next.address = 'Enter your address.';
    if (!files.length) next.files = 'Attach at least one document.';
    setErrors(next);
    return !Object.keys(next).length;
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!check()) return;
    setBusy(true);
    try {
      const result = await nbApi('/register', { data: { ...form, documentNames: files.map(file => file.name) } });
      setDone({ ...result, email: form.email.trim() });
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  if (done) return <Card><CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
    <CheckCircleIcon color="success" sx={{ fontSize: 56 }} />
    <Typography variant="h5" sx={{ mt: 1 }}>Application received</Typography>
    <Typography color="text.secondary" sx={{ mt: 1 }}>Your application is <strong>pending approval</strong>. We will email {done.email} when the bank decides.</Typography>
    <Typography sx={{ mt: 3 }} color="text.secondary">Your reference number</Typography>
    <Typography variant="h5" component="p" sx={{ fontWeight: 800, letterSpacing: '.04em' }}>{done.applicationId}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Keep this number: you need it, with your email, to check the status.</Typography>
    <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'center' }}>
      <Button variant="contained" component={RouterLink} to={`/status?ref=${encodeURIComponent(done.applicationId)}&email=${encodeURIComponent(done.email)}`}>Check status</Button>
      <Button component={RouterLink} to="/login">Customer sign in</Button>
    </Stack>
  </CardContent></Card>;

  return <>
    <PageHeader title="Open an account" subtitle="An opening balance of ₹1,000 is credited once your application is approved." />
    <Card><CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
      <Box component="form" onSubmit={submit} noValidate>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Full name" value={form.fullName} onChange={set('fullName')} error={!!errors.fullName} helperText={errors.fullName} disabled={busy} required />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
            <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={!!errors.email} helperText={errors.email || 'You will sign in with this email'} disabled={busy} required />
            <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={!!errors.password} helperText={errors.password || 'At least 8 characters'} disabled={busy} required />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
            <TextField label="Mobile number" inputMode="numeric" value={form.phone} onChange={set('phone')} error={!!errors.phone} helperText={errors.phone} disabled={busy} required />
            <TextField label="Date of birth" type="date" value={form.dob} onChange={set('dob')} error={!!errors.dob} helperText={errors.dob}
              slotProps={{ inputLabel: { shrink: true } }} disabled={busy} required />
          </Stack>
          <TextField label="Address" multiline rows={3} value={form.address} onChange={set('address')} error={!!errors.address} helperText={errors.address} disabled={busy} required />
          <TextField select label="ID proof type" value={form.idType} onChange={set('idType')} disabled={busy}>
            {idTypes.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <Box>
            <Button component="label" variant="outlined" startIcon={<UploadIcon />} disabled={busy}>
              Attach documents
              <input hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={event => setFiles([...event.target.files].slice(0, 5))} />
            </Button>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
              {files.map(file => <Chip key={file.name} label={file.name} size="small" />)}
            </Stack>
            <Typography variant="caption" color={errors.files ? 'error' : 'text.secondary'} sx={{ display: 'block', mt: 0.5 }}>
              {errors.files || 'Demo note: only the file names are recorded for the reviewer; the files are not uploaded.'}
            </Typography>
          </Box>
          <Alert severity="info" icon={false}>Opening balance: <strong>₹1,000.00</strong> (demo credit, added once after approval).</Alert>
          <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Button>
          <Typography variant="body2" color="text.secondary">Already applied? <Link component={RouterLink} to="/status">Check your status</Link></Typography>
        </Stack>
      </Box>
    </CardContent></Card>
  </>;
}
