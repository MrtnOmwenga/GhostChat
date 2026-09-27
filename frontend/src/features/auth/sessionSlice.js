import { createSlice } from '@reduxjs/toolkit';

const session = createSlice({
  name: 'session',
  initialState: { user: null },
  reducers: {
    signedIn(state, { payload }) { state.user = payload; },
    signedOut(state) { state.user = null; },
  },
});

export const { signedIn, signedOut } = session.actions;
export default session.reducer;
