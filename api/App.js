/* This code is setting up a Node.js server using the Express framework. */
/* These lines of code are importing the required modules for setting up the Node.js server. */
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

/* These lines of code are importing various modules and files that are required for the setup of the
Node.js server. */
const UserRoutes = require('./controllers/users');
const LoginRoutes = require('./controllers/login');
const RoomsRoutes = require('./controllers/rooms');
const middlewares = require('./utils/middlewares');
const log = require('./utils/logger');
const config = require('./utils/config');

/* This code is connecting to a MongoDB database using the Mongoose library. */
mongoose.set('strictQuery', false);

log.info(`connecting to ${config.MONGODB_URI}`);
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    log.info('connected to mongodb');
  }).catch((error) => {
    log.error('error connecting to MongoDB:', error.message);
  });

/* This code is setting up the middleware and routes for the Node.js server using the Express
framework. */
const app = express();

app.use(cors());
app.use(express.json());

app.use(middlewares.requestLogger);
app.use(middlewares.TokenExtractor);

app.use('/api/users', UserRoutes);
app.use('/api/rooms', RoomsRoutes);
app.use('/services/login', LoginRoutes);

/* `module.exports = app;` is exporting the `app` object, which represents the Express application, so
that it can be used in other files. By exporting the `app` object, other files can import and use
the `app` object to set up routes, middleware, and handle HTTP requests and responses. */
module.exports = app;
