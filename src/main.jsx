import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import bank from './bank-config';

document.title = bank.name + ' | Account portal';
// Link to the SharedBank directory page (unchanged from the generated portal).
const switchUrl = 'https://sriramtpsiog.github.io/SharedDB/';
createRoot(document.getElementById('root')).render(<App bank={bank} switchUrl={switchUrl} />);
