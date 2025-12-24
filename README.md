# Micro eCommerce - Microservices Architecture

A production-ready microservices e-commerce application built with Node.js, Express, PostgreSQL, and Docker. Deploy on AWS using EC2, ECS, or EKS.

## 🚀 Features

- **Microservices Architecture**: Independent services for products, cart, orders, and authentication
- **RESTful APIs**: Clean, scalable API design with proper error handling
- **User Authentication**: JWT-based authentication with password hashing (bcrypt)
- **Database per Service**: PostgreSQL databases for data isolation and independence
- **Docker & Kubernetes Ready**: Production-grade containerization with docker-compose and ECS support
- **Cloud Native**: AWS integration with RDS, ECR, ECS, CloudWatch
- **Health Checks**: Built-in health check endpoints for load balancers
- **Environment Configuration**: Support for development, staging, and production environments
- **Input Validation**: Request validation and sanitization
- **CORS Protection**: Configurable CORS for security

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/HTML/JS)                │
│                      :8080                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            API Gateway / Load Balancer (ALB)                │
│                      :80/:443                                │
└─────────────────────────────────────────────────────────────┘
    ↓                    ↓                   ↓                  ↓
┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
│  Product    │ │    Cart      │ │    Order     │ │    User     │
│   Service   │ │   Service    │ │   Service    │ │   Service   │
│   :4000     │ │   :4001      │ │   :4002      │ │   :4003     │
└──────┬──────┘ └──────┬───────┘ └──────┬───────┘ └──────┬──────┘
       │                │               │                │
       └────────────────┴───────────────┴────────────────┘
                        ↓
              ┌────────────────────┐
              │   PostgreSQL DB    │
              │    (Multi-DB)      │
              └────────────────────┘
```

## 📋 Services

| Service | Port | Purpose |
|---------|------|---------|
| **Frontend** | 8080 | Web UI (Nginx) |
| **Product Service** | 4000 | Browse products, categories, search, filtering |
| **Cart Service** | 4001 | Manage shopping cart items |
| **Order Service** | 4002 | Process orders, manage order history |
| **User Service** | 4003 | User authentication, profiles, JWT tokens |
| **PostgreSQL** | 5432 | Data persistence |

## 🚀 Quick Start

### Local Development

```bash
# Prerequisites
git clone <repository-url>
cd micro-ecom

# Setup environment
cp .env.development .env

# Start services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access Points:**
- Frontend: http://localhost:8080
- Product API: http://localhost:4000/products
- Cart API: http://localhost:4001/cart/{userId}
- Order API: http://localhost:4002/orders/{userId}
- User API: http://localhost:4003/auth/login

### AWS Deployment

See [QUICK_START_AWS.md](./QUICK_START_AWS.md) for 5-minute quick start.

For comprehensive deployment guide: [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md)

#### Quick Deploy to EC2

```bash
# Launch EC2 instance (t3.medium recommended)
# SSH into instance and run:

sudo yum install docker -y
sudo systemctl start docker
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

git clone <repo>
cd micro-ecom
cp .env.production .env
nano .env  # Edit with your values

docker-compose -f docker-compose.prod.yml up -d
```

#### Deploy to ECS (Recommended)

```bash
# See AWS_DEPLOYMENT_GUIDE.md for complete ECS setup
# Includes: ECR push, task definitions, service creation, load balancer, auto-scaling
```

## 🔐 Security Features

✅ **Implemented:**
- **Password Hashing**: bcryptjs for secure password storage
- **JWT Authentication**: Token-based authentication with expiry
- **Input Validation**: Request validation before processing
- **CORS Protection**: Configurable CORS origins
- **Environment Variables**: Secrets in environment (not hardcoded)
- **Health Checks**: For AWS load balancer integration
- **HTTPS Ready**: Support for SSL/TLS certificates

⚠️ **Before Production:**
1. Change database credentials in `.env.production`
2. Generate strong `JWT_SECRET` (32+ random characters)
3. Enable SSL/TLS with AWS Certificate Manager
4. Restrict security groups to necessary ports only
5. Enable VPC encryption
6. Set up CloudWatch alarms
7. Configure automated backups
8. Enable MFA on AWS account

## 📊 API Documentation

### Product Service (/products)

```bash
# Get products with filters
GET /products?page=1&limit=6&category=Electronics&sort=price_asc

# Get categories
GET /categories

# Get single product
GET /products/{id}

# Health checks
GET /health
GET /ready
```

### Cart Service (/cart)

```bash
# Get user cart
GET /cart/{userId}

# Add to cart
POST /cart/{userId}/add
Body: { "productId": "p1", "qty": 2 }

# Clear cart
POST /cart/{userId}/clear
```

### Order Service (/orders)

```bash
# Create order
POST /order
Body: { "userId": "user123" }

# Get user orders
GET /orders/{userId}
```

### User Service (/auth)

