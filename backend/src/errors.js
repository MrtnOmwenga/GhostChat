class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validate(schema, value) {
  const { error, value: clean } = schema.validate(value, { abortEarly: true, stripUnknown: true });
  if (error) throw new HttpError(400, error.message);
  return clean;
}

// Express 5 forwards rejected promises from async handlers here.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Already taken' });
  }
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { HttpError, validate, errorHandler };
