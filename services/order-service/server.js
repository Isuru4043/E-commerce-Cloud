import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import cors from 'cors';
import connectDB from './config/db.js';
import orderRoutes from './routes/orderRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import logger from './utils/logger.js';

dotenv.config();

// Set service name for structured logging
process.env.SERVICE_NAME = 'order-service';

const port = process.env.PORT || 5003;

connectDB();

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Request Logging ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.request(req);
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/orders', orderRoutes);


// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    service: 'order-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Order Service is running' });
});

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
  logger.info(`Order Service running on port ${port}`, { port });
});
