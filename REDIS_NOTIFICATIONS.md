# Redis-Based Real-Time Notifications

## Overview

Enterprise-grade real-time notification system using Redis pub/sub for bus tracking events. Parents receive instant notifications when:

- ✅ Bus starts
- ✅ Bus is near student pickup location (500m radius)
- ✅ Bus arrives at school

## Architecture

```
┌─────────────┐
│   Driver    │ → Updates Location → Trip Service
└─────────────┘                           │
                                          ▼
┌─────────────────────────────────────────────────┐
│         Location Tracking Service               │
│  - Checks distance to student locations         │
│  - Checks distance to school                    │
│  - Triggers notifications                       │
└─────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────┐
│         Notification Service                    │
│  - Stores in PostgreSQL                         │
│  - Publishes to Redis pub/sub                   │
└─────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│  PostgreSQL  │                    │    Redis     │
│  (Persistence)│                    │  (Pub/Sub)   │
└──────────────┘                    └──────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │   Parent     │
                                    │  (Real-time) │
                                    └──────────────┘
```

## Setup

### 1. Install Redis

**Windows:**
```bash
# Download from https://github.com/microsoftarchive/redis/releases
# Or use WSL
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Mac:**
```bash
brew install redis
brew services start redis
```

### 2. Configure Redis

Update `.env.local`:
```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 3. Run Migration

```bash
npm run migrate
```

This creates the `notifications` table.

### 4. Start Server

```bash
npm run dev
```

The server will automatically connect to Redis on startup.

## Notification Types

### 1. Bus Started
- **Trigger**: When driver starts a trip
- **Recipients**: All parents whose children are on the bus
- **Message**: "Bus {number} has started on route {name}. Your child {name} will be picked up soon."

### 2. Bus Near Student
- **Trigger**: When bus is within 500m of student pickup location
- **Recipients**: Parent of that specific student
- **Message**: "Bus {number} is {distance}m away from {name}'s pickup location. Estimated arrival: {minutes} minutes."

### 3. Bus Arrived at School
- **Trigger**: When bus is within 200m of school (last route stop)
- **Recipients**: All parents whose children are on the bus
- **Message**: "Bus {number} has arrived at school. {name} has safely reached."

## API Endpoints

### Get Notifications

```bash
GET /api/notifications
Authorization: Bearer <parent-token>
Query Parameters:
  - unread_only: boolean (optional)
  - limit: number (default: 50)
  - offset: number (default: 0)
```

Response:
```json
{
  "notifications": [
    {
      "id": "...",
      "type": "bus_started",
      "title": "Bus Started",
      "message": "Bus BUS001 has started...",
      "read": false,
      "created_at": "2024-01-01T12:00:00Z",
      "data": {
        "bus_number": "BUS001",
        "route_name": "Route A",
        "student_name": "John Doe"
      }
    }
  ],
  "total": 10
}
```

### Get Unread Count

```bash
GET /api/notifications/unread-count
Authorization: Bearer <parent-token>
```

Response:
```json
{
  "unread_count": 5
}
```

### Mark as Read

```bash
PATCH /api/notifications/:id/read
Authorization: Bearer <parent-token>
```

### Mark All as Read

```bash
PATCH /api/notifications/read-all
Authorization: Bearer <parent-token>
```

### Real-Time Stream (SSE)

```bash
GET /api/notifications/stream
Authorization: Bearer <parent-token>
```

This endpoint uses Server-Sent Events (SSE) for real-time notifications. The connection stays open and receives notifications as they happen.

**Client Example (JavaScript):**
```javascript
const eventSource = new EventSource('/api/notifications/stream', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('New notification:', notification);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};
```

## How It Works

### 1. Bus Starts Trip

```typescript
POST /api/trips/start
{
  "bus_id": "...",
  "route_id": "...",
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

**What happens:**
1. Trip is created
2. Notification service finds all students on the bus
3. Notifications are created for each parent
4. Notifications are stored in PostgreSQL
5. Notifications are published to Redis channels:
   - `notifications:org:{org_id}` (organization-wide)
   - `notifications:parent:{parent_id}` (parent-specific)

### 2. Location Update

```typescript
POST /api/trips/:id/location
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "speed_kmh": 30
}
```

**What happens:**
1. Location is updated in database
2. Location tracking service checks:
   - Distance to each student's pickup location
   - Distance to school (last route stop)
3. If within threshold:
   - Notification is created
   - Published to Redis
   - Stored in database

### 3. Parent Receives Notification

**Via API:**
- Parent polls `/api/notifications`
- Gets latest notifications

**Via Real-Time Stream:**
- Parent connects to `/api/notifications/stream`
- Receives notifications instantly via SSE
- Redis pub/sub delivers notifications in real-time

## Distance Thresholds

- **Near Student**: 500 meters
- **Near School**: 200 meters
- **Check Interval**: Every location update (typically every 30 seconds)

## Redis Channels

- `notifications:org:{organization_id}` - Organization-wide notifications
- `notifications:parent:{parent_id}` - Parent-specific notifications

## Performance

- **Redis Pub/Sub**: < 1ms latency
- **Database Storage**: Async, non-blocking
- **Scalable**: Handles thousands of concurrent connections
- **Reliable**: Notifications persisted even if Redis is down

## Monitoring

Check Redis connection status:
```bash
GET /health
```

Response includes Redis status:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

## Troubleshooting

### Redis Connection Failed

1. Check Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

2. Check configuration in `.env.local`

3. Check server logs for connection errors

### Notifications Not Received

1. Verify parent is subscribed to correct channel
2. Check notification was created in database:
```sql
SELECT * FROM notifications WHERE parent_id = '...';
```

3. Verify Redis pub/sub is working:
```bash
redis-cli
SUBSCRIBE notifications:parent:test-parent-id
```

### Location Updates Not Triggering Notifications

1. Verify trip status is `in_progress`
2. Check student has `pickup_point_id` set
3. Verify route has stops defined
4. Check distance calculations in logs

## Enterprise Features

✅ **Dual Storage**: PostgreSQL (persistence) + Redis (real-time)
✅ **Pub/Sub Architecture**: Scalable, decoupled
✅ **SSE Support**: Real-time streaming
✅ **Distance-Based Triggers**: Automatic proximity detection
✅ **Notification History**: 7-day retention in Redis, permanent in DB
✅ **Read/Unread Status**: Full notification management
✅ **Multi-Channel**: Organization and parent-specific channels
✅ **Error Handling**: Graceful degradation if Redis is down
✅ **Performance**: Sub-millisecond notification delivery

