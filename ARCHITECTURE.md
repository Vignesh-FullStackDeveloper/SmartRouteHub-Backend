# Enterprise Architecture - Layered Architecture Pattern

## Overview

This backend follows **enterprise-grade layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────┐
│         Routes (Controllers)        │  ← HTTP Request/Response handling
├─────────────────────────────────────┤
│            Services                 │  ← Business Logic
├─────────────────────────────────────┤
│         Repositories                │  ← Database Operations
├─────────────────────────────────────┤
│          Database (Knex)            │  ← PostgreSQL
└─────────────────────────────────────┘
```

## Architecture Layers

### 1. **Routes Layer** (`src/routes/`)
- **Responsibility**: HTTP request/response handling
- **What it does**:
  - Validates request schemas (Zod)
  - Calls appropriate service methods
  - Handles HTTP status codes
  - Returns responses
- **What it does NOT do**:
  - ❌ Direct database queries
  - ❌ Business logic
  - ❌ Data transformation

**Example:**
```typescript
fastify.post('/', async (request, reply) => {
  const data = schema.parse(request.body);
  const student = await studentService.create(data, orgId);
  reply.code(201).send(student);
});
```

### 2. **Services Layer** (`src/services/`)
- **Responsibility**: Business logic and orchestration
- **What it does**:
  - Implements business rules
  - Validates business constraints
  - Orchestrates multiple repository calls
  - Handles transactions
  - Logs business events
- **What it does NOT do**:
  - ❌ Direct database queries (uses repositories)
  - ❌ HTTP concerns

**Example:**
```typescript
async create(data, organizationId) {
  // Business validation
  const exists = await this.repository.checkEmailExists(data.email);
  if (exists) throw new Error('Email already exists');
  
  // Business logic
  const passwordHash = await this.authService.hashPassword(data.password);
  
  // Create via repository
  return this.repository.create({ ...data, passwordHash });
}
```

### 3. **Repository Layer** (`src/repositories/`)
- **Responsibility**: Database operations
- **What it does**:
  - CRUD operations
  - Complex queries
  - Database-specific logic
  - Query optimization
- **What it does NOT do**:
  - ❌ Business logic
  - ❌ Validation (except data integrity)

**Example:**
```typescript
async findByEmail(email: string, organizationId: string) {
  return this.db('users')
    .where({ email, organization_id: organizationId })
    .first();
}
```

### 4. **Base Repository** (`src/repositories/base.repository.ts`)
- Provides common CRUD operations
- All repositories extend this for consistency
- Reduces code duplication

## Service Files

All business logic is in services:

1. **`auth.service.ts`** - Authentication & authorization
2. **`organization.service.ts`** - Organization management
3. **`user.service.ts`** - User management (all roles)
4. **`student.service.ts`** - Student management
5. **`bus.service.ts`** - Bus management
6. **`route.service.ts`** - Route & stop management
7. **`driver.service.ts`** - Driver-specific operations
8. **`trip.service.ts`** - Trip & location tracking
9. **`subscription.service.ts`** - Transport subscriptions
10. **`analytics.service.ts`** - Analytics & insights
11. **`assignment.service.ts`** - Student-bus-route assignments
12. **`maps.service.ts`** - Google Maps integration

## Repository Files

All database operations are in repositories:

1. **`base.repository.ts`** - Base class with common operations
2. **`organization.repository.ts`** - Organization queries
3. **`user.repository.ts`** - User queries
4. **`student.repository.ts`** - Student queries
5. **`bus.repository.ts`** - Bus queries
6. **`route.repository.ts`** - Route & stop queries
7. **`trip.repository.ts`** - Trip & location queries
8. **`subscription.repository.ts`** - Subscription queries

## Benefits of This Architecture

### ✅ **Separation of Concerns**
- Each layer has a single, clear responsibility
- Easy to understand and maintain

### ✅ **Testability**
- Services can be tested with mock repositories
- Repositories can be tested independently
- Routes can be tested with mock services

### ✅ **Reusability**
- Services can be reused across different routes
- Repositories can be reused across services

### ✅ **Maintainability**
- Changes to database schema only affect repositories
- Business logic changes only affect services
- API changes only affect routes

### ✅ **Scalability**
- Easy to add caching layer between services and repositories
- Easy to add message queues for async operations
- Easy to split into microservices if needed

## Data Flow Example

**Creating a Student:**

1. **Route** receives HTTP POST request
   ```typescript
   POST /api/students
   Body: { name, class_grade, parent_id, ... }
   ```

2. **Route** validates schema and calls service
   ```typescript
   const data = createStudentSchema.parse(request.body);
   const student = await studentService.create(data, orgId);
   ```

3. **Service** implements business logic
   ```typescript
   // Verify parent exists
   const parent = await userRepository.findById(data.parent_id);
   if (!parent) throw new Error('Parent not found');
   
   // Create student
   return studentRepository.create({ ...data, orgId });
   ```

4. **Repository** executes database query
   ```typescript
   return this.db('students').insert(data).returning('*');
   ```

5. **Response** flows back through layers
   ```
   Repository → Service → Route → HTTP Response
   ```

## Error Handling

- **Routes**: Handle HTTP status codes and format error responses
- **Services**: Throw business exceptions with descriptive messages
- **Repositories**: Throw database exceptions (handled by services)

## Logging

- **Services**: Log business events (create, update, delete)
- **Routes**: Log HTTP requests/responses (via middleware)
- **Repositories**: No logging (handled by services)

## Multi-Tenancy

All operations are scoped by `organization_id`:
- Services receive `organizationId` parameter
- Repositories filter by `organization_id`
- Routes extract `organizationId` from authenticated user

## Best Practices

1. ✅ **Never skip layers** - Routes → Services → Repositories
2. ✅ **Services orchestrate** - Multiple repository calls belong in services
3. ✅ **Repositories are thin** - Only database operations
4. ✅ **Business logic in services** - Never in routes or repositories
5. ✅ **Validation at boundaries** - Schema validation in routes, business validation in services

## Migration from Old Code

If you see direct database calls in routes:
```typescript
// ❌ BAD - Direct DB in route
const user = await db('users').where({ id }).first();
```

Move to service:
```typescript
// ✅ GOOD - Service handles it
const user = await userService.getById(id, orgId);
```

This architecture ensures **production-grade, maintainable, and scalable** code! 🚀

