import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar, Avatar, Box, Breadcrumbs, Chip, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Menu, MenuItem, Toolbar, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import SendIcon from '@mui/icons-material/SendOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import HubIcon from '@mui/icons-material/HubOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import RefreshIcon from '@mui/icons-material/Refresh';
import DarkIcon from '@mui/icons-material/DarkModeOutlined';
import LightIcon from '@mui/icons-material/LightModeOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useBank } from '../bank/BankContext';

const drawerWidth = 248;
export const customerNav = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/transfer', label: 'Send money', icon: <SendIcon /> },
  { to: '/history', label: 'Transactions', icon: <ReceiptIcon /> },
];

function Brand({ bank }) {
  return <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2.5 }}>
    <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 40, height: 40 }}>
      <AccountBalanceIcon fontSize="small" />
    </Avatar>
    <Box>
      <Typography sx={{ fontWeight: 800, letterSpacing: '.08em', lineHeight: 1.1 }}>{bank.wordmark}</Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ fontWeight: 650, lineHeight: 1.4 }}>
        Bank ID {bank.id}<br />IFSC {bank.ifsc}
      </Typography>
    </Box>
  </Box>;
}

export default function AppShell({ switchUrl, mode, toggleMode }) {
  const { bank, session, logout, refresh } = useBank();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const location = useLocation();
  const current = customerNav.find(item => item.to === location.pathname);

  const drawer = <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <Brand bank={bank} />
    <Divider />
    <List component="nav" aria-label="Main navigation" sx={{ px: 1.5, py: 1.5 }}>
      {customerNav.map(item => <ListItemButton key={item.to} component={NavLink} to={item.to} end
        onClick={() => setOpen(false)}
        sx={{ borderRadius: 2, mb: 0.5, '&.active': { bgcolor: 'action.selected', color: 'primary.main', '& .MuiListItemIcon-root': { color: 'primary.main' } } }}>
        <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} slotProps={{ primary: { fontWeight: 600 } }} />
      </ListItemButton>)}
    </List>
    <Box sx={{ mt: 'auto', p: 1.5 }}>
      <ListItemButton component="a" href={switchUrl} target="_blank" rel="noopener noreferrer"
        sx={{ borderRadius: 2, border: 1, borderColor: 'divider' }}>
        <ListItemIcon sx={{ minWidth: 38 }}><HubIcon /></ListItemIcon>
        <ListItemText primary="SharedBank switch" secondary="Network directory" />
      </ListItemButton>
    </Box>
  </Box>;

  return <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
    <AppBar position="fixed" color="inherit" elevation={0}
      sx={{ borderBottom: 1, borderColor: 'divider', width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` } }}>
      <Toolbar sx={{ gap: 1 }}>
        {!desktop && <IconButton edge="start" aria-label="Open navigation" onClick={() => setOpen(true)}><MenuIcon /></IconButton>}
        <Typography sx={{ fontWeight: 700 }} noWrap>{bank.name}</Typography>
        <Chip size="small" label="Firestore test network" color="primary" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh balances"><IconButton aria-label="Refresh balances" onClick={() => refresh()}><RefreshIcon /></IconButton></Tooltip>
        <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
          <IconButton aria-label="Toggle colour mode" onClick={toggleMode}>{mode === 'dark' ? <LightIcon /> : <DarkIcon />}</IconButton>
        </Tooltip>
        <IconButton aria-label="Account menu" onClick={event => setMenu(event.currentTarget)}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 15 }}>
            {(session?.email || '?').charAt(0).toUpperCase()}
          </Avatar>
        </IconButton>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
          <MenuItem disabled sx={{ opacity: '1 !important' }}>
            <ListItemText primary="Signed in" secondary={session?.email} />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setMenu(null); logout(); }}>
            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      {desktop
        ? <Drawer variant="permanent" open sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}>{drawer}</Drawer>
        : <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: drawerWidth } }}>{drawer}</Drawer>}
    </Box>
    <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3, md: 4 }, pt: { xs: 10, md: 11 } }}>
      <Breadcrumbs sx={{ mb: 1 }} aria-label="Breadcrumb">
        <Typography variant="body2" color="text.secondary">{bank.name}</Typography>
        <Typography variant="body2" color="text.primary">{current?.label || 'Page'}</Typography>
      </Breadcrumbs>
      <Box sx={{ maxWidth: 1240, mx: 'auto' }}><Outlet /></Box>
    </Box>
  </Box>;
}
