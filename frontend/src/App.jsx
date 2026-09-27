import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './features/landing/Home';

// The auth and chat pages pull in libsodium and zxcvbn (several hundred KB), so they load only
// when visited; the landing page stays light.
const AuthPage = lazy(() => import('./features/auth/AuthPage'));
const ChatPage = lazy(() => import('./features/chat/ChatPage'));
const JoinPage = lazy(() => import('./features/chat/JoinPage'));

const App = () => (
  <div className="App">
    <Router>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chatpage" element={<ChatPage />} />
          <Route path="/login-register" element={<AuthPage />} />
          <Route path="/join/:inviteId" element={<JoinPage />} />
        </Routes>
      </Suspense>
    </Router>
  </div>
);

export default App;
