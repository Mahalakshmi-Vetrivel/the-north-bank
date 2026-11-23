import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, InputAdornment,
  LinearProgress, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  Tabs, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { nbApi } from '../nbapi';
import { readStorage, saveStorage } from '../live-api';
import { EmptyState, PageHeader } from '../components/common';
import { money, time } from '../format';

const tokenKey = 'nb-admin-token';
const statusColor = { PENDING: 'warning', HELD: 'info', APPROVED: 'success', REJECTED: 'error' };
const StatusPill = ({ status }) => <Chip size="small" label={status} color={statusColor[status] || 'default'} variant={status === 'APPROVED' ? 'filled' : 'outlined'} />;

function AdminLogin({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError(''); setBusy(true);
    try { onSignedIn(await nbApi('/admin/login', { data: { email, password } })); }
    catch (failure) { setError(failure.message); }
    finally { setPassword(''); setBusy(false); }
  }
  return <Card sx={{ maxWidth: 440, mx: 'auto', mt: 4 }}><CardContent sx={{ p: 4 }}>
    <Typography variant="h5">Bank staff sign in</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Administrator access only.</Typography>
    <Box component="form" onSubmit={submit}><Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Admin email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
      <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    </Stack></Box>
  </CardContent></Card>;
}

function Overview({ token, onAuthError }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    nbApi('/admin/summary', { token }).then(setData).catch(failure => { if (failure.status === 401) onAuthError(); else setError(failure.message); });
  }, [token, onAuthError]);
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <LinearProgress />;
  const { applications: a } = data;
  const cards = [['Customers with accounts', data.customers], ['Total deposits', money(data.totalDepositsMinor)], ['Pending KYC', a.pending],
    ['Held', a.held], ['Approved', a.approved], ['Rejected', a.rejected]];
  return <Stack spacing={3}>
    <Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 6, md: 4 }}>
      <Card><CardContent><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h5" component="p" sx={{ mt: 0.5 }}>{value}</Typography></CardContent></Card>
    </Grid>)}</Grid>
    <Card><CardContent>
      <Typography variant="h6" sx={{ mb: 2 }}>Applications by status</Typography>
      <Stack spacing={1.5}>{[['Pending', a.pending, 'warning'], ['Held', a.held, 'info'], ['Approved', a.approved, 'success'], ['Rejected', a.rejected, 'error']].map(([label, value, color]) =>
        <Box key={label}><Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="body2">{label}</Typography><Typography variant="body2">{value}</Typography></Stack>
          <LinearProgress variant="determinate" color={color} value={a.total ? (value / a.total) * 100 : 0} sx={{ height: 8, borderRadius: 4 }} /></Box>)}</Stack>
    </CardContent></Card>
    <Card><CardContent>
      <Typography variant="h6" sx={{ mb: 1 }}>Recent applications</Typography>
      {data.recent.length ? data.recent.map(row => <Stack key={row.applicationId} direction="row" sx={{ justifyContent: 'space-between', py: 1, borderTop: 1, borderColor: 'divider' }}>
        <Box><Typography sx={{ fontWeight: 650 }}>{row.fullName}</Typography><Typography variant="caption" color="text.secondary">{row.applicationId} · {time(row.createdAt)}</Typography></Box>
        <StatusPill status={row.status} /></Stack>) : <EmptyState title="No applications yet" />}
    </CardContent></Card>
  </Stack>;
}

