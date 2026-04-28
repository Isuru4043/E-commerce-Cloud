# SmartCarts Microservices E-Commerce Platform

SmartCarts is a cloud-native e-commerce application built with a MERN stack split into microservices. The system uses a React frontend, an API gateway, separate backend services for users, products, and orders, Redis for event messaging, MongoDB Atlas for persistence, Cloudinary for product images, and Azure Container Apps for deployment.

## What’s Included

- React frontend with Redux Toolkit and RTK Query
- API gateway with routing, request logging, rate limiting, and CORS
- User service for authentication and admin/user management
- Product service for catalog, search, stock, image uploads, and reviews
- Order service for checkout, order management, and service-to-service price verification
- Redis pub/sub for asynchronous stock updates after order placement
- Azure Container Registry and Azure Container Apps deployment pipeline

## Feature Highlights

- User registration, login, logout, and profile management
- Admin and customer role separation
- Product listing, search, pagination, product details, and reviews
- Cart management and checkout flow
- Order creation, order history, and admin order management
- Product image upload with Cloudinary
- Redis-backed event flow for asynchronous stock updates
- Production-ready frontend build served through nginx

## Architecture

```text
Browser
  -> Frontend (React / nginx in production)
  -> API Gateway (port 8000)
      -> User Service (port 5001)
      -> Product Service (port 5002)
      -> Order Service (port 5003)
  -> Redis (port 6379) for async events
  -> MongoDB Atlas (separate DBs per service)
```

## Service Overview

| Service | Port | Responsibility |
| --- | --- | --- |
| Frontend | 3000 | SmartCarts UI |
| API Gateway | 8000 | Routes API traffic to backend services |
| User Service | 5001 | Auth, users, roles, profile, admin checks |
| Product Service | 5002 | Products, reviews, uploads, stock, top products |
| Order Service | 5003 | Orders, totals, payment simulation, order history |
| Redis | 6379 | Pub/Sub event bus |

## Data & Integrations

- MongoDB Atlas is split into three logical databases:
  - `user_db`
  - `product_db`
  - `order_db`
- Product images are uploaded to Cloudinary.
- JWT auth is stored in an HTTP-only cookie and forwarded through the gateway.
- Redis is used for `ORDER_PLACED` events so the product service can update stock asynchronously.

## Detailed Service Responsibilities

### API Gateway

- Single entry point for the frontend
- Proxies `/api/users`, `/api/products`, `/api/orders`, and `/api/upload`
- Adds CORS, request IDs, logging, and rate limiting
- Provides `/api/health` for aggregated health checks

### User Service

- Handles registration and authentication
- Issues JWT cookies
- Exposes profile and admin/user endpoints
- Supports admin authorization checks used by other services

### Product Service

- Manages product catalog data
- Supports keyword search and pagination
- Handles product creation, editing, and deletion for admins
- Uploads images to Cloudinary
- Receives order placement events and updates stock

### Order Service

- Creates and manages orders
- Verifies product prices through the product service
- Calculates totals, shipping, tax, and grand total
- Publishes `ORDER_PLACED` events through Redis
- Uses synchronous HTTP calls for user/product lookups instead of direct database access

## Loose Coupling

The services are intentionally decoupled so they do not read each other’s databases directly.

- The order service calls the product service to verify product data and prices.
- The order service calls the user service for user-related checks when needed.
- The product service reacts to `ORDER_PLACED` events through Redis instead of being called directly for stock updates.
- The frontend only talks to the API gateway, not to individual services.

This keeps the system easier to scale, easier to test, and safer to change service by service.

### Frontend

- React SPA built with Create React App
- Uses Redux Toolkit and RTK Query for state/data access
- In production, the app is compiled and served by nginx

## Repository Structure

```text
.
├── frontend/                 # React app
├── services/
│   ├── api-gateway/          # Gateway service
│   ├── user-service/         # Authentication and users
│   ├── product-service/      # Products, uploads, reviews
│   ├── order-service/        # Orders and checkout
│   └── seeder.js             # Seed / cleanup script
├── docker-compose.yml        # Local container stack
├── example.env               # Example root env file
└── README.md
```

## Requirements

- Node.js 18+ recommended
- Docker and Docker Compose
- MongoDB Atlas account or another MongoDB deployment
- Redis instance for local development or Docker Compose
- Cloudinary account for image uploads

