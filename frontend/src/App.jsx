import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './features/landing/Home';
import ChatPage from './features/chat/ChatPage';
import LoginRegister from './features/auth/AuthPage';

const App = () => (
  <div className="App">
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chatpage" element={<ChatPage />} />
        <Route path="/login-register" element={<LoginRegister />} />
      </Routes>
    </Router>
  </div>
);

export default App;
