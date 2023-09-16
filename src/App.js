import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Views/Home';
import ChatPage from './Views/ChatPage';
import LoginRegister from './Views/Login-Register';

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
