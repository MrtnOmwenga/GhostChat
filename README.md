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

   - **Rate Limiting**: A rate limiter middleware is implemented to prevent abuse or DoS attacks by limiting the number of requests from a single IP address within a specified time window.

  - **Content Security Policy (CSP)**: Helmet's contentSecurityPolicy middleware is used to implement a Content Security Policy, which helps mitigate the risk of XSS attacks by allowing the application to specify which sources of content are trusted.

- **Error Handling and Logging**: The application handles errors gracefully, providing informative error messages to users. Detailed logs are maintained for debugging and monitoring purposes.

- **Documentation**: Thorough documentation is provided in the project repository, including installation instructions, API documentation, architecture overview, and deployment guidelines. Swagger is used to document the API endpoints.

- **Deployment and CI/CD**: The application is deployed using CI/CD pipelines, with automated testing and deployment processes. Puppet is used to automate this process.

#### Software Architecture and Deployment

I deployed the anonymous chat application using a scalable and cost-effective architecture, leveraging industry-standard tools and free resources. The deployment architecture ensured high availability, scalability, and performance while minimizing costs.

#### Components:

1. **DigitalOcean Droplets**: DigitalOcean droplets were utilized as the primary compute instances to host the backend server, frontend application, and supporting services. Droplets offered a reliable and scalable infrastructure with flexible configurations.

2. **Nginx**: Nginx served as the web server and reverse proxy, responsible for routing incoming HTTP requests to the appropriate backend services. It also handled SSL termination, load balancing, and caching, improving performance and security.

3. **MongoDB Atlas**: MongoDB Atlas was used as the cloud-hosted database service, providing a fully managed MongoDB instance. Atlas offered high availability, automatic scaling, and backups, eliminating the need for manual maintenance and ensuring data durability.

4. **Redis Cloud by Redis Labs**: Redis Cloud was utilized for caching user data and session management, enhancing the performance and scalability of the application. It offered various caching strategies, such as in-memory caching and distributed caching, to optimize data access.

5. **Docker**: Docker containers were employed for packaging the application components into lightweight and portable units. Docker simplified deployment and ensured consistency across different environments, enabling seamless scaling and management.

#### Deployment Workflow:

1. **Backend Deployment**:
   - Configured DigitalOcean droplets to host the backend Node.js server.
   - Utilized Docker to containerize the backend application, including Express.js, MongoDB client, and Redis client.
   - Deployed multiple instances of the backend service across droplets to achieve high availability and fault tolerance.
   - Used Nginx for load balancing and reverse proxying incoming requests to backend instances.
   - Implemented SSL/TLS termination with Let's Encrypt certificates for secure communication.

2. **Frontend Deployment**:
   - Hosted the frontend React application on separate DigitalOcean droplets or utilized static site hosting services like GitHub Pages or Netlify.
   - Configured Nginx to serve the static assets and handle client-side routing.

3. **Database Deployment**:
   - Created a MongoDB Atlas cluster with the desired configuration (replication factor, storage engine, etc.).
   - Secured the MongoDB cluster with network access controls, authentication mechanisms, and encryption at rest.
   - Configured the backend Node.js server to connect to the MongoDB Atlas cluster securely.

4. **Caching Setup**:
   - Provisioned a Redis Cloud instance by Redis Labs and configured it for caching and session management.
   - Integrated Redis into the backend application to store frequently accessed data and manage user sessions efficiently.

#### Monitoring and Maintenance:

1. **Monitoring**: Utilized monitoring tools like Prometheus, Grafana, or DataDog to monitor the performance, health, and resource utilization of the application components.

2. **Logging**: Implemented centralized logging using tools like ELK stack (Elasticsearch, Logstash, Kibana) or Splunk to aggregate and analyze logs from different components.

3. **Backup and Disaster Recovery**: Set up automated backups for the MongoDB Atlas cluster and Redis Cloud instance to ensure data resilience and facilitate disaster recovery.

4. **Scaling**: Configured auto-scaling policies for DigitalOcean droplets based on CPU utilization or incoming traffic to handle spikes in demand efficiently.

#### Puppet Configuration:

A Puppet configuration file has been provided to automate the deployment and configuration of the application components, ensuring consistency and repeatability across different environments.


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