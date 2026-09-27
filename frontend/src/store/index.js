import { configureStore } from '@reduxjs/toolkit';
import chat from './chat';
import session from './session';

const store = configureStore({ reducer: { chat, session } });

export default store;
