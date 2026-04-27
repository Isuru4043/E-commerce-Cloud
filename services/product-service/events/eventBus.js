import Redis from 'ioredis';
import logger from '../utils/logger.js';

/**
 * Event Bus — Redis Pub/Sub for asynchronous inter-service communication
 * 
 * ─── LOOSE COUPLING (Cloud-Native Principle) ──────────────────────────────
 * Services communicate via events instead of direct database access.
 * The Order Service publishes an ORDER_PLACED event; the Product Service
 * subscribes and reacts by updating stock. Neither service knows the
 * internal implementation of the other — they are loosely coupled through
 * a shared event contract.
 * 
 * ─── ASYNCHRONOUS COMMUNICATION BENEFITS ──────────────────────────────────
 *   1. Non-blocking: The order response returns immediately; stock updates
 *      happen in the background without slowing down the user experience.
 *   2. Fault tolerance: If the Product Service is temporarily down, the
 *      order is still created. Stock updates can be retried later.
 *   3. Scalability: Multiple Product Service instances can subscribe to
 *      the same channel, distributing the processing load.
 * 
 * Event Schema:
 * {
 *   eventType: string,      // e.g., 'ORDER_PLACED'
 *   eventId: string,        // Unique event identifier for idempotency
 *   data: object,           // Event payload (orderId, items, userId)
 *   timestamp: string,      // ISO 8601 timestamp
 *   source: string,         // Originating service name
 * }
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

let publisher = null;
let subscriber = null;

const createRedisClient = (role) => {
  const client = new Redis(REDIS_URL, {
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error(`Redis ${role}: max retries reached, giving up`);
        return null; // Stop retrying
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis ${role}: retrying connection in ${delay}ms`, { attempt: times });
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('connect', () => {
    logger.info(`Redis ${role} connected`);
  });

  client.on('error', (err) => {
    logger.error(`Redis ${role} error`, { error: err.message });
  });

  client.on('close', () => {
    logger.warn(`Redis ${role} connection closed`);
  });

  return client;
};

export const getPublisher = () => {
  if (!publisher) {
    publisher = createRedisClient('publisher');
  }
  return publisher;
};

export const getSubscriber = () => {
  if (!subscriber) {
    subscriber = createRedisClient('subscriber');
  }
  return subscriber;
};

/**
 * Publish an event to a channel with structured schema
 */
export const publishEvent = async (channel, data) => {
  try {
    const pub = getPublisher();
    const event = {
      eventType: channel,
      eventId: data.eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data,
      source: process.env.SERVICE_NAME || 'unknown',
      timestamp: new Date().toISOString(),
    };
    await pub.publish(channel, JSON.stringify(event));
    logger.info(`Event published to [${channel}]`, {
      eventId: event.eventId,
      channel,
    });
  } catch (error) {
    logger.error(`Failed to publish event to [${channel}]`, { error: error.message });
    // Don't throw — event publishing should not break the main flow
  }
};

/**
 * Subscribe to an event channel with error-resilient handler
 */
export const subscribeToEvent = async (channel, handler) => {
  try {
    const sub = getSubscriber();
    await sub.subscribe(channel);

    sub.on('message', async (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const event = JSON.parse(message);
          logger.info(`Event received on [${channel}]`, {
            eventId: event.eventId,
            source: event.source,
          });
          await handler(event.data);
        } catch (error) {
          logger.error(`Error processing event on [${channel}]`, {
            error: error.message,
            rawMessage: message.substring(0, 200),
          });
          // Don't re-throw — prevent subscriber from crashing
        }
      }
    });

    logger.info(`Subscribed to event channel: [${channel}]`);
  } catch (error) {
    logger.error(`Failed to subscribe to [${channel}]`, { error: error.message });
  }
};
