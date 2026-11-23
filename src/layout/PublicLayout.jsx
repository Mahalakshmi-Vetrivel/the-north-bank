import { Link as RouterLink, Outlet } from 'react-router-dom';
import { Box, Link, Stack, Typography } from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useBank } from '../bank/BankContext';

// Simple frame for pages that do not need a signed-in customer (register, status, admin sign-in).
export default function PublicLayout({ wide = false }) {
  const { bank } = useBank();
  return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
    <Box component="header" sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', px: { xs: 2, md: 4 }, py: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', maxWidth: wide ? 1240 : 760, mx: 'auto' }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }} component={RouterLink} to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <AccountBalanceIcon color="primary" />
          <Typography sx={{ fontWeight: 800, letterSpacing: '.08em' }}>{bank.wordmark}</Typography>
        </Stack>
        <Link component={RouterLink} to="/login" underline="hover">Customer sign in</Link>
      </Stack>
    </Box>
    <Box component="main" sx={{ maxWidth: wide ? 1240 : 760, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}><Outlet /></Box>
  </Box>;
}
