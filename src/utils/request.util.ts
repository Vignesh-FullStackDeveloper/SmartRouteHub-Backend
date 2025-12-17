/**
 * Request utility functions
 */

/**
 * Extract data from request body wrapped in 'data' object
 * @param body Request body
 * @returns The data object
 * @throws Error if data is missing
 */
export function extractRequestBodyData(body: any): any {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be an object');
  }
  if (!body.data || typeof body.data !== 'object') {
    throw new Error('Request body must contain a "data" object');
  }
  return body.data;
}

