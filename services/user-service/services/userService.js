/**
 * User Service Layer
 * 
 * Separates business logic from the controller layer (Clean Architecture).
 * Controllers handle HTTP request/response; this layer handles business rules.
 */

import User from '../models/userModel.js';
import logger from '../utils/logger.js';

export const findUserByEmail = async (email) => {
  return User.findOne({ email });
};

export const findUserById = async (id, includePassword = false) => {
  const query = User.findById(id);
  return includePassword ? query : query.select('-password');
};

export const createUser = async ({ name, email, password }) => {
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw Object.assign(new Error('User already exists'), { statusCode: 400 });
  }

  const user = await User.create({ name, email, password });
  logger.info('New user registered', { userId: user._id, email });
  return user;
};

export const updateUserById = async (id, updates) => {
  const user = await User.findById(id);
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  user.name = updates.name || user.name;
  user.email = updates.email || user.email;

  if (updates.password) {
    user.password = updates.password;
  }

  if (updates.isAdmin !== undefined) {
    user.isAdmin = Boolean(updates.isAdmin);
  }

  const updatedUser = await user.save();
  logger.info('User updated', { userId: updatedUser._id });
  return updatedUser;
};

export const deleteUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  if (user.isAdmin) {
    throw Object.assign(new Error('Cannot delete admin user'), { statusCode: 400 });
  }

  await User.deleteOne({ _id: user._id });
  logger.info('User deleted', { userId: id });
  return { message: 'User removed' };
};

export const getAllUsers = async () => {
  return User.find({});
};

export const authenticateUser = async (email, password) => {
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    logger.info('User login successful', { userId: user._id, email });
    return user;
  }

  logger.warn('Failed login attempt', { email });
  return null;
};
