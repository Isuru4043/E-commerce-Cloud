/**
 * ProShop API Gateway
 * 
 * ─── ARCHITECTURE NOTE ────────────────────────────────────────────────────
 * This is the API Gateway pattern — a single entry point for all client
 * requests. The gateway routes traffic to the appropriate microservice
 * based on URL path, eliminating the need for the frontend to know about
 * individual service addresses.
 * 
 * ─── HIGH AVAILABILITY ────────────────────────────────────────────────────
 * Docker Compose demonstrates HA conceptually using restart policies
 * (restart: on-failure). In a real production environment, a container
 * orchestrator like Kubernetes would manage rolling updates, pod
 * scheduling, and automatic failover across nodes.
 * 
 * ─── SCALABILITY ──────────────────────────────────────────────────────────
 * The gateway itself can be horizontally scaled behind a load balancer
 * (e.g., nginx or cloud ALB). Each backend microservice can also be
 * scaled independently using: docker-compose up --scale product-service=3
 * 
 * Implements:
 * - Reverse proxy routing to microservices
 * - Cookie forwarding for JWT authentication
 * - Rate limiting (100 requests/minute per IP)
 * - Request logging with unique request IDs for distributed tracing
 * - Aggregated health check endpoint
 * - CORS configuration
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import cors from 'cors';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// ─── Structured Logger ─────────────────────────────────────────────────────
const log = {
  info: (msg, meta = {}) => console.log(JSON.stringify({
    timestamp: new Date().toISOString(), service: 'api-gateway', level: 'INFO', message: msg, ...meta,
  })),
  warn: (msg, meta = {}) => console.warn(JSON.stringify({
    timestamp: new Date().toISOString(), service: 'api-gateway', level: 'WARN', message: msg, ...meta,
  })),
  error: (msg, meta = {}) => console.error(JSON.stringify({
    timestamp: new Date().toISOString(), service: 'api-gateway', level: 'ERROR', message: msg, ...meta,
  })),
};

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ─── Request ID Middleware ──────────────────────────────────────────────────
// Assigns a unique ID to every request for distributed tracing
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ─── Request Logging ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log.info(`${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      requestId: req.requestId,
      ip: req.ip,
    });
  });
  next();
});

// ─── Rate Limiting (Simple In-Memory) ───────────────────────────────────────
// NOTE: In production, use Redis-backed rate limiting for multi-instance support
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100;          // 100 requests per minute per IP

const rateLimiter = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const record = rateLimitStore.get(ip);

  if (now > record.resetTime) {
    // Window expired, reset
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }

  record.count++;

  if (record.count > RATE_LIMIT_MAX) {
    log.warn('Rate limit exceeded', { ip, count: record.count });
    return res.status(429).json({
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX - record.count);

  next();
};

app.use(rateLimiter);

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ─── Service URLs (Docker service names for containerized deployment) ──────
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:5001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:5002';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:5003';

// ─── Proxy Options Factory ─────────────────────────────────────────────────
const createProxyOptions = (target, serviceName) => ({
  target,
  changeOrigin: true,
  // Forward cookies for JWT authentication
  cookieDomainRewrite: '',
  // Timeout: 30 seconds for proxy connections
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req) => {
    // Forward the cookie header
    if (req.headers.cookie) {
      proxyReq.setHeader('Cookie', req.headers.cookie);
    }
    // Forward request ID for distributed tracing
    proxyReq.setHeader('X-Request-Id', req.requestId || '');
  },
  onProxyRes: (proxyRes, req) => {
    log.info(`Proxy response from ${serviceName}`, {
      status: proxyRes.statusCode,
      targetService: serviceName,
      requestId: req.requestId,
    });
  },
  onError: (err, req, res) => {
    log.error(`Proxy error: ${serviceName} unavailable`, {
      error: err.message,
      targetService: serviceName,
      requestId: req.requestId,
    });
    if (!res.headersSent) {
      res.status(503).json({
        message: `${serviceName} is currently unavailable. Please try again later.`,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  },
});

// ─── Route Proxies ──────────────────────────────────────────────────────────

// User Service routes
app.use(
  '/api/users',
  createProxyMiddleware(createProxyOptions(USER_SERVICE_URL, 'User Service'))
);

// Product Service routes
app.use(
  '/api/products',
  createProxyMiddleware(createProxyOptions(PRODUCT_SERVICE_URL, 'Product Service'))
);

// Upload routes → Product Service
app.use(
  '/api/upload',
  createProxyMiddleware(createProxyOptions(PRODUCT_SERVICE_URL, 'Product Service (Upload)'))
);

// Order Service routes
app.use(
  '/api/orders',
  createProxyMiddleware(createProxyOptions(ORDER_SERVICE_URL, 'Order Service'))
);



// ─── Health Check (Aggregated) ──────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const checkService = async (name, url) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${url}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      return { name, status: response.ok ? 'healthy' : 'unhealthy', uptime: data.uptime };
    } catch {
      return { name, status: 'unreachable' };
    }
  };

  const services = await Promise.all([
    checkService('user-service', USER_SERVICE_URL),
    checkService('product-service', PRODUCT_SERVICE_URL),
    checkService('order-service', ORDER_SERVICE_URL),
  ]);

  const allHealthy = services.every((s) => s.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    gateway: 'healthy',
    uptime: process.uptime(),
    services,
    timestamp: new Date().toISOString(),
  });
});

// ─── Gateway Info ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'ProShop API Gateway',
    version: '2.0.0',
    services: {
      users: '/api/users',
      products: '/api/products',
      orders: '/api/orders',
      health: '/api/health',
    },
  });
});

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found on gateway` });
});

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  log.info(`API Gateway running on port ${PORT}`, {
    port: PORT,
    userService: USER_SERVICE_URL,
    productService: PRODUCT_SERVICE_URL,
    orderService: ORDER_SERVICE_URL,
  });
});
