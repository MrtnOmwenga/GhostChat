import axios from 'axios';

// Same-origin requests: the session cookie is httpOnly and sent by the browser automatically,
// so no token is ever handled in JavaScript.
const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message;
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    return Promise.reject(wrapped);
  },
);

export default api;
