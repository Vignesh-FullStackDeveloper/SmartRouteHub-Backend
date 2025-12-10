import { logger } from '../config/logger';

import { appConfig } from '../config';

export class MapsService {
  private apiKey: string;

  constructor() {
    this.apiKey = appConfig.googleMaps.apiKey;
    if (!this.apiKey) {
      logger.warn('Google Maps API key not configured');
    }
  }

  async calculateRoute(data: {
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    waypoints?: Array<{ latitude: number; longitude: number }>;
  }): Promise<{
    distance_km: number;
    duration_minutes: number;
    polyline: string;
    steps: Array<{
      distance_km: number;
      duration_minutes: number;
      instruction: string;
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
    }>;
  }> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    // Build waypoints string
    let waypoints = '';
    if (data.waypoints && data.waypoints.length > 0) {
      waypoints = '&waypoints=' + data.waypoints
        .map((wp) => `${wp.latitude},${wp.longitude}`)
        .join('|');
    }

    const origin = `${data.origin.latitude},${data.origin.longitude}`;
    const destination = `${data.destination.latitude},${data.destination.longitude}`;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypoints}&key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.status !== 'OK') {
        logger.error({ error: result.error_message, status: result.status });
        throw new Error(result.error_message || 'Route calculation failed');
      }

      const route = result.routes[0];
      const leg = route.legs[0];

      return {
        distance_km: leg.distance.value / 1000,
        duration_minutes: Math.round(leg.duration.value / 60),
        polyline: route.overview_polyline.points,
        steps: leg.steps.map((step: any) => ({
          distance_km: step.distance.value / 1000,
          duration_minutes: Math.round(step.duration.value / 60),
          instruction: step.html_instructions,
          start_location: step.start_location,
          end_location: step.end_location,
        })),
      };
    } catch (error: any) {
      logger.error({ error: error.message, url });
      throw new Error(`Route calculation failed: ${error.message}`);
    }
  }

  async geocode(address: string): Promise<{
    address: string;
    latitude: number;
    longitude: number;
    place_id: string;
  }> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.status !== 'OK') {
        logger.error({ error: result.error_message, status: result.status });
        throw new Error(result.error_message || 'Geocoding failed');
      }

      const location = result.results[0].geometry.location;

      return {
        address: result.results[0].formatted_address,
        latitude: location.lat,
        longitude: location.lng,
        place_id: result.results[0].place_id,
      };
    } catch (error: any) {
      logger.error({ error: error.message, url });
      throw new Error(`Geocoding failed: ${error.message}`);
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<{
    address: string;
    place_id: string;
    components: any[];
  }> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.status !== 'OK') {
        logger.error({ error: result.error_message, status: result.status });
        throw new Error(result.error_message || 'Reverse geocoding failed');
      }

      return {
        address: result.results[0].formatted_address,
        place_id: result.results[0].place_id,
        components: result.results[0].address_components,
      };
    } catch (error: any) {
      logger.error({ error: error.message, url });
      throw new Error(`Reverse geocoding failed: ${error.message}`);
    }
  }
}

