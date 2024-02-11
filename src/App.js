import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './views/home';
import ChatPage from './views/chat-page';
import LoginRegister from './views/login-register';

const App = () => (
  <div className="App">
    <header className="App-header" />
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
