import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, CardHeader, Grid, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { useBank } from '../bank/BankContext';
import { nbApi } from '../nbapi';
import { EmptyState, PageHeader } from '../components/common';
import { isIncoming, money } from '../format';

const month = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' });

export default function PortfolioPage() {
  const { data, loaded, error } = useBank();
  const accounts = data.accounts;
  const [limits, setLimits] = useState({});

  // Read-only: shows the limits the bank admin set (own backend). Missing server just hides them.
  useEffect(() => {
    let live = true;
    Promise.all(accounts.map(item => nbApi('/limits/' + encodeURIComponent(item.accountId)).then(value => [item.accountId, value]).catch(() => null)))
      .then(pairs => { if (live) setLimits(Object.fromEntries(pairs.filter(Boolean))); });
    return () => { live = false; };
  }, [accounts]);

  const totals = useMemo(() => accounts.reduce((sum, item) => ({
    available: sum.available + (Number(item.availableMinor) || 0), held: sum.held + (Number(item.heldMinor) || 0),
  }), { available: 0, held: 0 }), [accounts]);
  const total = totals.available + totals.held;

  const months = useMemo(() => {
    const buckets = new Map();
    data.transfers.filter(row => row.status === 'COMPLETED').forEach(row => {
      const key = month.format(new Date(row.createdAt));
      const entry = buckets.get(key) || { key, at: new Date(row.createdAt).getTime(), in: 0, out: 0 };
      entry[isIncoming(row) ? 'in' : 'out'] += Number(row.amountMinor) || 0;
      buckets.set(key, entry);
    });
    return [...buckets.values()].sort((a, b) => a.at - b.at).slice(-6);
  }, [data.transfers]);
  const peak = Math.max(1, ...months.flatMap(item => [item.in, item.out]));

  return <>
    <PageHeader title="Portfolio" subtitle="Your balances and money flow at a glance." />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!loaded && !error && <Skeleton variant="rounded" height={220} />}
    {loaded && !accounts.length && <Alert severity="info">No account is linked to this login yet.</Alert>}
    {loaded && accounts.length > 0 && <Stack spacing={3}>
      <Grid container spacing={2}>
        {[['Total balance', money(total)], ['Available', money(totals.available)], ['On hold', money(totals.held)], ['Accounts', accounts.length]].map(([label, value]) =>
          <Grid key={label} size={{ xs: 6, md: 3 }}><Card><CardContent>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="h5" component="p" sx={{ mt: 0.5 }}>{value}</Typography></CardContent></Card></Grid>)}
      </Grid>
      <Card><CardHeader title="Where your money is" /><CardContent><Stack spacing={2}>
        {accounts.map(item => {
          const balance = (Number(item.availableMinor) || 0) + (Number(item.heldMinor) || 0);
          const limit = limits[item.accountId];
          return <Box key={item.accountId}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 650 }}>{item.accountNumber}</Typography><Typography>{money(balance)}</Typography></Stack>
            <LinearProgress variant="determinate" value={total ? (balance / total) * 100 : 0} sx={{ height: 8, borderRadius: 4, my: 0.75 }} />
            <Typography variant="caption" color="text.secondary">
              {total ? Math.round((balance / total) * 100) : 0}% of your total
              {limit?.perTransferMinor ? ' · per-transfer limit ' + money(limit.perTransferMinor) : ''}
              {limit?.dailyMinor ? ' · daily limit ' + money(limit.dailyMinor) : ''}
            </Typography>
          </Box>;
        })}
      </Stack></CardContent></Card>
      <Card><CardHeader title="Money in and out" subheader="Completed transfers among your latest 50, by month" /><CardContent>
        {!months.length ? <EmptyState title="No completed transfers yet" text="Send or receive money to see it here." /> : <Stack spacing={2}>
          {months.map(item => <Box key={item.key}>
            <Typography variant="body2" sx={{ fontWeight: 650, mb: 0.5 }}>{item.key}</Typography>
            {[['In', item.in, 'success'], ['Out', item.out, 'error']].map(([label, value, color]) => <Stack key={label} direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" sx={{ width: 28 }}>{label}</Typography>
              <LinearProgress variant="determinate" color={color} value={(value / peak) * 100} sx={{ flex: 1, height: 8, borderRadius: 4 }} />
              <Typography variant="caption" sx={{ width: 96, textAlign: 'right' }}>{money(value)}</Typography>
            </Stack>)}
          </Box>)}
        </Stack>}
      </CardContent></Card>
    </Stack>}
  </>;
}
