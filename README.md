# Anonymous Chat Application

## Overview

This project is an anonymous chat application built using React, Express, and Socket.IO. It allows users to join chat rooms anonymously and communicate in real-time. User data is stored in a MongoDB database using Mongoose, and API endpoints are validated using Joi. Additionally, user data is cached using Redis for improved performance. Comprehensive tests for the API endpoints are written using Jest.

## Features

- Real-time anonymous chat functionality
- Data validation using Joi for API endpoints
- User data caching using Redis
- Comprehensive Jest tests for API endpoints

## Additional Features

- **Scalability and Performance Optimization**: The application is designed to handle a large number of concurrent users efficiently. I have implemented a WebSocket load balancer to distribute WebSocket connections across multiple backend servers. This ensures that WebSocket connections are evenly distributed and no single server becomes a bottleneck. I am also working on implementing connection pooling, idle connection timeouts, and other optimizations to reduce server resource usage and improve scalability.
  
- **Security Measures**: Robust security measures are implemented to protect user data and prevent common security vulnerabilities. Measures include input validation, sanitization, encryption of sensitive data, and protection against common attacks like SQL injection, XSS, CSRF, etc. Json web token is used to protect the api endpoints. Joi is used to validate user provided data.

- **Error Handling and Logging**: The application handles errors gracefully, providing informative error messages to users. Detailed logs are maintained for debugging and monitoring purposes.

- **Documentation**: Thorough documentation is provided in the project repository, including installation instructions, API documentation, architecture overview, and deployment guidelines. Swagger is used to document that api endpoints.

- **Deployment and CI/CD**: The application is deployed using CI/CD pipelines, with automated testing and deployment processes. Puppet is used to automate this process.

## Getting Started

### Prerequisites

- Node.js
- MongoDB
- Redis

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/anonymous-chat.git
   ```

2. Install dependencies:

   ```bash
   cd GhostChat
   npm install
   ```

2. Configure environment variables.

4. Start the backend development server:

   ```bash
   npm run server
   ```

5. Start frontend development server

   ```bash
   npm start
   ```