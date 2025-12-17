import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DriverService } from '../services/driver.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';
import { sendSuccess, sendError, parsePagination, getPaginationMeta } from '../utils/response.util';
import { logger } from '../config/logger';
import { extractRequestBodyData } from '../utils/request.util';
import { commonSchemas, commonResponses } from '../schemas/common.schemas';
import { driverSchemas } from '../schemas/driver.schemas';
import { sendErrorResponse } from '../utils/error-handler.util';

const createDriverSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  driver_id: z.string().min(1),
});

const updateDriverSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  driver_id: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  assigned_bus_id: z.string().uuid().optional(),
  assigned_route_id: z.string().uuid().optional(),
});

export async function driversRoutes(fastify: FastifyInstance) {
  const driverService = new DriverService();

  // Create driver
  fastify.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create a new driver user. Requires user:create permission. Driver ID must be unique within the organization.',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
        summary: 'Create driver',
        body: driverSchemas.CreateDriverRequest,
        response: {
          201: {
            description: 'Driver created successfully',
            content: {
              'application/json': {
                schema: driverSchemas.Driver,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          409: {
            description: 'Conflict - Email or driver ID already exists',
            content: {
              'application/json': {
                schema: commonSchemas.ErrorResponse,
              },
            },
          },
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        if (!hasPermission(user, PERMISSIONS.USER.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const bodyData = extractRequestBodyData(request.body);
        const data = createDriverSchema.parse(bodyData);
        const driver = await driverService.create(data, user.organization_id);
        reply.code(201).send(driver);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get all drivers
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all drivers',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            driver_id: { type: 'string', format: 'uuid', description: 'Filter by driver ID' },
            bus_id: { type: 'string', format: 'uuid', description: 'Filter by bus ID (hierarchy: bus -> driver)' },
            student_id: { type: 'string', format: 'uuid', description: 'Filter by student ID (hierarchy: student -> bus -> driver)' },
            route_id: { type: 'string', format: 'uuid', description: 'Filter by route ID (hierarchy: route -> bus -> driver)' },
            is_active: { type: 'boolean', description: 'Filter by active status' },
            has_bus: { type: 'boolean', description: 'Filter by whether driver has bus assigned' },
            limit: { type: 'number', minimum: 1, description: 'Number of records to return (optional)' },
            offset: { type: 'number', minimum: 0, description: 'Number of records to skip (optional)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                    driver_id: { type: 'string' },
                    organization_id: { type: 'string' },
                    is_active: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
              pagination: {
                type: 'object',
                nullable: true,
                properties: {
                  total: { type: 'number' },
                  limit: { type: 'number' },
                  offset: { type: 'number' },
                  hasMore: { type: 'boolean' },
                },
              },
              message: { type: 'string', nullable: true },
            },
          },
          400: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' }, details: { type: 'object' } } },
          403: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
          500: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const query = request.query as any;
        
        // Parse pagination
        let pagination;
        try {
          pagination = parsePagination(query);
        } catch (error: any) {
          logger.warn({ message: 'Invalid pagination parameters', error: error.message, userId: user.id });
          return sendError(reply, 400, error.message);
        }

        // Build basic filters
        const basicFilters: any = {
          ...pagination,
        };
        if (query.driver_id) basicFilters.driver_id = query.driver_id;
        if (query.is_active !== undefined) basicFilters.is_active = query.is_active === 'true' || query.is_active === true;
        if (query.has_bus !== undefined) basicFilters.has_bus = query.has_bus === 'true' || query.has_bus === true;

        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.USER.GET_ALL) || user.role === 'admin') {
          // Admin role: use micro functions based on query params
          let result;
          
          if (query.bus_id) {
            // Use micro function: getByBusId
            result = await driverService.getByBusId(query.bus_id, user.organization_id!);
          } else if (query.student_id) {
            // Use micro function: getByStudentId (uses bus internally)
            result = await driverService.getByStudentId(query.student_id, user.organization_id!);
          } else if (query.route_id) {
            // Use micro function: getByRouteId (uses bus internally)
            result = await driverService.getByRouteId(query.route_id, user.organization_id!);
          } else {
            // Use basic getAll
            result = await driverService.getAll(user.organization_id!, basicFilters);
          }
          
          const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
          logger.info({ 
            message: 'Drivers retrieved', 
            userId: user.id, 
            role: user.role, 
            count: result.data.length,
            total: result.total 
          });
          return sendSuccess(reply, result.data, 'Drivers retrieved successfully', paginationMeta);
        }
        
        if (hasPermission(user, PERMISSIONS.USER.GET)) {
          // Restricted: return filtered dataset (e.g., only own driver info if user is a driver)
          if (user.role === 'driver') {
            basicFilters.driver_id = user.id;
            const result = await driverService.getAll(user.organization_id!, basicFilters);
            const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
            logger.info({ 
              message: 'Driver info retrieved', 
              userId: user.id, 
              count: result.data.length 
            });
            return sendSuccess(reply, result.data, 'Driver retrieved successfully', paginationMeta);
          }
          // For other roles with GET permission, return empty
          return sendSuccess(reply, [], 'No drivers found', getPaginationMeta(0, pagination.limit, pagination.offset));
        }
        
        logger.warn({ message: 'Insufficient permissions to get drivers', userId: user.id, role: user.role });
        return sendError(reply, 403, 'Forbidden: Insufficient permissions');
      } catch (error: any) {
        logger.error({ 
          message: 'Error retrieving drivers', 
          error: error.message, 
          stack: error.stack,
          userId: (request.user as JWTUser)?.id 
        });
        return sendError(reply, 500, 'Internal server error', error.message);
      }
    }
  );

  // Get driver by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get driver by ID',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.USER.GET_ALL)) {
          // Highest level: can get any driver
          const params = request.params as { id: string };
          const driver = await driverService.getById(params.id, user.organization_id!);
          return reply.send(driver);
        }
        
        if (hasPermission(user, PERMISSIONS.USER.GET)) {
          // Restricted: can only get own driver info
          const params = request.params as { id: string };
          if (user.role === 'driver' && params.id === user.id) {
            const driver = await driverService.getById(params.id, user.organization_id!);
            return reply.send(driver);
          }
          return reply.code(403).send({ error: 'Forbidden: Can only access own driver information' });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update driver
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update driver',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            driver_id: { type: 'string' },
            is_active: { type: 'boolean' },
            assigned_bus_id: { type: 'string', format: 'uuid' },
            assigned_route_id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              driver_id: { type: 'string' },
              organization_id: { type: 'string' },
              is_active: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.USER.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        // Additional check: drivers can only update themselves
        const params = request.params as { id: string };
        if (user.role === 'driver' && params.id !== user.id) {
          return reply.code(403).send({ error: 'Forbidden: Can only update own driver information' });
        }

        const bodyData = extractRequestBodyData(request.body);
        const data = updateDriverSchema.parse(bodyData);
        const updated = await driverService.update(
          params.id,
          data,
          user.organization_id!
        );
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get driver schedule (which bus at which time)
  fastify.get(
    '/:id/schedule',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get driver schedule',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.USER.GET_ALL)) {
          // Highest level: can get any driver's schedule
          const params = request.params as { id: string };
          const schedule = await driverService.getSchedule(
            params.id,
            user.organization_id!
          );
          return reply.send(schedule);
        }
        
        if (hasPermission(user, PERMISSIONS.USER.GET)) {
          // Restricted: can only get own schedule
          const params = request.params as { id: string };
          if (user.role === 'driver' && params.id === user.id) {
            const schedule = await driverService.getSchedule(
              params.id,
              user.organization_id!
            );
            return reply.send(schedule);
          }
          return reply.code(403).send({ error: 'Forbidden: Can only access own schedule' });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Delete driver
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Delete driver',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.USER.DELETE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        await driverService.delete(params.id, user.organization_id!);
        reply.send({ message: 'Driver deleted successfully' });
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('assigned to') ? 400 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

