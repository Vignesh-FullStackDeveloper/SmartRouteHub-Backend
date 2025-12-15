# SmartRouteHub Backend API

Production-grade backend API for School Bus Tracking System built with Fastify, PostgreSQL, and TypeScript.

## Features

- ✅ **Auto Database Setup**: Database, migrations, and seeds run automatically on startup
- ✅ **Multi-tenant**: Organization-based data isolation with separate databases
- ✅ **Authentication & Authorization**: JWT-based auth with role-based permissions
- ✅ **Real-time Notifications**: Redis pub/sub for instant notifications
- ✅ **API Documentation**: Swagger/OpenAPI with interactive UI
- ✅ **Enterprise Logging**: Winston with daily rotation
- ✅ **Security**: Helmet, CORS, rate limiting, input validation

## Tech Stack

- **Framework**: Fastify 4.x
- **Database**: PostgreSQL 12+ with Knex.js
- **Authentication**: JWT
- **Cache/Pub-Sub**: Redis (ioredis)
- **Validation**: Zod
- **Logging**: Winston

## Prerequisites

- Node.js 18+
- PostgreSQL 12+ (running)
- Redis (optional, for notifications)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy example file
cp .env.local.example .env.local

# Edit .env.local with your values
# Required: DB_PASSWORD, JWT_SECRET (min 32 chars)
```

### 3. Start Server

```bash
npm run dev
```

**That's it!** The server automatically:
- ✅ Creates database if it doesn't exist
- ✅ Runs all migrations
- ✅ Seeds initial data (superadmin user)
- ✅ Starts API server on port 3000

### 4. Access API

- **Swagger UI**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health

## Environment Files

| File | Purpose | When Used |
|------|---------|-----------|
| `.env.local` | Development config | `NODE_ENV=development` (default) |
| `.env.production` | Production config | `NODE_ENV=production` |

**Setup:**
- Development: Copy `.env.local.example` → `.env.local`
- Production: Copy `.env.production.example` → `.env.production`

The application automatically selects the correct file based on `NODE_ENV`.

## Authentication

### Default Superadmin

After first startup:
- **Email**: `superadmin@smartroutehub.com`
- **Password**: `SuperAdmin@123`
- ⚠️ **Change password after first login!**

### Login via Swagger

1. Open http://localhost:3000/docs
2. Click `POST /api/auth/login`
3. Enter credentials and execute
4. Copy the `token` from response
5. Click "Authorize" → Enter: `Bearer <token>`

## Database Management

### Auto-Initialization (Default)

With `AUTO_INIT_DB=true` (default), the server automatically:
1. Creates main database if it doesn't exist
2. Runs all pending migrations
3. Runs seed files (creates superadmin)

**No manual setup needed!**

### Manual Commands

You still need manual commands for:

| Task | Command |
|------|---------|
| Create new migration | `npm run migrate:make <name>` |
| Run new migrations | `npm run migrate` (or restart server) |
| Rollback migration | `npm run migrate:rollback` |
| Run new seeds | `npm run seed` (or restart server) |

**Note**: Auto-init only runs on startup. For new migrations/seeds added after server started, either run manually or restart the server.

### Database Architecture

- **Main Database** (`smartroutehub`): Organizations, superadmin users
- **Organization Databases** (`smartroutehub_{org_code}`): Auto-created per organization, complete data isolation

## API Endpoints

**54+ endpoints** covering:
- Authentication (login, verify, logout)
- Organizations (create, get, update)
- Students, Buses, Routes, Drivers
- Trips & Location Tracking
- Analytics & Insights
- Assignments & Subscriptions
- Notifications (real-time)
- Permissions & Roles

**Full API documentation**: http://localhost:3000/docs

## Configuration

### Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `DB_HOST` | `localhost` | Database host |
| `DB_PASSWORD` | - | Database password |
| `JWT_SECRET` | - | **Required**: Min 32 characters |
| `AUTO_INIT_DB` | `true` | Auto-create DB and run migrations |
| `REDIS_HOST` | `127.0.0.1` | Redis host (optional) |

See `.env.local.example` for complete configuration options.

## Scripts

```bash
npm run dev          # Start dev server (auto-reload + auto-init)
npm run build        # Build for production
npm start            # Start production server
npm run migrate      # Run migrations manually
npm run migrate:make <name>  # Create new migration
npm run migrate:rollback     # Rollback last migration
npm run seed         # Run seeds manually
npm run lint         # Run ESLint
npm run format       # Format code
```

## Architecture

**Layered Architecture:**
```
Routes → Services → Repositories → Database
```

- **Routes**: HTTP request/response handling
- **Services**: Business logic
- **Repositories**: Database operations
- **Multi-tenant**: Separate database per organization

## Troubleshooting

### Database Connection Failed
- Verify PostgreSQL is running
- Check credentials in `.env.local`
- Ensure PostgreSQL user has `CREATEDB` privilege: `ALTER USER postgres CREATEDB;`

### Auto-Init Not Working
- Check `AUTO_INIT_DB=true` in `.env.local`
- Check server logs for errors
- Run manually: `npm run migrate && npm run seed`

### Redis Connection Failed
- Redis is optional (notifications won't work without it)
- Check Redis is running: `redis-cli ping`
- Verify configuration in `.env.local`

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` (32+ characters)
3. Configure proper CORS origins
4. Set `AUTO_INIT_DB=false` (run migrations manually)
5. Set up SSL/TLS
6. Configure monitoring and alerts

## License

MIT
