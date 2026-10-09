const crypto = require('crypto');
const config = require('./config');

/*
 * The server is meant to be reached through a reverse proxy (TLS, caching, the visitor's real
 * address). Its own address is public too, so when EDGE_SECRET is set it refuses whatever didn't
 * come through the proxy: otherwise rate limits could be dodged by going around it.
 */

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();
// Compared as digests: equal length, so the comparison takes the same time whatever was sent.
const expected = config.edgeSecret ? digest(config.edgeSecret) : null;

/** True when no secret is configured, or the request carries it. */
function fromEdge(headers) {
  if (!expected) return true;
  const sent = headers['x-edge-secret'];
  return typeof sent === 'string' && crypto.timingSafeEqual(digest(sent), expected);
}

/** Refuses requests that didn't come through the proxy, and takes the visitor's address from it. */
function edgeOnly(req, res, next) {
  if (!fromEdge(req.headers)) return res.status(404).json({ error: 'Not found' });
  const address = config.clientIpHeader && req.headers[config.clientIpHeader];
  if (typeof address === 'string' && address) Object.defineProperty(req, 'ip', { value: address, configurable: true });
  return next();
}

/**
 * For paths only the proxy's own scheduled calls may use: they exist only when a secret is
 * configured, since without one there is no telling the proxy from anyone else.
 */
function edgeInternal(req, res, next) {
  if (!expected || !fromEdge(req.headers)) return res.status(404).json({ error: 'Not found' });
  return next();
}

module.exports = { fromEdge, edgeOnly, edgeInternal };
