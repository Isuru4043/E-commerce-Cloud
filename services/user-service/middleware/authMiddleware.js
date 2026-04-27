import jwt from 'jsonwebtoken';
import asyncHandler from './asyncHandler.js';
import User from '../models/userModel.js';

/**
 * Authentication Middleware — JWT-based stateless authentication
 * 
 * ─── SECURITY NOTE ────────────────────────────────────────────────────────
 * JWTs are stored in HTTP-only cookies instead of localStorage. This is a
 * critical security practice because:
 *   1. HTTP-only cookies CANNOT be read by JavaScript (prevents XSS attacks)
 *   2. Cookies are automatically sent with every request (no manual headers)
 *   3. The 'Secure' flag ensures cookies are only sent over HTTPS
 * 
 * Each microservice independently verifies the JWT using a shared secret
 * (JWT_SECRET). This means services do NOT need to call the User Service
 * for basic authentication — enabling truly stateless, scalable services.
 * 
 * ─── ROLE-BASED ACCESS CONTROL (RBAC) ────────────────────────────────────
 * The `admin` middleware checks the user's `isAdmin` flag from the database.
 * This ensures admin-only routes (delete user, manage orders) are protected.
 */

// User must be authenticated
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Read JWT from the 'jwt' cookie
  token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.userId).select('-password');

      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  } else {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

// User must be an admin (Role-Based Access Control)
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
};

export { protect, admin };
