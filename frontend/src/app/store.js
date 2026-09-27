import { configureStore } from '@reduxjs/toolkit';
import chat from '../features/chat/chatSlice';
import session from '../features/auth/sessionSlice';

const store = configureStore({ reducer: { chat, session } });

export default store;
