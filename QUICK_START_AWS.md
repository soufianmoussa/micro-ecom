# Quick Start Guide - AWS Deployment

## 5-Minute Quick Start (Development)

### Prerequisites
```bash
# Install Docker & Docker Compose
# AWS CLI configured with credentials
aws configure
```

### 1. Clone & Setup

```bash
git clone <repository-url>
cd micro-ecom

# Create environment file
cp .env.development .env
```

### 2. Run Locally with Docker Compose

```bash
# For development
docker-compose up -d

# For production (with optimizations)
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### 3. Access Application

- **Frontend**: http://localhost:8080
- **Products API**: http://localhost:4000/products
- **Cart API**: http://localhost:4001/cart/:userId
- **Orders API**: http://localhost:4002/orders/:userId
- **Auth API**: http://localhost:4003/auth/login

---

## AWS Deployment (Production)

### Option A: EC2 + Docker Compose (Simplest)

```bash
# 1. Launch EC2 instance
# 2. SSH into instance
# 3. Install Docker
sudo yum install docker -y
sudo systemctl start docker

# 4. Install Docker Compose
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 5. Clone repo and deploy
git clone <repo>
cd micro-ecom
cp .env.production .env

# Edit .env with production values
nano .env

# Start
docker-compose -f docker-compose.prod.yml up -d
```

### Option B: ECS with Fargate (Recommended)

```bash
# 1. Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier micro-ecom-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username produser \
  --allocated-storage 20 \
  --region us-east-1

# 2. Push images to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker build -t micro-ecom-product ./product-service
docker tag micro-ecom-product:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/micro-ecom-product:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/micro-ecom-product:latest

# (Repeat for other services)

# 3. Create ECS cluster
aws ecs create-cluster --cluster-name micro-ecom-prod

# 4. Deploy services
aws ecs create-service \
  --cluster micro-ecom-prod \
  --service-name product-service \
  --task-definition product-service:1 \
  --desired-count 2 \
  --launch-type FARGATE
```

See [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md) for complete instructions.

### Option C: EKS (Most Scalable)

```bash
# Create cluster
eksctl create cluster --name micro-ecom-prod --region us-east-1

# Deploy with Kubernetes manifests
kubectl apply -f kubernetes/

# Check deployment
kubectl get pods
kubectl get svc
```

---

## Environment Variables

### For Local Development

```bash
cp .env.development .env
docker-compose up -d
```

### For Production

```bash
cp .env.production .env

# Edit with your values:
POSTGRES_PASSWORD=<strong_password>
JWT_SECRET=<32_char_random_string>
CORS_ORIGIN=https://yourdomain.com
```

---

## API Health Checks

Each service provides health check endpoints for AWS load balancers:

```bash
# Service is running
curl http://localhost:4000/health

# Service is ready (database connected)
curl http://localhost:4000/ready
```

---

## Security Notes

✅ **Implemented:**
- Password hashing with bcrypt
- JWT authentication
- CORS protection
- Environment variable configuration
- Health check endpoints for load balancers

⚠️ **TODO Before Production:**
1. Change default database credentials
2. Generate secure JWT_SECRET (32+ characters)
3. Enable SSL/TLS with AWS Certificate Manager
4. Enable VPC encryption
5. Set up CloudWatch alarms
6. Configure backup policies
7. Review security groups
8. Enable multi-factor authentication on AWS account

---

## Monitoring

### CloudWatch Logs

```bash
# Stream ECS logs
aws logs tail /ecs/micro-ecom --follow

# Query logs
aws logs start-query \
  --log-group-name /ecs/micro-ecom \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

### ECS Task Monitoring

```bash
aws ecs list-tasks --cluster micro-ecom-prod
aws ecs describe-tasks --cluster micro-ecom-prod --tasks <task-arn>
```

---

## Scaling

### Auto-scaling (ECS)

```bash
# CPU-based auto-scaling
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/micro-ecom-prod/product-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    'TargetValue=70.0,PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageCPUUtilization}'
```

---

## Cost Estimation

**Monthly Costs (us-east-1):**

| Component | Size | Cost |
|-----------|------|------|
| EC2 (t3.medium) | 1 instance | $25/month |
| RDS (t3.micro) | Multi-AZ | $50/month |
| ALB | 1 load balancer | $16/month |
| **Total** | | **~$90/month** |

**Using Fargate:**
- 4 services × 2 vCPU × 4GB RAM = ~$60-80/month
- RDS = $50/month
- ALB = $16/month
- **Total = ~$130-150/month**

---

## Troubleshooting

### Service won't start

```bash
# Check logs
docker-compose logs product-service

# For ECS
aws logs tail /ecs/micro-ecom --follow
```

### Can't connect to database

```bash
# Test RDS connection
psql -h <rds-endpoint> -U produser -d postgres

# Check security group
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### Health check failing

```bash
# Test endpoint
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

---

## Useful Commands

```bash
# View services
docker-compose ps

# View logs
docker-compose logs -f service-name

# SSH into container
docker exec -it <container-id> /bin/sh

# Restart service
docker-compose restart product-service

# Clean up
docker-compose down -v
```

---

## Next Steps

1. Read [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md) for detailed instructions
2. Review `.env.example` for all available configuration options
3. Test locally with `docker-compose up`
4. Deploy to AWS using chosen option
5. Configure domain and SSL
6. Set up monitoring and alerts
7. Configure auto-scaling
8. Implement backup strategy

---

For complete deployment instructions, see [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md)
