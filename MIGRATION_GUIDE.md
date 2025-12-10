# Migration Guide - Understanding Database Setup

## Quick Answer

**You only need to run `npm run migrate` ONCE** when setting up the project (or when new migrations are added). 

**You do NOT need to run it for every organization** - the system automatically creates databases and tables when organizations are created!

## How It Works

### Main Database (smartroutehub)

This is the **central database** that stores:
- Organizations metadata
- Superadmin users
- System-wide data

**Migrations are needed here:**
```bash
npm run migrate  # Run ONCE during setup
```

This creates tables like:
- `organizations`
- `users` (for superadmin)
- `notifications` (system-wide)
- etc.

### Organization Databases (smartroutehub_orgcode)

Each organization gets its **own isolated database** automatically created when you create an organization.

**Migrations are NOT needed here** - tables are created automatically!

When you create an organization:
```bash
POST /api/organizations
{
  "name": "Greenwood High School",
  "code": "GHS001"
}
```

The system automatically:
1. ✅ Creates database: `smartroutehub_ghs001`
2. ✅ Creates all tables (users, students, buses, routes, trips, etc.)
3. ✅ Sets up indexes and relationships
4. ✅ Ready to use immediately!

## Migration Workflow

### Initial Setup (One Time)

```bash
# 1. Install dependencies
npm install

# 2. Configure .env.local
# Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# 3. Run migrations ONCE for main database
npm run migrate

# 4. Seed superadmin (optional)
npm run seed

# 5. Start server
npm run dev
```

### When New Migrations Are Added

If new migrations are added to the codebase:

```bash
# Run migrations again to update main database
npm run migrate
```

**Note:** Organization databases are created fresh with all tables, so they don't need migrations.

## What Happens When You Create an Organization

```typescript
// 1. Organization record created in main database
POST /api/organizations
→ Creates record in main DB: organizations table

// 2. Database automatically created
→ Creates: smartroutehub_ghs001 database

// 3. All tables automatically created
→ Creates: users, students, buses, routes, trips, etc.
→ All with proper indexes and relationships

// 4. Ready to use!
→ No manual steps needed!
```

## Database Structure

```
Main Database (smartroutehub)
├── organizations (metadata)
├── users (superadmin only)
└── notifications (system-wide)

Organization Database (smartroutehub_ghs001) - Auto-created
├── users (org users)
├── students
├── buses
├── routes
├── trips
├── location_tracking
├── subscriptions
└── stops
```

## When Do You Need Migrations?

### ✅ Run Migrations When:

1. **Initial setup** - First time setting up the project
2. **New migrations added** - When codebase has new migration files
3. **Schema changes** - When main database schema needs updating

### ❌ Do NOT Run Migrations When:

1. **Creating organizations** - Handled automatically
2. **Every server start** - Not needed
3. **For each organization** - Not needed

## Example Workflow

### Day 1: Initial Setup
```bash
npm install
npm run migrate  # ← Run ONCE
npm run seed     # ← Create superadmin
npm run dev
```

### Day 2: Create Organization
```bash
# No migrations needed!
POST /api/organizations
{
  "name": "Greenwood High School",
  "code": "GHS001"
}
# Database and tables created automatically!
```

### Day 3: Create Another Organization
```bash
# Still no migrations needed!
POST /api/organizations
{
  "name": "Sunshine Elementary",
  "code": "SES002"
}
# Another database created automatically!
```

### Day 4: New Migration Added to Codebase
```bash
# Only if new migration file exists
npm run migrate  # ← Update main database
# Organization databases don't need this
```

## Troubleshooting

### "Table doesn't exist" error

**For main database:**
```bash
npm run migrate  # Run migrations
```

**For organization database:**
- Check if organization was created successfully
- Check server logs for database creation errors
- Organization databases are created automatically, no manual migration needed

### "Database doesn't exist" error

**For organization:**
- Organization database should be created automatically
- Check server logs when creating organization
- Verify PostgreSQL user has CREATEDB privilege:
  ```sql
  ALTER USER postgres CREATEDB;
  ```

## Summary

| Action | Run Migrations? | Notes |
|--------|----------------|-------|
| Initial setup | ✅ Yes (once) | `npm run migrate` |
| Create organization | ❌ No | Auto-created |
| Start server | ❌ No | Not needed |
| New migration added | ✅ Yes | Update main DB |
| Per organization | ❌ No | Never needed |

**Bottom line:** Run `npm run migrate` once during setup, then forget about it! Organizations handle their own database creation automatically. 🚀

