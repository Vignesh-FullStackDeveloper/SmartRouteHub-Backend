# Setup Guide

## Quick Start

1. **Install dependencies**:
```bash
npm install
```

2. **Create database**:
```sql
CREATE DATABASE smartroutehub;
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

4. **Run migrations**:
```bash
npm run migrate
```

5. **Seed permissions**:
```bash
npm run seed
```

6. **Start server**:
```bash
npm run dev
```

## Database Setup

The database will be automatically created and migrated. Make sure PostgreSQL is running on `localhost:5432` with:
- User: `postgres`
- Password: `postgres`
- Database: `smartroutehub` (will be created automatically)

## API Access

- **API Base URL**: `http://localhost:3000/api`
- **Swagger Docs**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`

## First Admin User

After setup, create your first organization and admin user via the API:

```bash
# Create organization
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Greenwood High School",
    "code": "GHS001",
    "contact_email": "admin@greenwood.edu"
  }'

# Then create admin user (you'll need to implement this endpoint or use SQL)
```

## Production Checklist

- [ ] Change JWT_SECRET to a strong random string
- [ ] Set NODE_ENV=production
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS
- [ ] Configure database connection pooling
- [ ] Set up log aggregation
- [ ] Enable monitoring and alerts
- [ ] Set up database backups
- [ ] Configure rate limiting appropriately
- [ ] Review and test all security settings

