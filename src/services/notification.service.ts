import { getRedisPublisher, getRedisClient } from '../config/redis';
import { db } from '../config/database';
import { logger } from '../config/logger';

export enum NotificationType {
  BUS_STARTED = 'bus_started',
  BUS_NEAR_STUDENT = 'bus_near_student',
  BUS_ARRIVED_SCHOOL = 'bus_arrived_school',
  BUS_NEAR_PICKUP = 'bus_near_pickup',
  TRIP_COMPLETED = 'trip_completed',
}

export interface Notification {
  id: string;
  type: NotificationType;
  organization_id: string;
  student_id?: string;
  parent_id?: string;
  bus_id: string;
  route_id: string;
  trip_id: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: Date;
}

export class NotificationService {
  private readonly NOTIFICATION_CHANNEL_PREFIX = 'notifications';
  private readonly NOTIFICATION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  /**
   * Publish notification to Redis pub/sub
   */
  async publishNotification(notification: Omit<Notification, 'id' | 'read' | 'created_at'>): Promise<void> {
    try {
      const publisher = getRedisPublisher();
      const channel = `${this.NOTIFICATION_CHANNEL_PREFIX}:${notification.organization_id}`;
      
      // If parent_id specified, also publish to parent-specific channel
      if (notification.parent_id) {
        const parentChannel = `${this.NOTIFICATION_CHANNEL_PREFIX}:parent:${notification.parent_id}`;
        await publisher.publish(parentChannel, JSON.stringify(notification));
      }

      // Publish to organization channel
      await publisher.publish(channel, JSON.stringify(notification));

      logger.info({
        message: 'Notification published',
        type: notification.type,
        organization_id: notification.organization_id,
        parent_id: notification.parent_id,
      });
    } catch (error: any) {
      logger.error({
        message: 'Failed to publish notification',
        error: error.message,
        notification,
      });
    }
  }