## Common API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/users/auth` | Login |
| `POST` | `/api/users` | Register user |
| `GET` | `/api/users/profile` | Current user profile |
| `GET` | `/api/products` | List products |
| `GET` | `/api/products/top` | Top rated products |
| `POST` | `/api/products` | Create product (admin) |
| `PUT` | `/api/products/:id` | Update product (admin) |
| `POST` | `/api/products/:id/reviews` | Create product review |
| `GET` | `/api/orders/:id` | Fetch order by ID |
| `POST` | `/api/orders` | Create order |
| `GET` | `/api/health` | Gateway health check |

## Environment Setup

This repository keeps secrets out of git. Use the example file as a starting point and create your own local env files.

Suggested files:

- `example.env` for root-level values
- `services/user-service/.env.user`
- `services/product-service/.env.product`
- `services/order-service/.env.order`
- `services/api-gateway/.env` for local gateway overrides

Important variables used by the services:

- `USER_MONGO_URI`
- `PRODUCT_MONGO_URI`
- `ORDER_MONGO_URI`
- `JWT_SECRET`
- `REDIS_URL`
- `USER_SERVICE_URL`
- `PRODUCT_SERVICE_URL`
- `ORDER_SERVICE_URL`
- `FRONTEND_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `REACT_APP_API_URL` for frontend production builds

### Root Environment Example

The repository includes `example.env` as a starting point for local development. It should be copied to your own `.env` file and edited with real values.

### Service Environment Files

- `services/user-service/.env.user` sets the user service port and MongoDB URI
- `services/product-service/.env.product` sets the product service port, MongoDB URI, Redis URL, user service URL, and Cloudinary values
- `services/order-service/.env.order` sets the order service port, MongoDB URI, Redis URL, and service URLs
- `services/api-gateway/.env` is used for local gateway overrides during development

## Running Locally with Docker

Recommended for the full stack:

```bash
npm run install:all
npm run docker:up
```

Then open:

- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- Gateway health: http://localhost:8000/api/health

## Access the Application

- Local frontend: http://localhost:3000
- Local API gateway: http://localhost:8000
- Deployed frontend: https://frontend.thankfulmushroom-7e1e12d4.southeastasia.azurecontainerapps.io

Stop the stack with:

```bash
npm run docker:down
```

### Seed Data

To populate the databases with sample users, products, and orders:

```bash
npm run data:import
```

To clear the seeded data:

```bash
npm run data:destroy
```

## Running Services Without Docker

If you want to run services individually for development, start the backend services first, then the gateway, and then the frontend.

```bash
npm run install:all
npm run dev:users
npm run dev:products
npm run dev:orders
npm run dev:gateway
```

If you run the frontend outside Docker, make sure it points to the local gateway URL used in your dev setup.

## Demo Credentials

- Admin: `admin@example.com` / `123456`
- User accounts can be created from the registration page.

## Frontend Scripts

Inside `frontend/`:

```bash
npm run install:all
npm start
npm run build
```

## Backend Scripts

From the repository root:

```bash
npm run dev:gateway
npm run dev:users
npm run dev:products
npm run dev:orders
npm run docker:up
npm run docker:down
```

## CI / CD

### CI workflow

The GitHub Actions CI workflow builds Docker images for all services.

- On `push` to `Dev1` or `main`, images are built and pushed to Azure Container Registry.
- On `pull_request`, the workflow builds only and does not push images.
- The workflow also supports manual `workflow_dispatch` runs.

### CD workflow

The deployment workflow updates Azure Container Apps after a successful CI run.

- Deployments are restricted to `main` only.
- The frontend revision gets a timestamped revision suffix so Azure creates a fresh revision on each deploy.

## Local Development Notes

- The frontend dev server uses `http://localhost:8000` for API requests in local development.
- The production frontend build bakes the API URL at build time through `REACT_APP_API_URL`.
- If you use Docker Compose locally, the frontend is served on port `3000` and the gateway on `8000`.

## Security Notes

- `.env` is ignored and should never be committed.
- If a secret was ever exposed, rotate it immediately:
  - MongoDB credentials
  - JWT secret
  - Redis key
  - Cloudinary secret
  - Azure credentials
  - ACR password
- The gateway uses HTTP-only cookies for auth.
- Protected routes require the JWT cookie to be forwarded with requests.

## Troubleshooting

- If you see a cart crash with `invalid array length`, clear stale cart data in local storage and refresh.
- If the frontend shows stale assets, hard refresh the browser after a new deploy.
- If a protected admin action sends you to sign in, confirm the auth cookie is being sent and that your session is still valid.

## License

This project is intended for academic and demonstration use.
