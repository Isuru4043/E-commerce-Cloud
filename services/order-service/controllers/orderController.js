/**
 * Order Controller
 * 
 * Thin controller layer — delegates business logic to the service layer.
 */

import asyncHandler from '../middleware/asyncHandler.js';
import Order from '../models/orderModel.js';
import * as orderService from '../services/orderService.js';
import logger from '../utils/logger.js';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod } = req.body;

  const createdOrder = await orderService.createOrder({
    orderItems,
    shippingAddress,
    paymentMethod,
    userId: req.user._id,
  });

  res.status(201).json(createdOrder);
});

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getUserOrders(req.user._id);
  res.json(orders);
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderWithUser(
    req.params.id,
    req.cookies.jwt
  );
  res.json(order);
});

// @desc    Update order to paid (Simulated)
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Simulate successful payment processing
  const simulatedPaymentResult = {
    id: `sim_${Date.now()}`,
    status: 'COMPLETED',
    update_time: new Date().toISOString(),
    email_address: req.user.email,
  };

  const updatedOrder = await orderService.markOrderPaid(req.params.id, simulatedPaymentResult);

  res.json(updatedOrder);
});

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = asyncHandler(async (req, res) => {
  const updatedOrder = await orderService.markOrderDelivered(req.params.id);
  res.json(updatedOrder);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getAllOrders(req.cookies.jwt);
  res.json(orders);
});

export {
  addOrderItems,
  getMyOrders,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getOrders,
};