  /**
   * Store notification in database
   */
  async storeNotification(notification: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> {
    try {
      const [stored] = await db('notifications')
        .insert({
          ...notification,
          read: false,
        })
        .returning('*');

      // Also store in Redis for quick access (with TTL)
      const redis = getRedisClient();
      const key = `notification:${stored.id}`;
      await redis.setex(key, this.NOTIFICATION_TTL, JSON.stringify(stored));

      logger.debug({
        message: 'Notification stored',
        notification_id: stored.id,
        type: stored.type,
      });

      return stored;
    } catch (error: any) {
      logger.error({
        message: 'Failed to store notification',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create and publish notification
   */
  async createNotification(
    type: NotificationType,
    organizationId: string,
    busId: string,
    routeId: string,
    tripId: string,
    title: string,
    message: string,
    options?: {
      studentId?: string;
      parentId?: string;
      data?: Record<string, any>;
    }
  ): Promise<Notification> {
    const notification = {
      type,
      organization_id: organizationId,
      student_id: options?.studentId,
      parent_id: options?.parentId,
      bus_id: busId,
      route_id: routeId,
      trip_id: tripId,
      title,
      message,
      data: options?.data || {},
      read: false,
    };

    // Store in database
    const stored = await this.storeNotification(notification);

    // Publish to Redis
    await this.publishNotification({
      ...notification,
      id: stored.id,
      created_at: stored.created_at,
    });

    return stored;
  }

  /**
   * Notify when bus starts
   */
  async notifyBusStarted(
    organizationId: string,
    busId: string,
    routeId: string,
    tripId: string,
    busNumber: string,
    routeName: string,
    studentIds: string[]
  ): Promise<void> {
    // Get parent IDs for all students
    const students = await db('students')
      .whereIn('id', studentIds)
      .where({ organization_id: organizationId, is_active: true })
      .select('id', 'name', 'parent_id');

    // Create notification for each parent
    for (const student of students) {
      if (student.parent_id) {
        await this.createNotification(
          NotificationType.BUS_STARTED,
          organizationId,
          busId,
          routeId,
          tripId,
          'Bus Started',
          `Bus ${busNumber} has started on route ${routeName}. Your child ${student.name} will be picked up soon.`,
          {
            studentId: student.id,
            parentId: student.parent_id,
            data: {
              bus_number: busNumber,
              route_name: routeName,
              student_name: student.name,
            },
          }
        );
      }
    }
  }

  /**
   * Notify when bus is near student location
   */
  async notifyBusNearStudent(
    organizationId: string,
    busId: string,
    routeId: string,
    tripId: string,
    studentId: string,
    distance: number, // in meters
    estimatedArrivalMinutes: number
  ): Promise<void> {
    const student = await db('students')
      .where({ id: studentId, organization_id: organizationId })
      .first();

    if (!student || !student.parent_id) {
      return;
    }

    const bus = await db('buses')
      .where({ id: busId, organization_id: organizationId })
      .first();

    const route = await db('routes')
      .where({ id: routeId, organization_id: organizationId })
      .first();

    await this.createNotification(
      NotificationType.BUS_NEAR_STUDENT,
      organizationId,
      busId,
      routeId,
      tripId,
      'Bus Approaching',
      `Bus ${bus?.bus_number || 'N/A'} is ${Math.round(distance)}m away from ${student.name}'s pickup location. Estimated arrival: ${estimatedArrivalMinutes} minutes.`,
      {
        studentId: student.id,
        parentId: student.parent_id,
        data: {
          bus_number: bus?.bus_number,
          route_name: route?.name,
          student_name: student.name,
          distance_meters: Math.round(distance),
          estimated_arrival_minutes: estimatedArrivalMinutes,
        },
      }
    );
  }

  /**
   * Notify when bus arrives at school
   */
  async notifyBusArrivedSchool(
    organizationId: string,
    busId: string,
    routeId: string,
    tripId: string,
    studentIds: string[]
  ): Promise<void> {
    const students = await db('students')
      .whereIn('id', studentIds)
      .where({ organization_id: organizationId, is_active: true })
      .select('id', 'name', 'parent_id');

    const bus = await db('buses')
      .where({ id: busId, organization_id: organizationId })
      .first();

    const route = await db('routes')
      .where({ id: routeId, organization_id: organizationId })
      .first();

    // Create notification for each parent
    for (const student of students) {
      if (student.parent_id) {
        await this.createNotification(
          NotificationType.BUS_ARRIVED_SCHOOL,
          organizationId,
          busId,
          routeId,
          tripId,
          'Arrived at School',
          `Bus ${bus?.bus_number || 'N/A'} has arrived at school. ${student.name} has safely reached.`,
          {
            studentId: student.id,
            parentId: student.parent_id,
            data: {
              bus_number: bus?.bus_number,
              route_name: route?.name,
              student_name: student.name,
            },
          }
        );
      }
    }
  }

  /**
   * Get notifications for a parent
   */
  async getParentNotifications(
    parentId: string,
    organizationId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ notifications: Notification[]; total: number }> {
    const query = db('notifications')
      .where({ parent_id: parentId, organization_id: organizationId })
      .orderBy('created_at', 'desc');

    if (options?.unreadOnly) {
      query.where({ read: false });
    }

    const total = await query.clone().count('* as count').first();
    const totalCount = parseInt(total?.count as string) || 0;

    if (options?.limit) {
      query.limit(options.limit);
    }
    if (options?.offset) {
      query.offset(options.offset);
    }

    const notifications = await query;

    return {
      notifications,
      total: totalCount,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, parentId: string): Promise<void> {
    await db('notifications')
      .where({ id: notificationId, parent_id: parentId })
      .update({ read: true });

    // Update in Redis cache
    const redis = getRedisClient();
    const key = `notification:${notificationId}`;
    const cached = await redis.get(key);
    if (cached) {
      const notification = JSON.parse(cached);
      notification.read = true;
      await redis.setex(key, this.NOTIFICATION_TTL, JSON.stringify(notification));
    }
  }

  /**
   * Mark all notifications as read for a parent
   */
  async markAllAsRead(parentId: string, organizationId: string): Promise<void> {
    await db('notifications')
      .where({ parent_id: parentId, organization_id: organizationId, read: false })
      .update({ read: true });
  }

  /**
   * Get unread count for a parent
   */
  async getUnreadCount(parentId: string, organizationId: string): Promise<number> {
    const result = await db('notifications')
      .where({ parent_id: parentId, organization_id: organizationId, read: false })
      .count('* as count')
      .first();

    return parseInt(result?.count as string) || 0;
  }
}

