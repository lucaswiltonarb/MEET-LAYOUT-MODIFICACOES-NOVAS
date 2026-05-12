import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';

import '@stream-io/video-react-sdk/dist/css/styles.css';
import 'stream-chat-react/dist/css/v2/index.css';
import './index.css';

const CLERK_PK = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY!;

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <ClerkProvider publishableKey={CLERK_PK}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ClerkProvider>
);
