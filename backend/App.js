const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const bodyParser = require('body-parser')
const xss = require('xss-clean');
const helmet = require('helmet');
const session = require('express-session');
const mongoose = require('mongoose');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const UserRoutes = require('./controllers/user.controller');
const LoginRoutes = require('./controllers/login.controller');
const RoomsRoutes = require('./controllers/room.controller');
const middlewares = require('./utils/middlewares.utils');
const log = require('./utils/logger.utils');
const config = require('./utils/config.utils');
const options = require('./utils/options.utils');

// Connect to database
mongoose.set('strictQuery', false);

log.info(`connecting to ${config.MONGODB_URI}`);
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    log.info('connected to mongodb');
  }).catch((error) => {
    log.error('error connecting to MongoDB:', error.message);
  });

const app = express();

// Apply middleware
app.use(cors());
app.use(express.json());
app.use(xss());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
    styleSrc: ["'self'", 'fonts.googleapis.com'],
    fontSrc: ["'self'", 'fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:'],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));

// Session middleware configuration
app.use(session({
  secret: config.SECRET,
  resave: false, // explicitly set resave option to false
  saveUninitialized: true, // explicitly set saveUninitialized option to true or false based on your use case
  cookie: {
    sameSite: 'lax', // or 'strict'
  },
}));

// CSRF middleware configuration
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser());
app.use(csurf({ cookie: true }));

// CSRF token endpoint
app.get('/services/csrf', function (req, res) {
  res.status(200).json({ csrfToken: req.csrfToken() });
});

// Request logging and token extraction middleware
app.use(middlewares.requestLogger);
app.use(middlewares.TokenExtractor);

// Routes
app.use('/services/login', LoginRoutes);
app.use('/api/users', UserRoutes);
app.use('/api/rooms', RoomsRoutes);

// Swagger documentation
const specs = swaggerJsdoc(options);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));


// Custom CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    // Handle CSRF token errors here
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next(err);
});

module.exports = app;