function DecisionDialog({ row, token, onClose, onDone, onAuthError }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const open = Boolean(row);
  const decided = row && ['APPROVED', 'REJECTED'].includes(row.status);
  async function decide(decision) {
    setError('');
    if (decision !== 'APPROVE' && reason.trim().length < 3) { setError('Enter a reason for holding or rejecting.'); return; }
    setBusy(decision);
    try { await nbApi('/admin/applications/' + row.applicationId, { method: 'PATCH', token, data: { decision, reason } }); setReason(''); onDone(`${row.fullName}: ${decision.toLowerCase()} recorded.`); }
    catch (failure) { if (failure.status === 401) onAuthError(); else setError(failure.message); }
    finally { setBusy(''); }
  }
  const line = (label, value) => <Stack direction="row" sx={{ justifyContent: 'space-between', py: 0.75 }} spacing={2}>
    <Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' }}>{value || '—'}</Typography></Stack>;
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
    {row && <><DialogTitle>{row.fullName} <StatusPill status={row.status} /></DialogTitle>
      <DialogContent dividers>
        {line('Reference', row.applicationId)}{line('Email', row.email)}{line('Mobile', row.phone)}{line('Date of birth', row.dob)}
        {line('Address', row.address)}{line('ID proof type', row.idType)}{line('Documents (names)', row.documentNames?.join(', '))}
        {line('Opening deposit', money(row.openingDepositMinor))}{line('Applied', time(row.createdAt))}
        {row.accountNumber && line('Account', row.accountNumber)}{row.reason && line('Reason', row.reason)}{row.reviewedBy && line('Reviewed by', row.reviewedBy)}
        {!decided && <TextField label="Reason (needed for Hold and Reject)" value={reason} onChange={e => setReason(e.target.value)} sx={{ mt: 2 }} />}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={Boolean(busy)}>Close</Button>
        {!decided && <>
          <Button color="error" onClick={() => decide('REJECT')} disabled={Boolean(busy)}>{busy === 'REJECT' ? 'Rejecting…' : 'Reject'}</Button>
          {row.status === 'PENDING' && <Button color="warning" onClick={() => decide('HOLD')} disabled={Boolean(busy)}>{busy === 'HOLD' ? 'Holding…' : 'Hold'}</Button>}
          <Button variant="contained" color="success" onClick={() => decide('APPROVE')} disabled={Boolean(busy)}>{busy === 'APPROVE' ? 'Approving…' : 'Approve'}</Button>
        </>}
      </DialogActions></>}
  </Dialog>;
}

