import Redis from 'ioredis';
import logger from '../utils/logger.js';

/**
 * Event Bus Publisher for Order Service
 * 
 * Publishes events to Redis channels. The Order Service is an
 * event producer — it publishes ORDER_PLACED events that the
 * Product Service subscribes to asynchronously.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

let publisher = null;

const createPublisher = () => {
  const client = new Redis(REDIS_URL, {
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis publisher: max retries reached, giving up');
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis publisher: retrying in ${delay}ms`, { attempt: times });
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('connect', () => logger.info('Redis publisher connected'));
  client.on('error', (err) => logger.error('Redis publisher error', { error: err.message }));
  client.on('close', () => logger.warn('Redis publisher connection closed'));

  return client;
};

export const getPublisher = () => {
  if (!publisher) {
    publisher = createPublisher();
  }
  return publisher;
};

/**
 * Publish a structured event to a channel
 */
export const publishEvent = async (channel, data) => {
  try {
    const pub = getPublisher();
    const event = {
      eventType: channel,
      eventId: data.eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data,
      source: process.env.SERVICE_NAME || 'order-service',
      timestamp: new Date().toISOString(),
    };
    await pub.publish(channel, JSON.stringify(event));
    logger.info(`Event published to [${channel}]`, {
      eventId: event.eventId,
      channel,
    });
  } catch (error) {
    logger.error(`Failed to publish event to [${channel}]`, { error: error.message });
    // Don't throw — event publishing should not break the main order flow
  }
};
