const app = require('./server'); // the actual Express application
const config = require('./utils/config.utils');
const log = require('./utils/logger.utils');

app.listen(config.PORT, () => {
  log.info(`Server running on port ${config.PORT}`);
});
