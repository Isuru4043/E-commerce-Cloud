import { subscribeToEvent } from './eventBus.js';
import * as productService from '../services/productService.js';
import logger from '../utils/logger.js';

/**
 * Event Subscriber for Product Service
 * 
 * Subscribes to async events from other services:
 * - ORDER_PLACED: When a new order is created, update product stock counts
 * 
 * This demonstrates the event-driven architecture pattern where services
 * communicate asynchronously through an event bus (Redis Pub/Sub).
 */

const handleOrderPlaced = async (eventData) => {
  const { orderItems, orderId, eventId } = eventData;

  if (!orderItems || orderItems.length === 0) {
    logger.warn('ORDER_PLACED event received but no order items found', { eventId });
    return;
  }

  logger.info(`Processing stock update for ${orderItems.length} items`, {
    orderId,
    eventId,
    itemCount: orderItems.length,
  });

  let successCount = 0;
  let failCount = 0;

  for (const item of orderItems) {
    try {
      const updated = await productService.updateProductStock(item.product, item.qty);
      if (updated) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
      logger.error(`Failed to update stock for product ${item.product}`, {
        error: error.message,
        productId: item.product,
        orderId,
      });
    }
  }

  logger.info('Stock update completed', {
    orderId,
    eventId,
    successCount,
    failCount,
    totalItems: orderItems.length,
  });
};

export const subscribeToEvents = () => {
  logger.info('Initializing event subscriptions...');
  subscribeToEvent('ORDER_PLACED', handleOrderPlaced);
};
