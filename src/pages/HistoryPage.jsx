import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, InputAdornment, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import { useBank } from '../bank/BankContext';
import { EmptyState, PageHeader, ReceiptDialog, StatusChip } from '../components/common';
import { bankName, isIncoming, money, reasonText, routeLabel, statusNames, time } from '../format';
import { downloadCsv, toCsv } from '../csv';

// Date input (YYYY-MM-DD, India time) → start/end instant in ms.
const istDay = (value, end) => value ? new Date(value + (end ? 'T23:59:59.999+05:30' : 'T00:00:00+05:30')).getTime() : null;

export default function HistoryPage() {
  const { data, directory, loaded, error } = useBank();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [direction, setDirection] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [receipt, setReceipt] = useState(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const start = istDay(fromDate, false);
    const end = istDay(toDate, true);
    return data.transfers.filter(row => {
      const at = new Date(row.createdAt).getTime();
      if (status !== 'ALL' && row.status !== status) return false;
      if (direction === 'IN' && !isIncoming(row)) return false;
      if (direction === 'OUT' && isIncoming(row)) return false;
      if (start && !(at >= start)) return false;
      if (end && !(at <= end)) return false;
      if (!q) return true;
      return [row.transferId, bankName(directory, row.sourceBankId), bankName(directory, row.destinationBankId)]
        .some(text => String(text || '').toLowerCase().includes(q));
    });
  }, [data.transfers, directory, query, status, direction, fromDate, toDate]);

  const visible = rows.slice(page * perPage, page * perPage + perPage);
  const reset = setter => value => { setter(value); setPage(0); };

  function exportCsv() {
    const header = ['Transfer ID', 'Date (IST)', 'Type', 'From bank', 'To bank', 'Amount (INR)', 'Status', 'Reason'];
    const body = rows.map(row => [row.transferId, time(row.createdAt), routeLabel(row), bankName(directory, row.sourceBankId),
      bankName(directory, row.destinationBankId), ((Number(row.amountMinor) || 0) / 100).toFixed(2),
      statusNames[row.status] || row.status, reasonText(row.code)]);
    downloadCsv('north-bank-transactions.csv', toCsv(header, body));
  }

  return <>
    <PageHeader title="Transactions" subtitle="Your latest 50 transfers, as reported by the network."
      action={<Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>} />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Card>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
        <TextField size="small" placeholder="Search by ID or bank" value={query} onChange={e => reset(setQuery)(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        <TextField size="small" select label="Status" value={status} onChange={e => reset(setStatus)(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="ALL">All statuses</MenuItem>
          {Object.entries(statusNames).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Direction" value={direction} onChange={e => reset(setDirection)(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="ALL">All</MenuItem><MenuItem value="IN">Money in</MenuItem><MenuItem value="OUT">Money out</MenuItem>
        </TextField>
        <TextField size="small" type="date" label="From" value={fromDate} onChange={e => reset(setFromDate)(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
        <TextField size="small" type="date" label="To" value={toDate} onChange={e => reset(setToDate)(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
      </Stack>
      {!loaded ? <Typography sx={{ p: 3 }} color="text.secondary">Loading transfers…</Typography>
        : !rows.length ? <EmptyState title={data.transfers.length ? 'No transfers match these filters' : 'No transfers yet'}
          text={data.transfers.length ? 'Try clearing a filter.' : 'Your transfers appear here when the network accepts them.'} />
          : <>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Date (IST)</TableCell><TableCell>Details</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell>
                </TableRow></TableHead>
                <TableBody>{visible.map(row => <TableRow key={row.transferId} hover sx={{ cursor: 'pointer' }}
                  onClick={() => setReceipt(row)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setReceipt(row)}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{time(row.createdAt)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 650 }}>
                      {routeLabel(row)} · {bankName(directory, row.sourceBankId)} → {bankName(directory, row.destinationBankId)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{row.transferId}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap', color: isIncoming(row) ? 'success.main' : 'text.primary' }}>
                    {isIncoming(row) ? '+ ' : '− '}{money(row.amountMinor)}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={row.status} />
                    {row.code && <Box><Typography variant="caption" color="text.secondary">{reasonText(row.code)}</Typography></Box>}
                  </TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={rows.length} page={page} onPageChange={(_, value) => setPage(value)}
              rowsPerPage={perPage} onRowsPerPageChange={e => { setPerPage(Number(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>}
    </Card>
    <ReceiptDialog row={receipt} directory={directory} onClose={() => setReceipt(null)} />
  </>;
}
