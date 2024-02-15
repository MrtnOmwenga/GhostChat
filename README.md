## Anonymous Chat Application

### Overview

This project is an anonymous chat application built using React, Express, and Socket.IO. It allows users to join chat rooms anonymously and communicate in real-time. User data is stored in a MongoDB database using Mongoose, and API endpoints are validated using Joi. Additionally, user data is cached using Redis for improved performance. Comprehensive tests for the API endpoints are written using Jest.

### Features

- Real-time anonymous chat functionality
- Data validation using Joi for API endpoints
- User data caching using Redis
- Comprehensive Jest tests for API endpoints

### Additional Features

- **Scalability and Performance Optimization**: The application is designed to handle a large number of concurrent users efficiently. A WebSocket load balancer is implemented to distribute WebSocket connections across multiple backend servers, ensuring even distribution of connections and preventing any single server from becoming a bottleneck. Connection pooling, idle connection timeouts, and other optimizations are implemented to reduce server resource usage and improve scalability.

- **Security Measures**: The updated App.js includes robust security measures to protect user data and prevent common security vulnerabilities. These measures include:

  - **Input Validation and Sanitization**: Joi is used to validate user-provided data, ensuring that only valid and sanitized data is accepted by the API endpoints. This helps prevent injection attacks and ensures data integrity.

  - **Protection Against Common Attacks**: The application is protected against common security attacks such as SQL injection, XSS (Cross-Site Scripting), and CSRF (Cross-Site Request Forgery). Parametrized queries are used to protect against SQL injection, while input validation and output encoding are used to prevent XSS attacks. The CSRF middleware provided by csurf is used to prevent CSRF attacks.

  - **JSON Web Token (JWT) Authentication**: JWT is used to authenticate users and protect API endpoints. Upon successful login, users receive a JWT token, which they include in subsequent requests to authenticate themselves. This helps prevent unauthorized access to sensitive endpoints and data.

  - **Secure Session Management**: Express session middleware is configured with secure options, including setting the `sameSite` attribute to `'lax'` or `'strict'`, which helps prevent CSRF and other attacks related to session management.

  - **Content Security Policy (CSP)**: Helmet's contentSecurityPolicy middleware is used to implement a Content Security Policy, which helps mitigate the risk of XSS attacks by allowing the application to specify which sources of content are trusted.

- **Error Handling and Logging**: The application handles errors gracefully, providing informative error messages to users. Detailed logs are maintained for debugging and monitoring purposes.

- **Documentation**: Thorough documentation is provided in the project repository, including installation instructions, API documentation, architecture overview, and deployment guidelines. Swagger is used to document the API endpoints.

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

3. Configure environment variables.

4. Start and run a redis stack container

   ```bash
   docker run -d --name redis-stack -p 6379:6379 -p 8001:8001 redis/redis-stack:latest
   docker exec -it redis-stack redis-cli
   ```

4. Start the backend development server:

   ```bash
   npm run server
   ```

5. Start frontend development server

   ```bash
   npm start
   ```