```bash
# Register user
POST /auth/register
Body: { "username": "john", "password": "pass123", "address": "123 Main St", "phone": "555-1234" }

# Login
POST /auth/login
Body: { "username": "john", "password": "pass123" }

# Get profile (requires JWT)
GET /profile/{userId}
Header: Authorization: Bearer {token}

# Update profile (requires JWT)
PUT /profile/{userId}
Body: { "address": "456 Oak Ave", "phone": "555-5678" }

# Health checks
GET /health
GET /ready
```

## 🔧 Configuration

### Environment Variables

**Development** (`.env.development`):
```ini
POSTGRES_USER=admin
POSTGRES_PASSWORD=password
POSTGRES_HOST=postgres
JWT_SECRET=dev_secret_key
NODE_ENV=development
CORS_ORIGIN=http://localhost:8080
```

**Production** (`.env.production`):
```ini
POSTGRES_USER=produser
POSTGRES_PASSWORD=<strong_password>
POSTGRES_HOST=<rds-endpoint>
JWT_SECRET=<32_char_random_string>
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

See [.env.example](./.env.example) for all available options.

## 🐳 Docker Compose Files

- **`docker-compose.yml`** - Development setup (basic)
- **`docker-compose.prod.yml`** - Production setup (optimized, resource limits, health checks)

## 📦 Technology Stack

- **Runtime**: Node.js 18 (Alpine Linux)
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Container**: Docker & Docker Compose
- **Web Server**: Nginx
- **Cloud**: AWS (EC2, ECS, RDS, ECR, ALB)

## 🏥 Health Checks

All services provide health check endpoints for AWS load balancers:

```bash
# Service is running
GET /health
Response: { "status": "ok", "service": "product-service" }

# Service is ready (database connected)
GET /ready
Response: { "status": "ready", "service": "product-service" }
```

## 📈 Scaling & Performance

### Auto-Scaling (ECS)

Services can scale based on CPU and memory metrics:

```bash
# Scale product service from 2 to 10 instances
# Scales up when CPU > 70%
# Scales down when CPU < 30%
```

### Caching Strategy (Future)

- Implement Redis for product caching
- Cache category lists
- Cache user sessions

### Performance Optimization

- Database connection pooling (configured)
- Pagination for product listings (implemented)
- Filtering and search optimization (indexed database)

## 🛠️ Development

### Project Structure

```
micro-ecom/
├── product-service/
│   ├── index.js
│   ├── package.json
│   └── Dockerfile
├── cart-service/
│   ├── index.js
│   ├── package.json
│   └── Dockerfile
├── order-service/
│   ├── index.js
│   ├── package.json
│   └── Dockerfile
├── user-service/
│   ├── index.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── Dockerfile
├── db-init/
│   └── init.sql
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .env.development
├── .env.production
├── AWS_DEPLOYMENT_GUIDE.md
├── QUICK_START_AWS.md
└── README.md
```

### Adding New Features

1. Create service endpoint
2. Add input validation
3. Implement database query
4. Add error handling
5. Test with curl or Postman
6. Update documentation

### Running Tests

```bash
# TODO: Add unit and integration tests
npm test
```

## 📚 Deployment Guides

- **[QUICK_START_AWS.md](./QUICK_START_AWS.md)** - 5-minute AWS deployment
- **[AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md)** - Comprehensive AWS deployment (EC2, ECS, EKS)

### Deployment Options

| Option | Time | Cost | Complexity | Scalability |
|--------|------|------|-----------|------------|
| EC2 + Docker | 30 min | Low | Low | Manual |
| ECS (Fargate) | 1 hour | Low-Med | Medium | Auto |
| EKS | 2 hours | Medium | High | Auto |

## 🔄 CI/CD Pipeline (TODO)

- GitHub Actions for automated testing
- ECR image push on commit
- ECS automatic deployment
- CloudFormation infrastructure as code

## 📊 Monitoring (AWS)

```bash
# View CloudWatch logs
aws logs tail /ecs/micro-ecom --follow

# Set up alarms
aws cloudwatch put-metric-alarm --alarm-name micro-ecom-high-errors ...

# View metrics in AWS Console
# CloudWatch → Dashboards → micro-ecom
```

## 🐛 Troubleshooting

### Services won't start

```bash
docker-compose logs -f service-name
```

### Database connection error

```bash
# Test connection
psql -h postgres -U admin -d product_db

# Check if PostgreSQL is ready
docker-compose ps postgres
```

### Health check failing

```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

See [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md#troubleshooting) for more troubleshooting tips.

## 📝 License

MIT

## 👥 Contributors

- Soufian Moussa (@soufianmoussa)

## 📞 Support

For issues, questions, or contributions:
- Open GitHub issue
- Check AWS_DEPLOYMENT_GUIDE.md for deployment help
- Review error logs in CloudWatch

---

**Status**: ✅ Ready for development and testing | ⚠️ Review security before production deployment

**Last Updated**: December 2024
