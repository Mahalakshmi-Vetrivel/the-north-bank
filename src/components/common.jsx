import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography,
} from '@mui/material';
import InboxIcon from '@mui/icons-material/InboxOutlined';
import { bankName, money, reasonText, routeLabel, statusColors, statusNames, time } from '../format';

export function PageHeader({ title, subtitle, action }) {
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, justifyContent: 'space-between', alignItems: { sm: 'flex-end' } }}>
    <Box>
      <Typography variant="h4" component="h1">{title}</Typography>
      {subtitle && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
    </Box>
    {action}
  </Stack>;
}

export function StatusChip({ status }) {
  return <Chip size="small" label={statusNames[status] || status || 'Unknown'} color={statusColors[status] || 'default'}
    variant={status === 'COMPLETED' ? 'filled' : 'outlined'} />;
}

export function EmptyState({ title, text, action }) {
  return <Box sx={{ textAlign: 'center', py: 6, px: 2, color: 'text.secondary' }}>
    <InboxIcon sx={{ fontSize: 40, mb: 1, opacity: 0.6 }} />
    <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 650 }}>{title}</Typography>
    {text && <Typography variant="body2" sx={{ mt: 0.5 }}>{text}</Typography>}
    {action && <Box sx={{ mt: 2 }}>{action}</Box>}
  </Box>;
}

function Line({ label, children }) {
  return <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', py: 1 }}>
    <Typography color="text.secondary" variant="body2">{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' }}>{children}</Typography>
  </Stack>;
}

// Read-only receipt built only from the fields the Worker returned for this transfer.
export function ReceiptDialog({ row, directory, onClose }) {
  return <Dialog open={Boolean(row)} onClose={onClose} fullWidth maxWidth="xs">
    {row && <>
      <DialogTitle>Transfer receipt</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h4" component="p" color={row.direction === 'CREDIT' ? 'success.main' : 'text.primary'}>
            {row.direction === 'CREDIT' ? '+ ' : ''}{money(row.amountMinor)}
          </Typography>
          <Box sx={{ mt: 1 }}><StatusChip status={row.status} /></Box>
        </Box>
        <Divider />
        <Line label="Transfer ID">{row.transferId}</Line>
        <Line label="Date (IST)">{time(row.createdAt)}</Line>
        <Line label="Type">{routeLabel(row)}</Line>
        <Line label="From bank">{bankName(directory, row.sourceBankId)}</Line>
        <Line label="To bank">{bankName(directory, row.destinationBankId)}</Line>
        {row.code && <Line label="Reason">{reasonText(row.code)}</Line>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => window.print()}>Print</Button>
        <Button variant="contained" onClick={onClose}>Close</Button>
      </DialogActions>
    </>}
  </Dialog>;
}
