# SmartRouteHub Backend API

Production-grade backend API for School Bus Tracking System built with Fastify, PostgreSQL, and TypeScript.

## Features

- ✅ **Authentication & Authorization**: JWT-based auth with role-based permissions
- ✅ **Multi-tenant**: Organization-based data isolation
- ✅ **Enterprise Logging**: Winston with daily rotation and centralized logging
- ✅ **API Documentation**: Swagger/OpenAPI with interactive UI
- ✅ **Database Migrations**: Automatic schema management with Knex
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **Rate Limiting**: Protection against abuse
- ✅ **Security**: Helmet, CORS, input validation
- ✅ **Analytics**: Travel history and insights for students, buses, and drivers

## Tech Stack

- **Framework**: Fastify
- **Database**: PostgreSQL
- **ORM/Query Builder**: Knex.js
- **Authentication**: JWT
- **Logging**: Winston with daily rotation
- **Validation**: Zod
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Run migrations**:
```bash
npm run migrate
```

4. **Seed permissions**:
```bash
npm run seed
```

5. **Start development server**:
```bash
npm run dev
```

## API Documentation

Once the server is running, access Swagger UI at:
```
http://localhost:3000/docs
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Logout

### Organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id` - Get organization
- `PUT /api/organizations/:id` - Update organization

### Students
- `POST /api/students` - Create student
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student by ID
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `GET /api/students/:id/pickup-location` - Get pickup location

### Buses
- `POST /api/buses` - Create bus
- `GET /api/buses` - Get all buses
- `GET /api/buses/:id` - Get bus by ID
- `PUT /api/buses/:id` - Update bus
- `DELETE /api/buses/:id` - Delete bus
- `POST /api/buses/:id/assign-driver` - Assign driver

### Routes
- `POST /api/routes` - Create route with stops
- `GET /api/routes` - Get all routes
- `GET /api/routes/:id` - Get route with stops
- `PUT /api/routes/:id` - Update route
- `DELETE /api/routes/:id` - Delete route
- `POST /api/routes/:id/assign-students` - Assign students to route

### Drivers
- `POST /api/drivers` - Create driver
- `GET /api/drivers` - Get all drivers
- `GET /api/drivers/:id` - Get driver by ID
- `PUT /api/drivers/:id` - Update driver
- `GET /api/drivers/:id/schedule` - Get driver schedule

### Trips
- `POST /api/trips/start` - Start trip
- `POST /api/trips/:id/location` - Update trip location
- `POST /api/trips/:id/end` - End trip
- `GET /api/trips/active` - Get active trips
- `GET /api/trips/:id` - Get trip details

### Analytics
- `GET /api/analytics/students/:id/travel-history` - Student travel history
- `GET /api/analytics/buses/:id/travel-history` - Bus travel history
- `GET /api/analytics/drivers/:id/travel-history` - Driver travel history
- `GET /api/analytics/dashboard` - Dashboard insights

### Assignments
- `POST /api/assignments/students-to-route` - Assign students to route
- `POST /api/assignments/students-to-bus` - Assign students to bus
- `GET /api/assignments/route/:id/students` - Get route assignments
- `GET /api/assignments/bus/:id/students` - Get bus assignments

## Database Schema

The database automatically creates the following tables:
- `organizations` - Organization data
- `users` - Users (admin, driver, parent)
- `buses` - Bus information
- `students` - Student information
- `routes` - Bus routes
- `stops` - Route stops
- `trips` - Active/completed trips
- `location_tracking` - GPS location history
- `permissions` - Permission definitions
- `role_permissions` - Role-permission mappings

## Logging

Logs are stored in the `logs/` directory with daily rotation:
- `application-YYYY-MM-DD.log` - All application logs
- `error-YYYY-MM-DD.log` - Error logs only
- `access-YYYY-MM-DD.log` - Access logs
- `exceptions-YYYY-MM-DD.log` - Unhandled exceptions
- `rejections-YYYY-MM-DD.log` - Unhandled promise rejections

## Security Features

- JWT authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation with Zod
- SQL injection protection (parameterized queries)

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure proper CORS origins
4. Set up SSL/TLS
5. Configure database connection pooling
6. Set up log aggregation
7. Enable monitoring and alerts

## License

MIT

