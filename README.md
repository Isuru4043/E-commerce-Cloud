# ProShop — Cloud-Native Microservices E-Commerce Platform

> A MERN stack e-commerce application refactored from a monolithic architecture
> into a cloud-native microservices system. Built for an academic cloud computing
> project demonstrating microservices decomposition, inter-service communication,
> event-driven architecture, containerization, and scalability.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Services Overview](#services-overview)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)
- [Communication Methods](#communication-methods)
- [Event-Driven Architecture](#event-driven-architecture)
- [Security](#security)
- [Cloud-Native Design Patterns](#cloud-native-design-patterns)
- [Ports & Services](#ports--services)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)

---

## System Architecture

```
                       ┌──────────────┐
                       │   Frontend   │
                       │  (React.js)  │
                       │  Port: 3000  │
                       └──────┬───────┘
                              │
                   ┌──────────▼──────────┐
                   │    API Gateway      │
                   │    Port: 8000       │
                   │  ┌───────────────┐  │
                   │  │  Rate Limiter │  │
                   │  │  Request IDs  │  │
                   │  │  CORS / Logs  │  │
                   │  └───────────────┘  │
                   └──┬───────┬────────┬─┘
                      │       │        │
         ┌────────────┘       │        └────────────┐
         │                    │                     │
  ┌──────▼──────┐     ┌──────▼──────┐      ┌───────▼─────┐
  │    User     │     │   Product   │      │    Order    │
  │   Service   │     │   Service   │      │   Service   │
  │  Port: 5001 │     │  Port: 5002 │      │  Port: 5003 │
  └──────┬──────┘     └──┬─────┬────┘      └──┬────┬─────┘
         │               │     │               │    │
         │               │     │       ┌───────┘    │
         │               │     │       │            │
  ┌──────▼───────────────▼─┐   │  ┌────▼────────────▼──┐
  │       MongoDB          │   │  │   Redis Event Bus  │
  │  (Shared Instance)     │   │  │    Port: 6379      │
  │                        │   │  │                    │
  │  ┌──────┐ ┌────────┐  │   │  │  ORDER_PLACED ──►  │
  │  │users │ │products│  │   │  │  (Pub/Sub Channel)  │
  │  └──────┘ └────────┘  │   │  └────────────────────┘
  │  ┌──────┐              │   │
  │  │orders│              │   │
  │  └──────┘              │   │
  └────────────────────────┘   │
                               │
              Subscribe ◄──────┘
         (Update Stock Counts)
```

---

## Services Overview

| Service | Port | Role |
|---------|------|------|
| **API Gateway** | 8000 | Routes requests, rate limiting, request IDs, CORS |
| **User Service** | 5001 | Authentication (JWT), user CRUD, role management |
| **Product Service** | 5002 | Product catalog, search, image uploads, stock updates |
| **Order Service** | 5003 | Order lifecycle, simulated payment, delivery tracking |
| **Redis** | 6379 | Event bus for async communication (Pub/Sub) |
| **MongoDB** | — | Shared database with logically separated collections |
| **Frontend** | 3000 | React SPA with Redux Toolkit |

---

## Project Structure

```
ProShop/
├── services/
│   ├── api-gateway/              # API Gateway (Edge Service)
│   │   ├── server.js             # Proxy routing, rate limiting, request IDs
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── user-service/             # User Microservice
│   │   ├── config/db.js          # MongoDB connection
│   │   ├── controllers/          # Thin HTTP handlers
│   │   ├── services/             # Business logic layer
│   │   ├── middleware/           # Auth, validation, error handling
│   │   ├── models/               # Mongoose schema + indexes
│   │   ├── routes/               # Express route definitions
│   │   ├── utils/                # Logger, token generation
│   │   ├── server.js
│   │   └── Dockerfile
│   │
│   ├── product-service/          # Product Microservice
│   │   ├── controllers/          # Thin HTTP handlers
│   │   ├── services/             # Business logic layer
│   │   ├── events/               # Redis Pub/Sub (eventBus + subscriber)
│   │   ├── middleware/           # Auth, validation, error handling
│   │   ├── models/               # Schema + text/rating indexes
│   │   ├── routes/               # Product + upload routes
│   │   ├── utils/                # Logger, HTTP client (retry/timeout)
│   │   ├── server.js
│   │   └── Dockerfile
│   │
│   ├── order-service/            # Order Microservice
│   │   ├── controllers/          # Thin HTTP handlers
│   │   ├── services/             # Business logic + inter-service calls
│   │   ├── events/               # Redis publisher
│   │   ├── middleware/           # Auth, validation, error handling
│   │   ├── models/               # Schema + user/payment indexes
│   │   ├── routes/               # Order routes
│   │   ├── utils/                # Logger, HTTP client, price calculator
│   │   ├── server.js
│   │   └── Dockerfile
│   │
│   └── seeder.js                 # Database seeder
│
├── frontend/                     # React Frontend
├── docker-compose.yml            # Container orchestration
├── .env                          # Environment variables
└── README.md
```

---

## How to Run

### Using Docker Compose (Recommended)

```bash
# 1. Clone the project
git clone <repository-url>
cd ProShop

# 2. Configure environment
cp example.env .env
# Edit .env with your MongoDB URI and JWT secret

# 3. Build and start all services
docker-compose up --build

# 4. Access the application
#    Frontend:    http://localhost:3000
#    API Gateway: http://localhost:8000
#    Health:      http://localhost:8000/api/health

# 5. Stop all services
docker-compose down
```

### Scaling Services

```bash
# Scale specific services independently (horizontal scaling)
docker-compose up --scale product-service=3 --scale order-service=2
```

### Default Credentials

| Role  | Email           | Password |
|-------|-----------------|----------|
| Admin | admin@email.com | 123456   |
| User  | john@email.com  | 123456   |

---

## Communication Methods

### 1. Synchronous — REST API Calls

Services call each other via HTTP when they need an immediate response.

| Caller | Target | Purpose |
|--------|--------|---------|
| Order Service → Product Service | `GET /api/products/:id` | Verify product prices |
| Order Service → User Service | `GET /api/users/:id` | Fetch user details |
| Product/Order → User Service | `GET /api/users/profile` | Admin authorization |

All inter-service calls use **retry logic (3 attempts)** with **exponential backoff** and a **5-second timeout** to handle transient failures gracefully.

### 2. Asynchronous — Redis Pub/Sub Events

For operations that don't need an immediate response, services publish events.

```
Order Created → ORDER_PLACED event → Redis → Product Service → Update Stock
```

**Why async?** The user gets a fast response; stock updates happen in the background.

---

## Event-Driven Architecture

### ORDER_PLACED Event Flow

```
1. Client sends POST /api/orders
2. Order Service verifies prices via Product Service (sync REST)
3. Order Service saves order to MongoDB
4. Order Service publishes ORDER_PLACED event to Redis
5. Product Service receives event and updates stock asynchronously
```

### Event Schema

```json
{
  "eventType": "ORDER_PLACED",
  "eventId": "evt_1714200000_a1b2c3d4e",
  "source": "order-service",
  "timestamp": "2024-04-27T07:00:00.000Z",
  "data": {
    "orderId": "663d...",
    "userId": "663c...",
    "orderItems": [
      { "product": "663b...", "qty": 2, "name": "iPhone 13 Pro" }
    ],
    "totalPrice": 1199.98
  }
}
```

### Benefits of Async Communication

| Benefit | Explanation |
|---------|-------------|
| **Loose Coupling** | Order Service doesn't wait for stock updates |
| **Fault Tolerance** | If Product Service is down, orders still work |
| **Scalability** | Multiple instances can process events |

---

## Security

### Authentication Flow

```
1. User logs in → POST /api/users/auth
2. User Service generates JWT → stored as HTTP-only cookie
3. Every request → cookie is forwarded automatically
4. Each service verifies JWT locally using shared JWT_SECRET
5. Admin routes → User Service checks isAdmin flag
```

### Security Features

| Feature | Description |
|---------|-------------|
| **HTTP-Only Cookies** | JWT stored in cookies that JavaScript cannot access (prevents XSS) |
| **Input Validation** | Dedicated middleware validates all inputs before processing |
| **Server-Side Price Verification** | Order Service fetches real prices from Product Service |
| **Password Hashing** | bcrypt with 10 salt rounds |
| **Rate Limiting** | API Gateway limits 100 requests/minute per IP |
| **Role-Based Access** | Admin vs User roles enforced via middleware |
| **Simulated Payment** | Payment is simulated — no external API dependency |

---

## Cloud-Native Design Patterns

### High Availability (HA)

Docker Compose demonstrates HA conceptually using `restart: on-failure` policies. Each service has health checks that verify uptime. In a real production environment, **Kubernetes** would provide full HA with pod scheduling, rolling updates, and multi-node failover.

### Horizontal Scalability

Each microservice is **stateless** — no sessions stored in memory. All state lives in MongoDB (persistent data), Redis (events), and JWT cookies (authentication). This means any instance can handle any request, enabling:

```bash
docker-compose up --scale product-service=3
```

### Loose Coupling

Services never access each other's databases directly. All cross-service data is exchanged through:
- **REST APIs** for synchronous requests
- **Redis events** for asynchronous notifications

### Clean Architecture (Service Layer Pattern)

```
Route → Validation Middleware → Controller (HTTP only) → Service Layer (business logic) → Model (data)
```

---

## Ports & Services

| Service | Port | Health Check |
|---------|------|-------------|
| Frontend | 3000 | — |
| API Gateway | 8000 | `GET /api/health` |
| User Service | 5001 | `GET /health` |
| Product Service | 5002 | `GET /health` |
| Order Service | 5003 | `GET /health` |
| Redis | 6379 | `redis-cli ping` |

---

## Environment Variables

| Variable | Description | Used By |
|----------|-------------|---------|
| `NODE_ENV` | `development` or `production` | All |
| `MONGO_URI` | MongoDB connection string | User, Product, Order |
| `JWT_SECRET` | JWT signing secret | User, Product, Order |
| `REDIS_URL` | Redis connection URL | Product, Order |
| `SERVICE_NAME` | Service identifier for logs | All |
| `USER_SERVICE_URL` | User service base URL | Product, Order, Gateway |
| `PRODUCT_SERVICE_URL` | Product service base URL | Order, Gateway |
| `ORDER_SERVICE_URL` | Order service base URL | Gateway |

---

## API Endpoints

### User Service (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users` | Public | Register |
| POST | `/api/users/auth` | Public | Login |
| POST | `/api/users/logout` | Public | Logout |
| GET | `/api/users/profile` | Private | Get profile |
| PUT | `/api/users/profile` | Private | Update profile |
| GET | `/api/users` | Admin | Get all users |
| GET | `/api/users/:id` | Admin | Get user by ID |
| PUT | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Delete user |

### Product Service (`/api/products`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | Public | List products (paginated) |
| GET | `/api/products/top` | Public | Top-rated products |
| GET | `/api/products/:id` | Public | Product details |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| POST | `/api/upload` | Admin | Upload image |

### Order Service (`/api/orders`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | Private | Create order |
| GET | `/api/orders/mine` | Private | User's orders |
| GET | `/api/orders/:id` | Private | Order details |
| PUT | `/api/orders/:id/pay` | Private | Simulate payment |
| PUT | `/api/orders/:id/deliver` | Admin | Mark delivered |
| GET | `/api/orders` | Admin | All orders |

---

## License

MIT