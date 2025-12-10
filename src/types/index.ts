export interface User {
  id: string;
  organization_id: string | null; // null for superadmin
  email: string;
  phone?: string;
  name: string;
  role: 'superadmin' | 'admin' | 'driver' | 'parent';
  driver_id?: string;
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  primary_color: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Bus {
  id: string;
  organization_id: string;
  bus_number: string;
  capacity: number;
  driver_id?: string;
  assigned_route_id?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Student {
  id: string;
  organization_id: string;
  name: string;
  class_grade: string;
  section: string;
  parent_id: string;
  parent_contact: string;
  pickup_point_id?: string;
  assigned_bus_id?: string;
  assigned_route_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Route {
  id: string;
  organization_id: string;
  name: string;
  start_time: string;
  end_time: string;
  estimated_duration_minutes?: number;
  total_distance_km?: number;
  assigned_bus_id?: string;
  is_active: boolean;
  route_polyline?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Stop {
  id: string;
  route_id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  estimated_arrival_minutes?: number;
  address?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Trip {
  id: string;
  organization_id: string;
  bus_id: string;
  route_id: string;
  driver_id: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  start_time?: Date;
  end_time?: Date;
  current_latitude?: number;
  current_longitude?: number;
  speed_kmh?: number;
  last_update_time?: Date;
  passenger_count: number;
  location_history?: Array<{
    latitude: number;
    longitude: number;
    timestamp: Date;
  }>;
  created_at: Date;
  updated_at: Date;
}

export interface LocationTracking {
  id: string;
  trip_id: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  heading?: number;
  accuracy?: number;
  recorded_at: Date;
}

export interface JWTUser {
  id: string;
  organization_id: string | null; // null for superadmin
  email: string;
  role: 'superadmin' | 'admin' | 'driver' | 'parent';
}

export interface Subscription {
  id: string;
  student_id: string;
  organization_id: string;
  valid_from: Date;
  valid_until: Date;
  status: 'active' | 'expired' | 'cancelled';
  amount_paid?: number;
  payment_method?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

