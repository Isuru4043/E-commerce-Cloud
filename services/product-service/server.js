import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import cors from 'cors';
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { subscribeToEvents } from './events/subscriber.js';
import logger from './utils/logger.js';

dotenv.config();

// Set service name for structured logging
process.env.SERVICE_NAME = 'product-service';

const port = process.env.PORT || 5002;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ─── Static Files for Uploads ───────────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    service: 'product-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Product Service is running' });
});

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
  logger.info(`Product Service running on port ${port}`, { port });

  // Subscribe to async events (ORDER_PLACED → update stock)
  subscribeToEvents();
});
