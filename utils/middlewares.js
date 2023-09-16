const jwt = require('jsonwebtoken');
const logger = require('./logger');

const requestLogger = (request, response, next) => {
  logger.info('Method:', request.method);
  logger.info('Path:  ', request.path);
  logger.info('Body:  ', request.body);
  logger.info('---');
  next();
};

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

module.exports = {
  requestLogger,
  TokenExtractor,
};
