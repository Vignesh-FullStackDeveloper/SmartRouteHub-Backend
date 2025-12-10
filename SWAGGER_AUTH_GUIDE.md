# Swagger Authentication Guide

## Enterprise-Grade Approach

**Best Practice:** Keep authentication enabled even in development. This ensures:
- Security testing matches production
- Developers understand the auth flow
- No surprises when deploying to production

## Quick Start: Get Your Token

### Option 1: Using Swagger UI (Recommended)

1. **Open Swagger UI**: http://localhost:4000/docs

2. **Login via the `/api/auth/login` endpoint:**
   - Click on `POST /api/auth/login`
   - Click "Try it out"
   - For **Superadmin** (default dev account):
     ```json
     {
       "email": "superadmin@smartroutehub.com",
       "password": "SuperAdmin@123"
     }
     ```
   - For **Regular Users**:
     ```json
     {
       "email": "user@example.com",
       "password": "your-password",
       "organizationCode": "ORG001"
     }
     ```
   - Click "Execute"
   - Copy the `token` from the response

3. **Authorize in Swagger:**
   - Click the green "Authorize" button at the top
   - Enter: `Bearer <your-token-here>`
   - Click "Authorize"
   - Click "Close"

4. **Now all protected endpoints will use your token automatically!**

### Option 2: Using cURL

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@smartroutehub.com",
    "password": "SuperAdmin@123"
  }'

# Use the token in subsequent requests
curl -X GET http://localhost:4000/api/organizations \
  -H "Authorization: Bearer <your-token-here>"
```

### Option 3: Using Postman/Insomnia

1. Create a POST request to `http://localhost:4000/api/auth/login`
2. Set body to JSON with email and password
3. Copy the token from response
4. Set Authorization header: `Bearer <token>` for all other requests

## Default Superadmin Credentials

After running `npm run seed`, you get:

- **Email**: `superadmin@smartroutehub.com`
- **Password**: `SuperAdmin@123`
- **Role**: `superadmin`
- **Organization Code**: Not required (optional)

⚠️ **IMPORTANT**: Change the password after first login in production!

## Development vs Production

### Development (Recommended)
- ✅ Keep auth enabled
- ✅ Use Swagger UI "Authorize" button
- ✅ Test with real tokens
- ✅ Understand the auth flow

### Alternative: Disable Auth in Swagger (Not Recommended)

If you really want to disable auth requirements in Swagger UI for development:

1. Add to `.env.local`:
   ```env
   SWAGGER_DISABLE_AUTH=true
   ```

2. Restart the server

**Note:** This only affects Swagger UI display. The actual API endpoints still require authentication. This is **not recommended** as it can lead to confusion and security issues.

## Token Expiration

- Default expiration: 7 days (configurable via `JWT_EXPIRES_IN` in `.env.local`)
- To get a new token, simply login again
- Verify your token: `GET /api/auth/verify` (requires Authorization header)

## Troubleshooting

### "Unauthorized" Error
- Make sure you copied the full token (it's a long string)
- Check that you included `Bearer ` prefix in Swagger UI
- Verify the token hasn't expired
- Try logging in again to get a fresh token

### "Forbidden" Error
- Your user doesn't have permission for that action
- Check your user role and permissions
- Superadmin has access to everything

### Token Not Working in Swagger
- Click "Authorize" button again
- Make sure you entered: `Bearer <token>` (with space after Bearer)
- Try logging in again to get a new token

## Security Best Practices

1. **Never commit tokens** to version control
2. **Change default passwords** in production
3. **Use environment variables** for sensitive data
4. **Rotate tokens regularly** in production
5. **Keep auth enabled** even in development
6. **Use HTTPS** in production

