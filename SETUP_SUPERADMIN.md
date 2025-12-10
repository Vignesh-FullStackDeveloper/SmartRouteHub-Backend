# Superadmin Setup Guide

## Overview

The system now includes a **superadmin** role that can:
- View all organizations
- Access all organization details and statistics
- Monitor system-wide metrics
- Login without organization code

## Setup Instructions

### 1. Run Migrations

First, run the migration to add superadmin role:

```bash
npm run migrate
```

### 2. Seed Superadmin User

Create the default superadmin user:

```bash
npm run seed
```

This will create a superadmin with:
- **Email**: `superadmin@smartroutehub.com`
- **Password**: `SuperAdmin@123`
- **Role**: `superadmin`

⚠️ **IMPORTANT**: Change the password after first login!

### 3. Login as Superadmin

**Login without organization code:**

```bash
POST /api/auth/login
{
  "email": "superadmin@smartroutehub.com",
  "password": "SuperAdmin@123"
}
```

Note: `organizationCode` is optional for superadmin login.

## Superadmin Endpoints

All superadmin endpoints require authentication and superadmin role.

### Get All Organizations

```bash
GET /api/superadmin/organizations
Authorization: Bearer <token>
```

Response:
```json
{
  "count": 2,
  "organizations": [
    {
      "id": "...",
      "name": "Greenwood High School",
      "code": "GHS001",
      "database": {
        "exists": true,
        "name": "smartroutehub_ghs001"
      }
    }
  ]
}
```

### Get Organization Details

```bash
GET /api/superadmin/organizations/:id
Authorization: Bearer <token>
```

Response includes:
- Organization details
- Statistics (users, students, buses, routes, active trips)
- Database status

### Get System Statistics

```bash
GET /api/superadmin/statistics
Authorization: Bearer <token>
```

Response:
```json
{
  "organizations": 5,
  "users": 150,
  "students": 500,
  "buses": 25,
  "active_trips": 12
}
```

## Automatic Database Creation

When a new organization is created, the system automatically:

1. ✅ Creates a new database: `smartroutehub_<org_code>`
2. ✅ Creates all required tables in that database
3. ✅ Sets up proper indexes and relationships

**Database naming convention:**
- Organization code: `GHS001`
- Database name: `smartroutehub_ghs001`

## Development Setup

### Local PostgreSQL

1. Make sure PostgreSQL is running:
```bash
# Windows
net start postgresql-x64-14

# Linux/Mac
sudo systemctl start postgresql
```

2. Create `.env.local`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=smartroutehub
```

3. Run migrations:
```bash
npm run migrate
```

4. Seed superadmin:
```bash
npm run seed
```

5. Start server:
```bash
npm run dev
```

The server will:
- Connect to local PostgreSQL
- Use `.env.local` configuration
- Create organization databases automatically when organizations are created

## Multi-Database Architecture

Each organization has its own isolated database:

```
Main Database (smartroutehub)
├── organizations (metadata)
├── users (superadmin only)
└── ...

Organization Database (smartroutehub_ghs001)
├── users (org users)
├── students
├── buses
├── routes
├── trips
└── ...
```

This ensures:
- ✅ Complete data isolation
- ✅ Independent scaling
- ✅ Easy backup/restore per organization
- ✅ No cross-organization data leaks

## Security Notes

1. **Superadmin Password**: Change immediately after first login
2. **JWT Secret**: Use strong secret in production
3. **Database Credentials**: Never commit to version control
4. **Superadmin Access**: Limit to trusted personnel only

## Troubleshooting

### Superadmin login fails

1. Check if user exists:
```sql
SELECT * FROM users WHERE email = 'superadmin@smartroutehub.com';
```

2. Verify role:
```sql
SELECT role FROM users WHERE email = 'superadmin@smartroutehub.com';
```

### Database creation fails

1. Check PostgreSQL user has CREATEDB privilege:
```sql
ALTER USER postgres CREATEDB;
```

2. Verify connection to PostgreSQL:
```bash
psql -h localhost -U postgres -d postgres
```

3. Check logs for detailed error messages

### Organization database not created

- Check server logs for errors
- Verify database service has proper permissions
- Ensure PostgreSQL is accessible

