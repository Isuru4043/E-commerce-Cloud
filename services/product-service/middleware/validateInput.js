/**
 * Input Validation Middleware for Product Service
 */

import { isValidObjectId } from 'mongoose';

// Validate product creation/update input
export const validateProduct = (req, res, next) => {
  const { name, price, brand, category, description } = req.body;
  const errors = [];

  if (req.method === 'PUT') {
    if (name !== undefined && name.trim().length === 0) {
      errors.push('Product name cannot be empty');
    }
    if (price !== undefined && (isNaN(price) || price < 0)) {
      errors.push('Price must be a positive number');
    }
  }

  if (errors.length > 0) {
    res.status(400);
    throw new Error(errors.join(', '));
  }

  next();
};

// Validate MongoDB ObjectId parameter
export const validateObjectId = (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404);
    throw new Error(`Invalid ObjectId: ${req.params.id}`);
  }
  next();
};
