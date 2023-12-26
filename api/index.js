/* This code is starting a server using the Express framework in JavaScript. */
const app = require('./server');
const config = require('./utils/config');
const log = require('./utils/logger');

app.listen(config.PORT, () => {
  log.info(`Server running on port ${config.PORT}`);
});