function Applications({ token, onAuthError, notify }) {
  const [status, setStatus] = useState('PENDING');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const load = useCallback(() => {
    nbApi(`/admin/applications?status=${status}&q=${encodeURIComponent(q)}&page=${page}&size=${size}`, { token })
      .then(value => { setData(value); setError(''); })
      .catch(failure => { if (failure.status === 401) onAuthError(); else setError(failure.message); });
  }, [token, status, q, page, size, onAuthError]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  return <Card>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 2 }}>
      <TextField size="small" placeholder="Search name, email, reference" value={q} onChange={e => { setQ(e.target.value); setPage(0); }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
      <TextField size="small" select label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 160 }}>
        {['ALL', 'PENDING', 'HELD', 'APPROVED', 'REJECTED'].map(value => <MenuItem key={value} value={value}>{value === 'ALL' ? 'All statuses' : value}</MenuItem>)}
      </TextField>
    </Stack>
    {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
    {!data ? <LinearProgress /> : !data.rows.length ? <EmptyState title="No applications match" text="Try another status or search." /> : <>
      <TableContainer><Table size="small">
        <TableHead><TableRow><TableCell>Applicant</TableCell><TableCell>Reference</TableCell><TableCell>Applied (IST)</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>{data.rows.map(row => <TableRow key={row.applicationId} hover>
          <TableCell><Typography sx={{ fontWeight: 650 }}>{row.fullName}</Typography><Typography variant="caption" color="text.secondary">{row.email}</Typography></TableCell>
          <TableCell>{row.applicationId}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{time(row.createdAt)}</TableCell>
          <TableCell><StatusPill status={row.status} /></TableCell>
          <TableCell align="right"><Button size="small" onClick={() => setOpen(row)}>Review</Button></TableCell>
        </TableRow>)}</TableBody></Table></TableContainer>
      <TablePagination component="div" count={data.total} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={size}
        onRowsPerPageChange={e => { setSize(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} />
    </>}
    <DecisionDialog row={open} token={token} onAuthError={onAuthError} onClose={() => setOpen(null)} onDone={message => { setOpen(null); notify(message); load(); }} />
  </Card>;
}

function Limits({ token, onAuthError, notify }) {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [per, setPer] = useState('');
  const [daily, setDaily] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => {
    nbApi('/admin/accounts', { token }).then(value => setRows(value.rows)).catch(failure => { if (failure.status === 401) onAuthError(); else setError(failure.message); });
  }, [token, onAuthError]);
  useEffect(load, [load]);
  const rupees = minor => (minor ? String(minor / 100) : '');
  async function save() {
    setError('');
    const perMinor = Math.round(Number(per) * 100);
    const dailyMinor = Math.round(Number(daily) * 100);
    if (!(perMinor > 0) || !(dailyMinor > 0)) { setError('Enter both limits as positive rupee amounts.'); return; }
    try { await nbApi('/admin/limits/' + edit.accountId, { method: 'PATCH', token, data: { perTransferMinor: perMinor, dailyMinor } }); setEdit(null); notify('Limits saved for ' + edit.accountNumber); load(); }
    catch (failure) { setError(failure.message); }
  }
  return <Card>
    {error && !edit && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
    {!rows ? <LinearProgress /> : !rows.length ? <EmptyState title="No accounts yet" /> :
      <TableContainer><Table size="small">
        <TableHead><TableRow><TableCell>Account</TableCell><TableCell align="right">Balance</TableCell><TableCell align="right">Per transfer</TableCell><TableCell align="right">Daily</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>{rows.map(row => <TableRow key={row.accountId} hover>
          <TableCell><Typography sx={{ fontWeight: 650 }}>{row.accountNumber}</Typography><Typography variant="caption" color="text.secondary">{row.accountId}</Typography></TableCell>
          <TableCell align="right">{money(row.postedBalanceMinor)}</TableCell>
          <TableCell align="right">{row.perTransferMinor ? money(row.perTransferMinor) : 'Not set'}</TableCell>
          <TableCell align="right">{row.dailyMinor ? money(row.dailyMinor) : 'Not set'}</TableCell>
          <TableCell align="right"><Button size="small" onClick={() => { setEdit(row); setPer(rupees(row.perTransferMinor)); setDaily(rupees(row.dailyMinor)); setError(''); }}>Set limits</Button></TableCell>
        </TableRow>)}</TableBody></Table></TableContainer>}
    <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} fullWidth maxWidth="xs">
      <DialogTitle>Transfer limits · {edit?.accountNumber}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Per-transfer limit (₹)" value={per} onChange={e => setPer(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        <TextField label="Daily limit (₹)" value={daily} onChange={e => setDaily(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        {error && <Alert severity="error">{error}</Alert>}
      </Stack></DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></DialogActions>
    </Dialog>
  </Card>;
}

function Activity({ token, onAuthError }) {
  const [mail, setMail] = useState(null);
  const [audit, setAudit] = useState(null);
  useEffect(() => {
    const fail = failure => { if (failure.status === 401) onAuthError(); };
    nbApi('/admin/outbox', { token }).then(value => setMail(value.rows)).catch(fail);
    nbApi('/admin/audit', { token }).then(value => setAudit(value.rows)).catch(fail);
  }, [token, onAuthError]);
  return <Stack spacing={3}>
    <Card><CardContent><Typography variant="h6" sx={{ mb: 1 }}>E-mail notices</Typography>
      {!mail ? <LinearProgress /> : !mail.length ? <EmptyState title="No e-mails yet" /> : mail.map(row => <Box key={row.eventId} sx={{ py: 1.25, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography sx={{ fontWeight: 650 }}>{row.subject}</Typography>
          <Chip size="small" label={row.status} color={row.status === 'SENT' ? 'success' : row.status === 'FAILED' ? 'error' : 'default'} /></Stack>
        <Typography variant="caption" color="text.secondary">To {row.email} · {time(row.createdAt)}{row.status === 'LOGGED' ? ' · logged only (no mail server set up)' : ''}</Typography></Box>)}
    </CardContent></Card>
    <Card><CardContent><Typography variant="h6" sx={{ mb: 1 }}>Audit log</Typography>
      {!audit ? <LinearProgress /> : !audit.length ? <EmptyState title="No admin actions yet" /> : audit.map(row => <Box key={row.logId} sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2">{row.description}</Typography><Typography variant="caption" color="text.secondary">{time(row.at)}</Typography></Box>)}
    </CardContent></Card>
  </Stack>;
}

function LoansAdmin({ token, onAuthError, notify }) {
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(() => {
    nbApi('/admin/loans?status=' + status, { token }).then(value => { setRows(value.rows); setError(''); })
      .catch(failure => { if (failure.status === 401) onAuthError(); else setError(failure.message); });
  }, [token, status, onAuthError]);
  useEffect(load, [load]);
  async function decide(decision) {
    setError('');
    if (decision === 'REJECT' && reason.trim().length < 3) return setError('Enter a reason for rejecting.');
    setBusy(decision);
    try {
      await nbApi('/admin/loans/' + encodeURIComponent(open.loanId), { method: 'PATCH', token, data: { decision, reason } });
      notify('Loan ' + open.loanId + ': ' + decision.toLowerCase() + ' recorded (no money moved).');
      setOpen(null); setReason(''); load();
    } catch (failure) { if (failure.status === 401) onAuthError(); else setError(failure.message); }
    finally { setBusy(''); }
  }
  return <Card>
    <Stack direction="row" sx={{ p: 2 }}>
      <TextField size="small" select label="Status" value={status} onChange={e => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(value => <MenuItem key={value} value={value}>{value === 'ALL' ? 'All statuses' : value}</MenuItem>)}
      </TextField>
    </Stack>
    {error && !open && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
    {!rows ? <LinearProgress /> : !rows.length ? <EmptyState title="No loan applications" text="Try another status." /> : <TableContainer><Table size="small">
      <TableHead><TableRow><TableCell>Applicant</TableCell><TableCell>Amount</TableCell><TableCell>Tenure</TableCell><TableCell>Applied (IST)</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row.loanId} hover>
        <TableCell><Typography sx={{ fontWeight: 650 }}>{row.applicantEmail}</Typography><Typography variant="caption" color="text.secondary">{row.loanId} · {row.accountId}</Typography></TableCell>
        <TableCell>{money(row.amountMinor)}</TableCell><TableCell>{row.tenureMonths} months</TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{time(row.createdAt)}</TableCell><TableCell><StatusPill status={row.status} /></TableCell>
        <TableCell align="right"><Button size="small" onClick={() => { setOpen(row); setReason(''); setError(''); }}>Review</Button></TableCell>
      </TableRow>)}</TableBody></Table></TableContainer>}
    <Dialog open={Boolean(open)} onClose={() => !busy && setOpen(null)} fullWidth maxWidth="sm">
      {open && <><DialogTitle>Loan {open.loanId} <StatusPill status={open.status} /></DialogTitle>
        <DialogContent dividers>
          {[['Applicant', open.applicantEmail], ['Account', open.accountId], ['Amount', money(open.amountMinor)], ['Tenure', open.tenureMonths + ' months'],
            ['Rate', open.interestRatePercent + '% a year (demo)'], ['Estimated EMI', money(open.emiMinor)], ['Purpose', open.purpose]].map(([label, value]) =>
            <Stack key={label} direction="row" sx={{ justifyContent: 'space-between', py: 0.75 }} spacing={2}>
              <Typography color="text.secondary" variant="body2">{label}</Typography><Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{value}</Typography></Stack>)}
          <Alert severity="info" sx={{ mt: 2 }}>Approving records the decision and e-mails the customer. No money is credited to the account.</Alert>
          {open.status === 'PENDING' && <TextField fullWidth label="Reason (needed to reject)" value={reason} onChange={e => setReason(e.target.value)} sx={{ mt: 2 }} />}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(null)} disabled={Boolean(busy)}>Close</Button>
          {open.status === 'PENDING' && <>
            <Button color="error" onClick={() => decide('REJECT')} disabled={Boolean(busy)}>{busy === 'REJECT' ? 'Rejecting…' : 'Reject'}</Button>
            <Button variant="contained" color="success" onClick={() => decide('APPROVE')} disabled={Boolean(busy)}>{busy === 'APPROVE' ? 'Approving…' : 'Approve'}</Button>
          </>}
        </DialogActions></>}
    </Dialog>
  </Card>;
}

export default function AdminPage() {
  const [session, setSession] = useState(() => readStorage(sessionStorage, tokenKey, null));
  const [tab, setTab] = useState('overview');
  const [note, setNote] = useState('');
  const signOut = useCallback(() => { saveStorage(sessionStorage, tokenKey, null); setSession(null); }, []);
  const expired = useCallback(() => { signOut(); }, [signOut]);
  if (!session) return <AdminLogin onSignedIn={value => { saveStorage(sessionStorage, tokenKey, value); setSession(value); }} />;
  const props = { token: session.token, onAuthError: expired, notify: setNote };
  return <>
    <PageHeader title="Bank administration" subtitle={'Signed in as ' + session.email}
      action={<Button variant="outlined" onClick={async () => { try { await nbApi('/admin/logout', { method: 'POST', token: session.token, data: {} }); } catch { /* ignore */ } signOut(); }}>Sign out</Button>} />
    {note && <Alert severity="success" onClose={() => setNote('')} sx={{ mb: 2 }}>{note}</Alert>}
    <Tabs value={tab} onChange={(_, value) => { setTab(value); setNote(''); }} variant="scrollable" sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
      <Tab value="overview" label="Overview" /><Tab value="applications" label="KYC applications" /><Tab value="limits" label="Transfer limits" /><Tab value="loans" label="Loans" /><Tab value="activity" label="Emails & audit" />
    </Tabs>
    {tab === 'overview' && <Overview {...props} />}
    {tab === 'applications' && <Applications {...props} />}
    {tab === 'limits' && <Limits {...props} />}
    {tab === 'loans' && <LoansAdmin {...props} />}
    {tab === 'activity' && <Activity {...props} />}
  </>;
}
