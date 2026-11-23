import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Grid, List, ListItemButton, ListItemText, Skeleton, Stack, Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SwapIcon from '@mui/icons-material/SwapHoriz';
import ReceiptIcon from '@mui/icons-material/ReceiptLong';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthWestIcon from '@mui/icons-material/SouthWest';
import { useBank } from '../bank/BankContext';
import { EmptyState, PageHeader, ReceiptDialog, StatusChip } from '../components/common';
import { bankName, isIncoming, money, routeLabel, time } from '../format';

function AccountCard({ account, primary }) {
  const available = Number(account.availableMinor) || 0;
  const held = Number(account.heldMinor) || 0;
  // The Worker returns available and held; total = available + held (see DB design: available = posted − held).
  return <Card sx={{
    color: primary ? '#fff' : 'text.primary', border: primary ? 0 : undefined, height: '100%',
    background: primary ? 'linear-gradient(135deg, #0b1d48 0%, #14306e 60%, #1f4fb0 100%)' : undefined,
  }}>
    <CardContent sx={{ p: 3 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 700, letterSpacing: '.04em' }}>{account.accountNumber}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>{account.status}</Typography>
      </Stack>
      <Typography variant="body2" sx={{ mt: 3, opacity: 0.8 }}>Available balance</Typography>
      <Typography variant="h4" component="p" sx={{ fontWeight: 780 }}>{money(available)}</Typography>
      <Stack direction="row" spacing={3} sx={{ mt: 2, opacity: 0.85 }}>
        <Box><Typography variant="caption">Held</Typography><Typography sx={{ fontWeight: 650 }}>{money(held)}</Typography></Box>
        <Box><Typography variant="caption">Total</Typography><Typography sx={{ fontWeight: 650 }}>{money(available + held)}</Typography></Box>
        <Box sx={{ ml: 'auto !important', textAlign: 'right' }}><Typography variant="caption">Account ID</Typography>
          <Typography sx={{ fontWeight: 650 }}>{account.accountId}</Typography></Box>
      </Stack>
    </CardContent>
  </Card>;
}

function Stat({ label, value, icon, color }) {
  return <Card sx={{ height: '100%' }}><CardContent>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color }}>{icon}
      <Typography variant="body2" color="text.secondary">{label}</Typography></Stack>
    <Typography variant="h5" component="p" sx={{ mt: 1 }}>{value}</Typography>
  </CardContent></Card>;
}

export default function DashboardPage() {
  const { bank, session, data, directory, loaded, error, lastUpdated } = useBank();
  const [receipt, setReceipt] = useState(null);
  const done = data.transfers.filter(row => row.status === 'COMPLETED');
  const incoming = done.filter(isIncoming).reduce((sum, row) => sum + (Number(row.amountMinor) || 0), 0);
  const outgoing = done.filter(row => !isIncoming(row)).reduce((sum, row) => sum + (Number(row.amountMinor) || 0), 0);
  const inFlight = data.transfers.filter(row => ['PENDING', 'PROCESSING'].includes(row.status)).length;

  return <>
    <PageHeader title="Dashboard" subtitle={'Signed in as ' + session.email + (lastUpdated ? ' · updated ' + time(lastUpdated) : '')}
      action={<Stack direction="row" spacing={1}>
        <Button variant="contained" startIcon={<SendIcon />} component={RouterLink} to="/transfer">Send money</Button>
        <Button variant="outlined" startIcon={<ReceiptIcon />} component={RouterLink} to="/history">Transactions</Button>
      </Stack>} />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!loaded && !error && <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={190} /></Grid>
      <Grid size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={190} /></Grid>
    </Grid>}
    {loaded && !data.accounts.length && <Alert severity="info">
      This login has no account in {bank.name} yet. Ask the bank admin to attach an account to this user.
    </Alert>}
    {loaded && data.accounts.length > 0 && <Stack spacing={3}>
      <Grid container spacing={2}>
        {data.accounts.map((account, index) => <Grid key={account.accountId} size={{ xs: 12, md: 6 }}>
          <AccountCard account={account} primary={index === 0} />
        </Grid>)}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><Stat label="Money in (recent)" value={money(incoming)} icon={<SouthWestIcon fontSize="small" />} color="success.main" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><Stat label="Money out (recent)" value={money(outgoing)} icon={<NorthEastIcon fontSize="small" />} color="error.main" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><Stat label="Transfers in progress" value={inFlight} icon={<SwapIcon fontSize="small" />} color="warning.main" /></Grid>
      </Grid>
      <Card>
        <CardHeader title="Recent activity" subheader="Latest transfers from the network"
          action={<Button component={RouterLink} to="/history">View all</Button>} />
        {data.transfers.length ? <List disablePadding>
          {data.transfers.slice(0, 6).map(row => <ListItemButton key={row.transferId} divider onClick={() => setReceipt(row)}>
            <ListItemText primary={routeLabel(row) + ' · ' + bankName(directory, isIncoming(row) ? row.sourceBankId : row.destinationBankId)}
              secondary={time(row.createdAt) + ' · ' + row.transferId} />
            <Stack sx={{ alignItems: 'flex-end', ml: 2 }} spacing={0.5}>
              <Typography sx={{ fontWeight: 700 }} color={isIncoming(row) ? 'success.main' : 'text.primary'}>
                {isIncoming(row) ? '+ ' : '− '}{money(row.amountMinor)}
              </Typography>
              <StatusChip status={row.status} />
            </Stack>
          </ListItemButton>)}
        </List> : <EmptyState title="No transfers yet" text="Your transfers appear here when the network accepts them." />}
      </Card>
    </Stack>}
    <ReceiptDialog row={receipt} directory={directory} onClose={() => setReceipt(null)} />
  </>;
}
