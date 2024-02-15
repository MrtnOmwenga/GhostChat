import axios from 'axios';

class Token {
  constructor() {
    this.token = null;
    this.csrfCookie = null;
    this.csrfToken = null;
  }

  initialize(authToken) {
    this.token = authToken;

    const response = axios.get('/services/csrf');
    this.csrfToken = response.data.csrfToken;
    this.csrfCookie = response.headers['set-cookie'];
  }

  getToken() {
    return {
      token: this.token,
      csrfCookie: this.csrfCookie,
      csrfToken: this.csrfToken,
    };
  }
}

const token = new Token();
export default token;
