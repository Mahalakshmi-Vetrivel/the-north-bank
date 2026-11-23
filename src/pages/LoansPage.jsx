import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Chip, LinearProgress, MenuItem, Slider, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useBank } from '../bank/BankContext';
import { toPaise } from '../amount';
import { nbApi } from '../nbapi';
import { emiMinor, LOAN_RATE_PERCENT } from '../loan';
import { EmptyState, PageHeader } from '../components/common';
import { money, time } from '../format';

const color = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' };

export default function LoansPage() {
  const { data, session, loaded } = useBank();
  const accounts = data.accounts.filter(item => item.status === 'ACTIVE');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState(12);
  const [purpose, setPurpose] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = accounts.some(item => item.accountId === accountId) ? accountId : (accounts[0]?.accountId || '');
  const amountMinor = toPaise(amount);
  const emi = amountMinor && amountMinor >= 100_000 ? emiMinor(amountMinor, months) : null;

  const load = useCallback(() => {
    nbApi('/me/loans', { token: session.token }).then(value => { setRows(value.rows); setError(''); })
      .catch(failure => { setRows([]); setError(failure.message); });
  }, [session.token]);
  useEffect(load, [load]);

  async function apply(event) {
    event.preventDefault();
    setError(''); setNotice('');
    if (!chosen) return setError('You have no active account.');
    if (amountMinor === null || amountMinor < 100_000 || amountMinor > 50_000_000) return setError('Enter an amount between ₹1,000 and ₹5,00,000.');
    setBusy(true);
    try {
      await nbApi('/me/loans', { token: session.token, data: { accountId: chosen, amountMinor, tenureMonths: months, purpose } });
      setNotice('Application sent. The bank will review it; you will get an email with the decision.');
      setAmount(''); setPurpose(''); load();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Loans" subtitle={'Demo loans at ' + LOAN_RATE_PERCENT + '% a year. Approval is a decision only: no money is credited in this demo.'} />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Card sx={{ flex: 1, width: '100%', minWidth: 0 }}>
        <CardHeader title="Apply for a loan" />
        <CardContent>
          {!loaded && <Alert severity="info">Loading your accounts…</Alert>}
          {loaded && !accounts.length && <Alert severity="warning">You need an active account to apply.</Alert>}
          {loaded && accounts.length > 0 && <Box component="form" onSubmit={apply} noValidate><Stack spacing={2.5}>
            <TextField select label="Account" value={chosen} onChange={e => setAccountId(e.target.value)}>
              {accounts.map(item => <MenuItem key={item.accountId} value={item.accountId}>{item.accountNumber}</MenuItem>)}
            </TextField>
            <TextField label="Loan amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50000"
              helperText="₹1,000 to ₹5,00,000" slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
            <Box>
              <Typography variant="body2" color="text.secondary">Tenure: {months} months</Typography>
              <Slider value={months} min={3} max={60} step={1} onChange={(_, value) => setMonths(value)} aria-label="Tenure in months" />
            </Box>
            <TextField label="Purpose" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="For example: laptop" />
            {emi && <Alert severity="info">Estimated EMI: <strong>{money(emi)}</strong> a month for {months} months.</Alert>}
            <Box><Button type="submit" variant="contained" disabled={busy}>{busy ? 'Sending…' : 'Apply'}</Button></Box>
          </Stack></Box>}
        </CardContent>
      </Card>
      <Card sx={{ flex: 1.5, width: '100%', minWidth: 0 }}>
        <CardHeader title="Your applications" />
        {!rows ? <LinearProgress /> : !rows.length ? <EmptyState title="No loan applications yet" /> : <TableContainer><Table size="small">
          <TableHead><TableRow><TableCell>Applied</TableCell><TableCell>Amount</TableCell><TableCell>EMI</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>{rows.map(row => <TableRow key={row.loanId}>
            <TableCell>{time(row.createdAt)}<Typography variant="caption" component="p" color="text.secondary">{row.loanId}</Typography></TableCell>
            <TableCell>{money(row.amountMinor)}<Typography variant="caption" component="p" color="text.secondary">{row.tenureMonths} months</Typography></TableCell>
            <TableCell>{money(row.emiMinor)}</TableCell>
            <TableCell><Chip size="small" label={row.status} color={color[row.status] || 'default'} variant={row.status === 'APPROVED' ? 'filled' : 'outlined'} />
              {row.reason && <Typography variant="caption" component="p" color="text.secondary">{row.reason}</Typography>}</TableCell>
          </TableRow>)}</TableBody></Table></TableContainer>}
      </Card>
    </Stack>
  </>;
}
