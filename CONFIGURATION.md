# Configuration Guide

## Overview

The backend uses environment-based configuration with separate files for local and production environments.

## Configuration Files

### Environment Files

1. **`.env.local`** - Local development configuration
   - Copy from `.env.local.example`
   - Used when `NODE_ENV=development` or not set

2. **`.env.production`** - Production configuration
   - Copy from `.env.production.example`
   - Used when `NODE_ENV=production`
   - **NEVER commit this file to version control**

3. **`.env`** - Base configuration (optional)
   - Loaded after environment-specific file
   - Can be used for shared settings

## Setup Instructions

### Local Development

1. Copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Update values in `.env.local`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your-password
   DB_NAME=smartroutehub
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

### Production

1. Copy the example file:
   ```bash
   cp .env.production.example .env.production
   ```

2. Update all values with production credentials:
   ```env
   NODE_ENV=production
   DB_HOST=your-production-db-host
   DB_PASSWORD=strong-production-password
   JWT_SECRET=very-strong-random-secret-min-32-chars
   ```

3. Set environment variable:
   ```bash
   export NODE_ENV=production
   ```

4. Build and start:
   ```bash
   npm run build
   npm start
   ```

## Configuration Options

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment: `development`, `staging`, `production` |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `password` | Database password |
| `DB_NAME` | `smartroutehub` | Database name |
| `DB_SSL` | `false` | Enable SSL (use `true` for production) |
| `DB_POOL_MIN` | `2` | Minimum connection pool size |
| `DB_POOL_MAX` | `10` | Maximum connection pool size |

### JWT Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | **Required**: Minimum 32 characters |
| `JWT_EXPIRES_IN` | `7d` | Token expiration (e.g., `7d`, `24h`) |

### CORS Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGIN` | `*` | Comma-separated list of allowed origins |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_MAX` | `100` | Maximum requests per window |
| `RATE_LIMIT_TIME_WINDOW` | `60000` | Time window in milliseconds |

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level: `error`, `warn`, `info`, `debug` |
| `LOG_FILE_PATH` | `./logs` | Directory for log files |

### Google Maps API

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_MAPS_API_KEY` | - | Google Maps API key (optional) |

### Profiling Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_PROFILING` | `true` | Enable profiling |
| `PROFILING_SLOW_QUERY_THRESHOLD` | `1000` | Slow query threshold (ms) |
| `PROFILING_SLOW_REQUEST_THRESHOLD` | `5000` | Slow request threshold (ms) |
| `ENABLE_QUERY_PROFILING` | `true` | Enable database query profiling |
| `ENABLE_REQUEST_PROFILING` | `true` | Enable HTTP request profiling |
| `ENABLE_MEMORY_PROFILING` | `true` | Enable memory usage profiling |

## Profiling

### Features

- **Request Profiling**: Tracks response times for all HTTP requests
- **Query Profiling**: Monitors database query performance
- **Memory Profiling**: Tracks memory usage (heap, RSS, external)

### Accessing Profiling Stats

**Development:**
```bash
GET http://localhost:3000/api/profiling/stats
```

**Production:**
```bash
GET http://your-domain.com/api/profiling/stats
Authorization: Bearer <your-jwt-token>
```

### Profiling Response

```json
{
  "profiling": {
    "enabled": true,
    "requestProfiling": true,
    "queryProfiling": true,
    "memoryProfiling": true
  },
  "requests": {
    "totalRequests": 150,
    "averageResponseTime": 245,
    "slowRequests": 3
  },
  "memory": {
    "heap": {
      "used": 45,
      "total": 128,
      "percentage": 35
    },
    "external": 12,
    "rss": 180,
    "uptime": 3600
  },
  "database": {
    "pool": {
      "min": 2,
      "max": 10,
      "used": 3,
      "free": 7
    },
    "connection": {
      "host": "localhost",
      "port": 5432,
      "database": "smartroutehub"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Slow Request/Query Alerts

When a request or query exceeds the threshold, it's automatically logged:

```json
{
  "message": "Slow request detected",
  "method": "POST",
  "url": "/api/students",
  "statusCode": 200,
  "responseTime": 6234,
  "threshold": 5000
}
```

## Security Best Practices

1. **Never commit `.env.production`** to version control
2. **Use strong JWT secrets** (minimum 32 characters, randomly generated)
3. **Use SSL for production databases** (`DB_SSL=true`)
4. **Restrict CORS origins** in production
5. **Use environment variables** for all sensitive data
6. **Rotate secrets regularly** in production

## Configuration Validation

The application validates all configuration on startup. If any required value is missing or invalid, the server will:

1. Display detailed error messages
2. Exit with code 1
3. Prevent the server from starting

Example error:
```
❌ Configuration validation failed:
  - JWT_SECRET: String must contain at least 32 character(s)
```

## Environment-Specific Behavior

### Development
- Detailed console logging
- Profiling enabled by default
- CORS allows all origins
- Database SSL disabled
- Debug mode enabled

### Production
- JSON logging only
- Profiling stats require authentication
- CORS restricted to specified origins
- Database SSL enabled
- Error messages sanitized

## Troubleshooting

### Configuration not loading

1. Check file name matches environment:
   - Development: `.env.local`
   - Production: `.env.production`

2. Verify `NODE_ENV` is set correctly:
   ```bash
   echo $NODE_ENV
   ```

3. Check file location (should be in project root)

### Database connection fails

1. Verify database credentials in `.env` file
2. Check database is running
3. Verify network connectivity
4. Check SSL settings match database configuration

### Profiling not working

1. Verify `ENABLE_PROFILING=true` in `.env`
2. Check individual profiling flags are enabled
3. Review logs for profiling messages

