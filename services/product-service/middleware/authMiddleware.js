import jwt from 'jsonwebtoken';
import asyncHandler from './asyncHandler.js';
import { fetchWithRetry } from '../utils/httpClient.js';
import logger from '../utils/logger.js';

// User must be authenticated (JWT verification — no DB call needed)
const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { _id: decoded.userId };
      next();
    } catch (error) {
      logger.warn('JWT verification failed', { error: error.message });
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  } else {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

// Admin check via User Service (inter-service call with retry/timeout)
const admin = asyncHandler(async (req, res, next) => {
  const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:5001';

  const response = await fetchWithRetry(
    `${userServiceUrl}/api/users/profile`,
    { headers: { Cookie: `jwt=${req.cookies.jwt}` } },
    { serviceName: 'user-service', timeout: 3000, retries: 2 }
  );

  if (response && response.ok) {
    const userData = await response.json();
    if (userData.isAdmin) {
      req.user = userData;
      return next();
    }
  }

  logger.warn('Admin authorization failed', { userId: req.user?._id });
  res.status(401);
  throw new Error('Not authorized as an admin');
});

export { protect, admin };
