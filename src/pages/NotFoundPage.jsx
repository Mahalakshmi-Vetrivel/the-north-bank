import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';

export default function NotFoundPage({ code = 404, text = 'This page does not exist.' }) {
  return <Box sx={{ textAlign: 'center', py: 10 }}>
    <Typography variant="h2" component="p" color="primary" sx={{ fontWeight: 800 }}>{code}</Typography>
    <Typography sx={{ mt: 1, mb: 3 }} color="text.secondary">{text}</Typography>
    <Button variant="contained" component={RouterLink} to="/">Go to dashboard</Button>
  </Box>;
}
