/**
 * HTTP Client with Retry and Timeout
 * 
 * Provides resilient inter-service HTTP communication with:
 * - Configurable timeout (prevents hanging requests)
 * - Automatic retry with exponential backoff (handles transient failures)
 * - Graceful error handling (circuit-breaker-like behavior)
 * 
 * This is a key cloud-native pattern for service-to-service communication.
 */

import logger from './logger.js';

const DEFAULT_TIMEOUT = 5000;  // 5 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF = 300;   // 300ms initial backoff

/**
 * Make an HTTP request with retry and timeout logic
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @param {object} config - Retry/timeout configuration
 * @returns {Promise<Response>} The fetch response
 */
export const fetchWithRetry = async (url, options = {}, config = {}) => {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    backoff = DEFAULT_BACKOFF,
    serviceName = 'unknown',
  } = config;

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        logger.debug(`HTTP request succeeded`, {
          url,
          attempt,
          status: response.status,
          targetService: serviceName,
        });
        return response;
      }

      // Don't retry on client errors (4xx), only on server errors (5xx)
      if (response.status < 500) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      logger.warn(`HTTP request failed with ${response.status}, attempt ${attempt}/${retries}`, {
        url,
        status: response.status,
        targetService: serviceName,
      });
    } catch (error) {
      lastError = error;

      if (error.name === 'AbortError') {
        logger.warn(`HTTP request timed out after ${timeout}ms, attempt ${attempt}/${retries}`, {
          url,
          timeout,
          targetService: serviceName,
        });
      } else {
        logger.warn(`HTTP request error, attempt ${attempt}/${retries}`, {
          url,
          error: error.message,
          targetService: serviceName,
        });
      }
    }

    // Wait before retrying (exponential backoff)
    if (attempt < retries) {
      const delay = backoff * Math.pow(2, attempt - 1);
      logger.debug(`Retrying in ${delay}ms...`, { url, attempt });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  logger.error(`HTTP request failed after ${retries} attempts`, {
    url,
    error: lastError?.message,
    targetService: serviceName,
  });

  return null; // Return null to allow graceful degradation
};

/**
 * Convenience method: GET with retry
 */
export const getWithRetry = (url, headers = {}, config = {}) =>
  fetchWithRetry(url, { method: 'GET', headers }, config);

/**
 * Convenience method: POST with retry
 */
export const postWithRetry = (url, body, headers = {}, config = {}) =>
  fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    config
  );
