import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Divider, MenuItem, Stack, Step, StepLabel, Stepper, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassIcon from '@mui/icons-material/HourglassTop';
import { useBank } from '../bank/BankContext';
import { toPaise } from '../amount';
import { nbApi } from '../nbapi';
import { PageHeader, StatusChip } from '../components/common';
import { money, reasonText } from '../format';

const steps = ['Details', 'Review', 'Receipt'];

function Row({ label, value }) {
  return <Stack direction="row" sx={{ justifyContent: 'space-between', py: 1.25 }} spacing={2}>
    <Typography color="text.secondary">{label}</Typography>
    <Typography sx={{ fontWeight: 650, textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</Typography>
  </Stack>;
}

export default function TransferPage() {
  const { bank, data, directory, loaded, send } = useBank();
  const [step, setStep] = useState(0);
  const [type, setType] = useState('interbank');
  const [from, setFrom] = useState('');
  const [destination, setDestination] = useState('');
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Same source/route rules as the original form: only ACTIVE own accounts, only ACTIVE other banks.
  const sources = data.accounts.filter(account => account.status === 'ACTIVE');
  const fromId = sources.some(item => item.accountId === from) ? from : (sources[0]?.accountId || '');
  const source = sources.find(item => item.accountId === fromId);
  const routes = useMemo(() => directory.filter(item => item.bankId !== bank.id && item.status === 'ACTIVE'), [directory, bank.id]);
  const route = destination ? (routes.find(item => item.ifsc === destination)?.ifsc || '') : (routes[0]?.ifsc || '');
  const target = type === 'internal' ? bank.ifsc : route;
  const targetName = type === 'internal' ? bank.name : routes.find(item => item.ifsc === route)?.bankName;
  const amountMinor = toPaise(amount);

  // Soft pre-check against the limits the bank admin set. It only BLOCKS a transfer we can prove is over a limit;
  // if the bank's own server is unreachable the transfer is not blocked (the Worker remains the final authority).
  async function overLimit() {
    try {
      const limits = await nbApi('/limits/' + encodeURIComponent(fromId));
      if (limits.perTransferMinor && amountMinor > limits.perTransferMinor) return 'This is above your per-transfer limit of ' + money(limits.perTransferMinor) + '.';
      if (limits.dailyMinor) {
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const today = day.format(new Date());
        const used = data.transfers.filter(row => row.direction !== 'CREDIT' && row.status !== 'REJECTED'
          && day.format(new Date(row.createdAt)) === today).reduce((sum, row) => sum + (Number(row.amountMinor) || 0), 0);
        if (used + amountMinor > limits.dailyMinor) return 'This would go over your daily limit of ' + money(limits.dailyMinor) + ' (already sent today: ' + money(used) + ').';
      }
    } catch { /* limits unavailable: do not block */ }
    return '';
  }

  async function review(event) {
    event.preventDefault();
    setError('');
    if (!fromId) return setError('You have no active account to send from.');
    if (!target) return setError('Choose the receiving bank.');
    if (!number.trim()) return setError('Enter the receiver’s account number.');
    if (amountMinor === null) return setError('Enter a positive amount with at most two decimal places, for example 250 or 250.50.');
    if (source && amountMinor > (Number(source.availableMinor) || 0)) return setError('The amount is more than the available balance (' + money(source.availableMinor) + ').');
    if (type === 'internal' && number.trim() === source?.accountNumber) return setError('You cannot send money to the same account.');
    const blocked = await overLimit();
    if (blocked) return setError(blocked);
    setStep(1);
  }

  async function confirm() {
    setError('');
    setBusy(true);
    try {
      // Field order matches the original portal exactly (it is part of the idempotency hash).
      const row = await send({ fromAccountId: fromId, destinationIfsc: target,
        destinationAccountNumber: number.trim(), amountMinor, currency: 'INR' });
      setResult(row);
      setStep(2);
    } catch (failure) {
      // Stay on Review: pressing Confirm again re-uses the same Idempotency-Key, so it cannot send twice.
      setError(failure.message);
    } finally { setBusy(false); }
  }

  function again() {
    setStep(0); setNumber(''); setAmount(''); setResult(null); setError('');
  }

  const outcome = result?.status === 'COMPLETED' ? { icon: <CheckCircleIcon color="success" sx={{ fontSize: 56 }} />, text: 'Transfer completed' }
    : result?.status === 'REJECTED' ? { icon: <ErrorIcon color="error" sx={{ fontSize: 56 }} />, text: 'Transfer rejected' }
      : { icon: <HourglassIcon color="warning" sx={{ fontSize: 56 }} />, text: 'Transfer accepted and in progress' };

  return <>
    <PageHeader title="Send money" subtitle="Transfers use synthetic balances on the SharedBank test network." />
    <Card sx={{ maxWidth: 720 }}>
      <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
          {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {!loaded && <Alert severity="info">Loading your accounts…</Alert>}
        {loaded && !sources.length && <Alert severity="warning">You have no active account to send from.</Alert>}

        {loaded && sources.length > 0 && step === 0 && <Box component="form" onSubmit={review} noValidate>
          <Stack spacing={2.5}>
            <ToggleButtonGroup exclusive fullWidth color="primary" value={type}
              onChange={(_, value) => value && setType(value)} aria-label="Transfer type">
              <ToggleButton value="interbank">Other bank</ToggleButton>
              <ToggleButton value="internal">Same bank ({bank.name})</ToggleButton>
            </ToggleButtonGroup>
            <TextField select label="From account" value={fromId} onChange={e => setFrom(e.target.value)}>
              {sources.map(account => <MenuItem key={account.accountId} value={account.accountId}>
                {account.accountNumber} · {money(account.availableMinor)} available
              </MenuItem>)}
            </TextField>
            {type === 'interbank' && <TextField select label="Receiving bank" value={route}
              onChange={e => setDestination(e.target.value)} disabled={!routes.length}
              helperText={routes.length ? 'Active banks from the SharedBank directory' : 'Loading the bank directory…'}>
              {routes.map(item => <MenuItem key={item.ifsc} value={item.ifsc}>{item.bankName} · {item.ifsc}</MenuItem>)}
            </TextField>}
            <TextField label="Receiver’s account number" value={number} onChange={e => setNumber(e.target.value)}
              slotProps={{ htmlInput: { autoComplete: 'off', spellCheck: false } }} />
            <TextField label="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              helperText={amountMinor ? 'You will send ' + money(amountMinor) : 'Up to two decimal places'}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
            {error && <Alert severity="error">{error}</Alert>}
            <Box><Button type="submit" variant="contained" size="large">Review transfer</Button></Box>
          </Stack>
        </Box>}

        {step === 1 && <Stack spacing={2}>
          <Typography variant="h6">Check the details</Typography>
          <Box>
            <Row label="From" value={source?.accountNumber} />
            <Divider />
            <Row label="To bank" value={(targetName || '—') + ' · ' + target} />
            <Divider />
            <Row label="To account" value={number.trim()} />
            <Divider />
            <Row label="Amount" value={money(amountMinor)} />
          </Box>
          {error && <Alert severity="error">{error} Pressing Confirm again is safe: it re-uses the same request ID.</Alert>}
          <Stack direction="row" spacing={1.5}>
            <Button onClick={() => { setError(''); setStep(0); }} disabled={busy}>Back</Button>
            <Button variant="contained" size="large" onClick={confirm} disabled={busy}>{busy ? 'Sending…' : 'Confirm and send'}</Button>
          </Stack>
        </Stack>}

        {step === 2 && result && <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          {outcome.icon}
          <Typography variant="h5">{outcome.text}</Typography>
          <Typography variant="h4" component="p">{money(amountMinor)}</Typography>
          <StatusChip status={result.status} />
          {result.code && <Typography color="text.secondary">{reasonText(result.code)}</Typography>}
          <Typography variant="body2" color="text.secondary">Transfer ID: {result.transferId}</Typography>
          {result.status !== 'COMPLETED' && result.status !== 'REJECTED' &&
            <Typography variant="body2" color="text.secondary">The status updates automatically in Transactions.</Typography>}
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" onClick={again}>New transfer</Button>
            <Button component={RouterLink} to="/history">View transactions</Button>
          </Stack>
        </Stack>}
      </CardContent>
    </Card>
  </>;
}
