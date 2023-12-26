require('dotenv').config();

/* These lines of code are using destructuring assignment to extract specific properties from the
`process.env` object. */
const { PORT } = process.env;
const { MONGODB_URI } = process.env;
const { SECRET } = process.env;

module.exports = {
  PORT,
  MONGODB_URI,
  SECRET,
};
