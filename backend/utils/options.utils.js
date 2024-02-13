const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GhostChat backend',
      version: '1.0.0',
      description: 'API documentation for GhostChat App',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./controllers/*.controller.js'], // Path to the API routes directory
};

module.exports = options;