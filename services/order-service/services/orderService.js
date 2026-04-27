/**
 * Order Service Layer — Business Logic
 * 
 * ─── CLEAN ARCHITECTURE ───────────────────────────────────────────────────
 * This service layer separates business logic from the HTTP controller.
 * Controllers handle request/response only; this layer handles:
 *   - Price verification via synchronous REST calls to Product Service
 *   - Order persistence to MongoDB
 *   - Event publishing to Redis for async stock updates
 * 
 * ─── INTER-SERVICE COMMUNICATION ──────────────────────────────────────────
 * This file demonstrates BOTH communication patterns:
 *   1. Synchronous (REST): fetchVerifiedProducts() calls Product Service
 *      to verify prices before saving the order. Uses retry + timeout.
 *   2. Asynchronous (Events): After saving, publishes an ORDER_PLACED
 *      event to Redis so Product Service can update stock independently.
 * 
 * ─── LOOSE COUPLING ──────────────────────────────────────────────────────
 * The Order Service does NOT access the Product or User database directly.
 * All cross-service data is fetched via REST APIs, maintaining strict
 * service boundaries and data ownership.
 */

import Order from '../models/orderModel.js';
import { calcPrices } from '../utils/calcPrices.js';
import { fetchWithRetry } from '../utils/httpClient.js';
import { publishEvent } from '../events/eventBus.js';
import logger from '../utils/logger.js';

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:5002';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:5001';

/**
 * Fetch verified product prices from the Product Service
 */
export const fetchVerifiedProducts = async (productIds) => {
  const products = [];

  for (const id of productIds) {
    const response = await fetchWithRetry(
      `${PRODUCT_SERVICE_URL}/api/products/${id}`,
      {},
      { serviceName: 'product-service', timeout: 5000, retries: 2 }
    );

    if (response && response.ok) {
      products.push(await response.json());
    } else {
      logger.warn('Could not verify product price', { productId: id });
    }
  }

  return products;
};

/**
 * Fetch user details from User Service
 */
export const fetchUserDetails = async (userId, jwtCookie) => {
  const response = await fetchWithRetry(
    `${USER_SERVICE_URL}/api/users/${userId}`,
    { headers: { Cookie: `jwt=${jwtCookie}` } },
    { serviceName: 'user-service', timeout: 3000, retries: 2 }
  );

  if (response && response.ok) {
    return response.json();
  }
  return null;
};

/**
 * Create a new order with server-side price verification
 */
export const createOrder = async ({ orderItems, shippingAddress, paymentMethod, userId }) => {
  // Fetch verified prices from Product Service (sync inter-service call)
  const productIds = orderItems.map((x) => x._id);
  const verifiedProducts = await fetchVerifiedProducts(productIds);

  // Map client items to verified server-side prices
  const dbOrderItems = orderItems.map((clientItem) => {
    const verified = verifiedProducts.find(
      (p) => p._id.toString() === clientItem._id
    );
    return {
      ...clientItem,
      product: clientItem._id,
      price: verified ? verified.price : clientItem.price,
      _id: undefined,
    };
  });

  const { itemsPrice, taxPrice, shippingPrice, totalPrice } = calcPrices(dbOrderItems);

  const order = new Order({
    orderItems: dbOrderItems,
    user: userId,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  });

  const createdOrder = await order.save();

  logger.info('Order created', {
    orderId: createdOrder._id,
    userId,
    totalPrice: createdOrder.totalPrice,
    itemCount: dbOrderItems.length,
  });

  // Publish ORDER_PLACED event asynchronously (fire-and-forget)
  publishEvent('ORDER_PLACED', {
    eventType: 'ORDER_PLACED',
    eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    orderId: createdOrder._id,
    userId,
    orderItems: dbOrderItems.map((item) => ({
      product: item.product,
      qty: item.qty,
      name: item.name,
    })),
    totalPrice: createdOrder.totalPrice,
    timestamp: new Date().toISOString(),
  }).catch((err) => {
    logger.error('Failed to publish ORDER_PLACED event', { error: err.message });
  });

  return createdOrder;
};

/**
 * Get an order by ID, enriching with user data from User Service
 */
export const getOrderWithUser = async (orderId, jwtCookie) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  const orderObj = order.toObject();

  // Enrich with user data from User Service (graceful degradation)
  const userData = await fetchUserDetails(order.user, jwtCookie);
  if (userData) {
    orderObj.user = { _id: userData._id, name: userData.name, email: userData.email };
  }

  return orderObj;
};

/**
 * Get all orders for a specific user
 */
export const getUserOrders = async (userId) => {
  return Order.find({ user: userId });
};

/**
 * Get all orders (admin), enriched with user names
 */
export const getAllOrders = async (jwtCookie) => {
  const orders = await Order.find({});

  const enriched = await Promise.all(
    orders.map(async (order) => {
      const obj = order.toObject();
      const userData = await fetchUserDetails(order.user, jwtCookie);
      obj.user = userData
        ? { _id: userData._id, name: userData.name }
        : { _id: order.user, name: 'Unknown' };
      return obj;
    })
  );

  return enriched;
};

/**
 * Mark order as paid
 */
export const markOrderPaid = async (orderId, paymentResult) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  order.isPaid = true;
  order.paidAt = Date.now();
  order.paymentResult = paymentResult;

  const updated = await order.save();
  logger.info('Order marked as paid', { orderId, paymentId: paymentResult.id });
  return updated;
};

/**
 * Mark order as delivered
 */
export const markOrderDelivered = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updated = await order.save();
  logger.info('Order marked as delivered', { orderId });
  return updated;
};
