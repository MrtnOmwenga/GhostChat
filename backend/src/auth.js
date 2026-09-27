const jwt = require('jsonwebtoken');
const { parse: parseCookie } = require('cookie');
const config = require('./config');
const { HttpError } = require('./errors');

const COOKIE_NAME = 'ghostchat_session';

function signSession(user) {
  return jwt.sign({ sub: user.id, username: user.username }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionHours}h`,
  });
}

function verifySession(token) {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  return { id: payload.sub, username: payload.username };
}

// The session lives in an httpOnly cookie so page scripts (and any injected script) can't read
// it. SameSite=Strict keeps other sites from sending it, which is what makes a separate CSRF
// token unnecessary.
function setSessionCookie(res, user) {
  res.cookie(COOKIE_NAME, signSession(user), {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    maxAge: config.sessionHours * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: config.isProduction, path: '/' });
}

function userFromCookieHeader(header) {
  const token = header ? parseCookie(header)[COOKIE_NAME] : undefined;
  if (!token) return null;
  try {
    return verifySession(token);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = userFromCookieHeader(req.headers.cookie);
  if (!user) throw new HttpError(401, 'Not signed in');
  req.user = user;
  next();
}

module.exports = { setSessionCookie, clearSessionCookie, requireAuth, userFromCookieHeader };
