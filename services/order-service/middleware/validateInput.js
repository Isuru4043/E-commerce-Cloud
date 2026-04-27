/**
 * Input Validation Middleware for Order Service
 */

// Validate order creation input
export const validateOrder = (req, res, next) => {
  const { orderItems, shippingAddress, paymentMethod } = req.body;
  const errors = [];

  if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
    errors.push('Order must contain at least one item');
  }

  if (!shippingAddress) {
    errors.push('Shipping address is required');
  } else {
    if (!shippingAddress.address) errors.push('Street address is required');
    if (!shippingAddress.city) errors.push('City is required');
    if (!shippingAddress.postalCode) errors.push('Postal code is required');
    if (!shippingAddress.country) errors.push('Country is required');
  }

  if (!paymentMethod || paymentMethod.trim().length === 0) {
    errors.push('Payment method is required');
  }

  if (errors.length > 0) {
    res.status(400);
    throw new Error(errors.join(', '));
  }

  next();
};
