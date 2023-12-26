const jwt = require('jsonwebtoken');
const logger = require('./logger');

/**
 * The requestLogger function logs information about the incoming request before passing it to the next
 * middleware.
 * @param request - The request object represents the HTTP request made by the client. It contains
 * information such as the request method, request path, request headers, and request body.
 * @param response - The `response` parameter is an object that represents the HTTP response that will
 * be sent back to the client. It contains properties and methods that allow you to set the response
 * status, headers, and body.
 * @param next - The `next` parameter is a function that is used to pass control to the next middleware
 * function in the request-response cycle. It is typically called at the end of the current middleware
 * function to indicate that it has completed its processing and the next middleware function should be
 * called.
 */
const requestLogger = (request, response, next) => {
  logger.info('Method:', request.method);
  logger.info('Path:  ', request.path);
  logger.info('Body:  ', request.body);
  logger.info('---');
  next();
};

/**
 * The TokenExtractor function extracts and verifies a JWT token from the authorization header of a
 * request and attaches it to the request object for further processing.
 * @param request - The `request` parameter represents the incoming HTTP request object. It contains
 * information about the request made by the client, such as the request headers, request method,
 * request URL, request body, etc.
 * @param response - The `response` parameter is an object that represents the HTTP response that will
 * be sent back to the client. It is used to send data back to the client, set response headers, and
 * control the response status code.
 * @param next - The `next` parameter is a function that is called to pass control to the next
 * middleware function in the request-response cycle. It is typically used to move to the next
 * middleware function or to the route handler.
 */
const TokenExtractor = (request, response, next) => {
  const authorization = request.get('authorization');
  if (authorization && authorization.startsWith('Bearer ')) {
    const token = authorization.replace('Bearer ', '');

    try {
      const DecodedToken = jwt.verify(token, process.env.SECRET);
      request.token = DecodedToken;
    } catch (err) {
      request.token = null;
    }
  } else {
    request.token = null;
  }

  next();
};

/* `module.exports` is a special object in Node.js that is used to define the public interface of a
module. It allows you to export functions, objects, or values from a module so that they can be used
in other parts of your application. */
module.exports = {
  requestLogger,
  TokenExtractor,
};
