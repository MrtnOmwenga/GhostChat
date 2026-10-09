const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { parse: parseCookie } = require('cookie');
const config = require('./config');
const Session = require('./models/session');
const { HttpError } = require('./errors');

const COOKIE_NAME = 'ghostchat_session';
const COOKIE = { httpOnly: true, sameSite: 'strict', secure: config.secureTransport, path: '/' };

/*
 * A session is a row on the server, named by a signed token in a cookie. The signature stops
 * anyone inventing a session; the row is what lets one be ended: signing out deletes it, and a
 * copy of the cookie made beforehand stops working at that moment instead of hours later.
 */

function sign(user, sessionId) {
  return jwt.sign({ sub: user.id, username: user.username, sid: sessionId }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionHours}h`,
  });
}

// The session lives in an httpOnly cookie so page scripts (and any injected script) can't read
// it. SameSite=Strict keeps other sites from sending it, which is what makes a separate CSRF
// token unnecessary.
async function startSession(res, user) {
  const maxAge = config.sessionHours * 60 * 60 * 1000;
  const session = await Session.create({ user: user.id, expiresAt: new Date(Date.now() + maxAge) });
  res.cookie(COOKIE_NAME, sign(user, session.id), { ...COOKIE, maxAge });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, COOKIE);
}

/** The signed-in user and session a Cookie header names, or null. */
async function sessionFromCookieHeader(header) {
  const token = header ? parseCookie(header)[COOKIE_NAME] : undefined;
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (typeof payload.sid !== 'string' || !mongoose.isValidObjectId(payload.sid)) return null;
  const live = await Session.exists({ _id: payload.sid, user: payload.sub, expiresAt: { $gt: new Date() } });
  return live ? { id: payload.sub, username: payload.username, sessionId: payload.sid } : null;
}

async function requireAuth(req, res, next) {
  const user = await sessionFromCookieHeader(req.headers.cookie);
  if (!user) throw new HttpError(401, 'Not signed in');
  req.user = user;
  next();
}

/** Ends the sessions matching `filter` and closes their open sockets. */
async function endSessions(filter, realtime) {
  const sessions = await Session.find(filter, { _id: 1 });
  await Session.deleteMany({ _id: { $in: sessions.map((s) => s.id) } });
  sessions.forEach((s) => realtime?.disconnectSession(s.id));
  return sessions.length;
}

module.exports = {
  startSession, clearSessionCookie, requireAuth, sessionFromCookieHeader, endSessions,
};
