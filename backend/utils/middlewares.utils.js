const jwt = require('jsonwebtoken');
const logger = require('./logger.utils');

// Log request information
const requestLogger = (request, response, next) => {
  logger.info('Method:', request.method);
  logger.info('Path:  ', request.path);
  logger.info('Body:  ', request.body);
  logger.info('---');
  next();
};

// Extract token from request
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

module.exports = {
  requestLogger,
  TokenExtractor,
  limiter,
};
