import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, IconButton, LinearProgress, List, ListItem, ListItemText, MenuItem, Stack, TextField, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/SendOutlined';
import { useBank } from '../bank/BankContext';
import { nbApi } from '../nbapi';
import { EmptyState, PageHeader } from '../components/common';

export default function PayeesPage() {
  const { bank, session, directory } = useBank();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [ifsc, setIfsc] = useState(bank.ifsc);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const banks = useMemo(() => [{ ifsc: bank.ifsc, bankName: bank.name + ' (this bank)' },
    ...directory.filter(item => item.bankId !== bank.id && item.status === 'ACTIVE').map(item => ({ ifsc: item.ifsc, bankName: item.bankName }))], [directory, bank]);

  const load = useCallback(() => {
    nbApi('/me/beneficiaries', { token: session.token }).then(value => { setRows(value.rows); setError(''); })
      .catch(failure => { setRows([]); setError(failure.message); });
  }, [session.token]);
  useEffect(load, [load]);

  async function add(event) {
    event.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      await nbApi('/me/beneficiaries', { token: session.token, data: { name, ifsc, accountNumber: number, bankName: banks.find(item => item.ifsc === ifsc)?.bankName || '' } });
      setName(''); setNumber(''); setNotice('Payee saved.'); load();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function remove(row) {
    setError(''); setNotice('');
    try { await nbApi('/me/beneficiaries/' + encodeURIComponent(row.id), { method: 'DELETE', token: session.token }); setNotice('Payee removed.'); load(); }
    catch (failure) { setError(failure.message); }
  }

  return <>
    <PageHeader title="Saved payees" subtitle="Save people you pay often. Sending still goes through the normal transfer review." />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Card sx={{ flex: 1, width: '100%' }}>
        <CardHeader title="Add a payee" />
        <CardContent><Box component="form" onSubmit={add}><Stack spacing={2}>
          <TextField label="Payee name" value={name} onChange={e => setName(e.target.value)} required />
          <TextField select label="Bank" value={ifsc} onChange={e => setIfsc(e.target.value)}>
            {banks.map(item => <MenuItem key={item.ifsc} value={item.ifsc}>{item.bankName} · {item.ifsc}</MenuItem>)}
          </TextField>
          <TextField label="Account number" value={number} onChange={e => setNumber(e.target.value)} required slotProps={{ htmlInput: { autoComplete: 'off', spellCheck: false } }} />
          <Box><Button type="submit" variant="contained" disabled={busy}>{busy ? 'Saving…' : 'Save payee'}</Button></Box>
        </Stack></Box></CardContent>
      </Card>
      <Card sx={{ flex: 1, width: '100%' }}>
        <CardHeader title="Your payees" />
        {!rows ? <LinearProgress /> : !rows.length ? <EmptyState title="No saved payees yet" text="Add one on the left." /> : <List disablePadding>
          {rows.map(row => <ListItem key={row.id} divider secondaryAction={<Stack direction="row">
            <Tooltip title="Send money"><IconButton aria-label={'Send money to ' + row.name} onClick={() => navigate('/transfer', { state: { payee: row } })}><SendIcon /></IconButton></Tooltip>
            <Tooltip title="Remove"><IconButton aria-label={'Remove ' + row.name} onClick={() => remove(row)}><DeleteIcon /></IconButton></Tooltip>
          </Stack>}>
            <ListItemText primary={row.name} secondary={(row.bankName || row.ifsc) + ' · ' + row.accountNumber} slotProps={{ primary: { fontWeight: 650 } }} />
          </ListItem>)}
        </List>}
      </Card>
    </Stack>
  </>;
}
