class Token {
  constructor() {
    this.token = null;
  }

  initialize(authToken) {
    this.token = authToken;
  }

  getToken() {
    return this.token;
  }
}

const token = new Token();
export default token;
