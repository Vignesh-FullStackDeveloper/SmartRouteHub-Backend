/**
 * Permission constants
 * These represent actions that can be performed on resources
 * Format: RESOURCE_ACTION (e.g., GET_ALL_STUDENT, CREATE_STUDENT)
 * 
 * These map to the database permission names (resource:action format)
 */

// Student permissions
export const GET_ALL_STUDENT = 'student:read';
export const GET_STUDENT = 'student:read';
export const CREATE_STUDENT = 'student:create';
export const UPDATE_STUDENT = 'student:update';
export const DELETE_STUDENT = 'student:delete';

// Bus permissions
export const GET_ALL_BUS = 'bus:read';
export const GET_BUS = 'bus:read';
export const CREATE_BUS = 'bus:create';
export const UPDATE_BUS = 'bus:update';
export const DELETE_BUS = 'bus:delete';

// Route permissions
export const GET_ALL_ROUTE = 'route:read';
export const GET_ROUTE = 'route:read';
export const CREATE_ROUTE = 'route:create';
export const UPDATE_ROUTE = 'route:update';
export const DELETE_ROUTE = 'route:delete';

// Trip permissions
export const GET_ALL_TRIP = 'trip:read';
export const GET_TRIP = 'trip:read';
export const CREATE_TRIP = 'trip:create';
export const UPDATE_TRIP = 'trip:update';
export const DELETE_TRIP = 'trip:delete';

// Location permissions
export const GET_LOCATION = 'location:read';
export const UPDATE_LOCATION = 'location:update';

// Organization permissions
export const GET_ORGANIZATION = 'organization:read';
export const UPDATE_ORGANIZATION = 'organization:update';

// User/Driver permissions
export const GET_ALL_USER = 'user:read';
export const GET_USER = 'user:read';
export const CREATE_USER = 'user:create';
export const UPDATE_USER = 'user:update';
export const DELETE_USER = 'user:delete';

// Permission permissions (Organization Admin only)
export const CREATE_PERMISSION = 'permission:create';
export const GET_PERMISSION = 'permission:read';
export const DELETE_PERMISSION = 'permission:delete';

// Role permissions (Organization Admin only)
export const CREATE_ROLE = 'role:create';
export const GET_ROLE = 'role:read';
export const UPDATE_ROLE = 'role:update';
export const DELETE_ROLE = 'role:delete';

export const PERMISSIONS = {
  STUDENT: {
    GET_ALL: GET_ALL_STUDENT,
    GET: GET_STUDENT,
    CREATE: CREATE_STUDENT,
    UPDATE: UPDATE_STUDENT,
    DELETE: DELETE_STUDENT,
  },
  BUS: {
    GET_ALL: GET_ALL_BUS,
    GET: GET_BUS,
    CREATE: CREATE_BUS,
    UPDATE: UPDATE_BUS,
    DELETE: DELETE_BUS,
  },
  ROUTE: {
    GET_ALL: GET_ALL_ROUTE,
    GET: GET_ROUTE,
    CREATE: CREATE_ROUTE,
    UPDATE: UPDATE_ROUTE,
    DELETE: DELETE_ROUTE,
  },
  TRIP: {
    GET_ALL: GET_ALL_TRIP,
    GET: GET_TRIP,
    CREATE: CREATE_TRIP,
    UPDATE: UPDATE_TRIP,
    DELETE: DELETE_TRIP,
  },
  LOCATION: {
    GET: GET_LOCATION,
    UPDATE: UPDATE_LOCATION,
  },
  ORGANIZATION: {
    GET: GET_ORGANIZATION,
    UPDATE: UPDATE_ORGANIZATION,
  },
  USER: {
    GET_ALL: GET_ALL_USER,
    GET: GET_USER,
    CREATE: CREATE_USER,
    UPDATE: UPDATE_USER,
    DELETE: DELETE_USER,
  },
  PERMISSION: {
    CREATE: CREATE_PERMISSION,
    GET: GET_PERMISSION,
    DELETE: DELETE_PERMISSION,
  },
  ROLE: {
    CREATE: CREATE_ROLE,
    GET: GET_ROLE,
    UPDATE: UPDATE_ROLE,
    DELETE: DELETE_ROLE,
  },
} as const;

