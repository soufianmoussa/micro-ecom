# AWS Deployment Guide for Micro-eCommerce Application

This guide provides step-by-step instructions to deploy the microservices application on AWS.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Options](#deployment-options)
4. [Option 1: EC2 with Docker Compose](#option-1-ec2-with-docker-compose)
5. [Option 2: ECS (Recommended for Production)](#option-2-ecs-recommended-for-production)
6. [Option 3: EKS (Kubernetes)](#option-3-eks-kubernetes)
7. [Database Setup (AWS RDS)](#database-setup-aws-rds)
8. [Environment Configuration](#environment-configuration)
9. [Monitoring & Scaling](#monitoring--scaling)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cloud                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐                                           │
│  │ CloudFront   │  (CDN & SSL)                             │
│  └──────┬───────┘                                           │
│         │                                                    │
│  ┌──────▼────────────────────────┐                         │
│  │   Application Load Balancer   │                         │
│  │   (ALB) - Port 80/443         │                         │
│  └──────┬───────────┬────────────┘                         │
│         │           │                                       │
│  ┌──────▼──┐  ┌────▼──────┐                               │
│  │Frontend  │  │API Gateway│                              │
│  │(S3+CF)   │  │(ALB)      │                              │
│  └──────────┘  └────┬──────┘                              │
│                     │                                       │
│        ┌────┬───────┼───────┬────┐                         │
│        │    │       │       │    │                         │
│  ┌─────▼──┐┌──▼──┐┌──▼──┐┌──▼──┐                         │
│  │Product ││Cart ││Order││User ││  (ECS Tasks)           │
│  │Service ││Serv.││Serv.││Serv.││                         │
│  └────────┘└──┬──┘└──┬──┘└──┬──┘                         │
│                │      │      │                             │
│        ┌───────┴──────┴──────┴───────┐                    │
│        │                              │                    │
│   ┌────▼─────────────────────────┐  │                    │
│   │     AWS RDS PostgreSQL        │  │                    │
│   │  (Multi-AZ for HA)           │  │                    │
│   └──────────────────────────────┘  │                    │
│                                      │                    │
│   ┌──────────────────────────────┐  │                    │
│   │  AWS Secrets Manager         │  │                    │
│   │  (Store DB credentials)      │  │                    │
│   └──────────────────────────────┘  │                    │
└─────────────────────────────────────┴────────────────────┘
```

---

## Prerequisites

### AWS Account & Tools
- AWS Account with appropriate permissions
- AWS CLI v2 installed and configured
- Docker & Docker Compose installed locally
- Git for version control

### Install AWS CLI
```bash
# On macOS
brew install awscli

# On Windows (with Chocolatey)
choco install awscliv2

# Verify installation
aws --version

# Configure credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Default region, Output format
```

### Configure AWS Credentials
```bash
# Set up IAM user with programmatic access
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1
```

---

## Deployment Options

| Option | Complexity | Cost | Best For | HA | Scaling |
|--------|-----------|------|----------|-----|---------|
| **EC2 + Docker Compose** | Low | Low | Development, Learning | Manual | Manual |
| **ECS (Fargate)** | Medium | Low-Medium | Most Production Apps | Built-in | Auto |
| **ECS (EC2)** | High | Medium | Cost-sensitive at scale | Possible | Auto |
| **EKS** | High | Medium-High | Complex Microservices | Built-in | Auto |

### Recommended: **ECS with Fargate** (Serverless Containers)

---

## Option 1: EC2 with Docker Compose

### Quick Deployment (for testing/development)

#### Step 1: Launch EC2 Instance

```bash
# Using AWS Console or AWS CLI
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \  # Amazon Linux 2
  --instance-type t3.medium \
  --key-name my-key-pair \
  --security-groups default \
  --count 1 \
  --region us-east-1
```

#### Step 2: Connect to Instance

```bash
ssh -i my-key-pair.pem ec2-user@<your-instance-ip>
```

#### Step 3: Install Docker

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install docker -y
sudo usermod -aG docker ec2-user
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

#### Step 4: Deploy Application

```bash
# Clone repository
git clone <your-repo>
cd micro-ecom

# Create .env file with production values
cp .env.example .env
nano .env
# Edit with actual values:
# POSTGRES_USER=produser
# POSTGRES_PASSWORD=<strong_password>
# JWT_SECRET=<32_char_random_string>
# CORS_ORIGIN=<your-domain>
# NODE_ENV=production

# Run application
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f

# Stop application
docker-compose down
```

#### Step 5: Configure Security & Access

```bash
# Configure Security Group
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.0.0/16  # Only from VPC
```

#### Step 6: Setup Domain & SSL

```bash
# Using Route53 and Certbot
sudo yum install certbot -y

# Get SSL Certificate
sudo certbot certonly --standalone -d yourdomain.com

# Setup Nginx reverse proxy (optional)
sudo yum install nginx -y

# Configure Nginx to forward requests to Docker services
```

**Pros:** Simple, low cost, easy to understand  
**Cons:** Single point of failure, manual scaling, no auto-recovery

---

## Option 2: ECS (Recommended for Production)

### Using AWS ECS with Fargate (Serverless)

#### Step 1: Push Docker Images to ECR

```bash
# Create ECR Repository
aws ecr create-repository --repository-name micro-ecom-product --region us-east-1
aws ecr create-repository --repository-name micro-ecom-cart --region us-east-1
aws ecr create-repository --repository-name micro-ecom-order --region us-east-1
aws ecr create-repository --repository-name micro-ecom-user --region us-east-1
aws ecr create-repository --repository-name micro-ecom-frontend --region us-east-1

# Get ECR login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push images
for service in product-service cart-service order-service user-service frontend; do
  docker build -t micro-ecom-${service} ./${service}
  docker tag micro-ecom-${service}:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/micro-ecom-${service}:latest
  docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/micro-ecom-${service}:latest
done
```

#### Step 2: Create ECS Cluster

```bash
# Create cluster
aws ecs create-cluster --cluster-name micro-ecom-prod --region us-east-1

# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/micro-ecom --region us-east-1
```

#### Step 3: Create Task Definitions

```bash
# See: aws/ecs-task-definition.json
aws ecs register-task-definition \
  --cli-input-json file://aws/ecs-task-definition.json
```

#### Step 4: Create ECS Services

```bash
aws ecs create-service \
  --cluster micro-ecom-prod \
  --service-name product-service \
  --task-definition product-service:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

#### Step 5: Setup Load Balancer

```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name micro-ecom-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx \
  --scheme internet-facing \
  --type application \
  --region us-east-1

# Create Target Groups
aws elbv2 create-target-group \
  --name product-service-tg \
  --protocol HTTP \
  --port 4000 \
  --vpc-id vpc-xxxxx

# Register services with target groups
# Update ECS services to use load balancer
```

#### Step 6: Setup Auto-Scaling

```bash
# Create Auto Scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/micro-ecom-prod/product-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy (scale up on CPU > 70%)
aws application-autoscaling put-scaling-policy \
  --policy-name product-service-cpu-scaling \
  --service-namespace ecs \
  --resource-id service/micro-ecom-prod/product-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://aws/scaling-policy.json
```

**Pros:** Highly available, auto-scaling, managed, integrates with AWS services  
**Cons:** More complex setup, CloudWatch monitoring learning curve

---

## Option 3: EKS (Kubernetes)

### Using Amazon EKS (Elastic Kubernetes Service)

#### Prerequisites

```bash
# Install kubectl
brew install kubectl

# Install eksctl
brew install eksctl

# Verify
kubectl version --client
eksctl version
```

#### Step 1: Create EKS Cluster

```bash
# Create cluster (takes ~15 minutes)
eksctl create cluster \
  --name micro-ecom-prod \
  --region us-east-1 \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5

# Verify cluster
kubectl cluster-info
kubectl get nodes
```

#### Step 2: Deploy with Helm (Optional)

```bash
# Install Helm
brew install helm

# Add Helm repositories for common charts
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Deploy PostgreSQL using Helm
helm install postgres bitnami/postgresql \
  --set auth.username=produser \
  --set auth.password=<strong_password> \
  --set auth.database=product_db
```

#### Step 3: Create Kubernetes Manifests

```bash
# See: kubernetes/ directory
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/services/
kubectl apply -f kubernetes/deployments/
kubectl apply -f kubernetes/ingress.yaml
```

#### Step 4: Verify Deployment

```bash
kubectl get pods -n micro-ecom
kubectl get services -n micro-ecom
kubectl logs -n micro-ecom <pod-name>
```

**Pros:** Most scalable, industry standard, powerful features  
**Cons:** High complexity, steeper learning curve

---

## Database Setup (AWS RDS)

### Create PostgreSQL Instance

#### Using AWS Console

1. Go to RDS Dashboard
2. Click "Create database"
3. Select PostgreSQL engine
4. Choose "Multi-AZ deployment" for production
5. Configure:
   - DB instance class: `db.t3.micro` (free tier) or `db.t3.small` (production)
   - Storage: 20 GB (configurable)
   - Username: `produser`
   - Password: Generate strong password
6. Click "Create database"

#### Using AWS CLI

```bash
aws rds create-db-instance \
  --db-instance-identifier micro-ecom-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username produser \
  --master-user-password <strong_password> \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxx \
  --storage-encrypted \
  --multi-az \
  --backup-retention-period 7 \
  --region us-east-1
```

### Store Credentials in Secrets Manager

```bash
# Store database credentials
aws secretsmanager create-secret \
  --name micro-ecom/db \
  --secret-string '{
    "username":"produser",
    "password":"<strong_password>",
    "host":"<rds-endpoint>",
    "port":5432,
    "database":"product_db"
  }' \
  --region us-east-1

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id micro-ecom/db \
  --region us-east-1
```

### Initialize Database

```bash
# Connect to RDS instance
psql -h <rds-endpoint> -U produser -d postgres -W

# Create databases
CREATE DATABASE product_db;
CREATE DATABASE cart_db;
CREATE DATABASE order_db;
CREATE DATABASE user_db;

# Verify
\l

# Exit
\q
```

---

## Environment Configuration

### Create .env file for production

```bash
# Copy template
cp .env.example .env.production

# Edit with production values
nano .env.production
```

### .env.production Example

```ini
# Database (RDS)
POSTGRES_USER=produser
POSTGRES_PASSWORD=your_strong_password_from_secrets_manager
POSTGRES_HOST=micro-ecom-db.xxxxx.us-east-1.rds.amazonaws.com
POSTGRES_PORT=5432

# JWT Security
JWT_SECRET=generate_32_char_random_string_here
JWT_EXPIRES_IN=24h

# Service URLs (use ALB DNS or service names for ECS)
PRODUCT_SERVICE_URL=http://product-service:4000
CART_SERVICE_URL=http://cart-service:4001
ORDER_SERVICE_URL=http://order-service:4002
USER_SERVICE_URL=http://user-service:4003

# Frontend URLs (use CloudFront or ALB domain)
FRONTEND_API_BASE=https://api.yourdomain.com
FRONTEND_CART_BASE=https://api.yourdomain.com
FRONTEND_ORDER_BASE=https://api.yourdomain.com
FRONTEND_AUTH_BASE=https://api.yourdomain.com

# Environment
NODE_ENV=production

# CORS
CORS_ORIGIN=https://yourdomain.com

# AWS
AWS_REGION=us-east-1
```

### Use AWS Systems Manager Parameter Store

```bash
# Store parameters (more secure than .env files)
aws ssm put-parameter \
  --name /micro-ecom/db/username \
  --value produser \
  --type String \
  --region us-east-1

aws ssm put-parameter \
  --name /micro-ecom/db/password \
  --value <strong_password> \
  --type SecureString \
  --region us-east-1

# Retrieve in application
aws ssm get-parameter \
  --name /micro-ecom/db/username \
  --with-decryption \
  --region us-east-1
```

---

## Monitoring & Scaling

### CloudWatch Monitoring

```bash
# Create custom metric for API latency
aws cloudwatch put-metric-data \
  --metric-name APILatency \
  --namespace MicroEcom \
  --value 150 \
  --unit Milliseconds

# Create alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name micro-ecom-high-errors \
  --alarm-description "Alert when error rate > 5%" \
  --metric-name 4XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### View Logs

```bash
# Using CloudWatch Logs Insights
aws logs start-query \
  --log-group-name /ecs/micro-ecom \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

### Auto-Scaling Configuration

For ECS:
```bash
# CPU-based scaling
--target-tracking-scaling-policy-configuration \
  TargetValue=70.0,PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageCPUUtilization}

# Memory-based scaling
--target-tracking-scaling-policy-configuration \
  TargetValue=80.0,PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageMemoryUtilization}
```

---

## Security Best Practices

### 1. Network Security

```bash
# Use VPC with private subnets
# Restrict database access to application security group only
aws ec2 authorize-security-group-ingress \
  --group-id sg-db-xxxxx \
  --protocol tcp \
  --port 5432 \
  --source-security-group-id sg-app-xxxxx
```

### 2. Secrets Management

```bash
# Never commit .env files
echo ".env*" >> .gitignore

# Use Secrets Manager or Parameter Store
# Rotate credentials regularly
```

### 3. SSL/TLS Encryption

```bash
# Use AWS Certificate Manager
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS

# Configure ALB to use HTTPS
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:...
```

### 4. Enable RDS Encryption

```bash
# Already enabled in RDS creation above
# Verify encryption is enabled
aws rds describe-db-instances \
  --db-instance-identifier micro-ecom-db \
  --query 'DBInstances[0].StorageEncrypted'
```

---

## Troubleshooting

### Common Issues

#### 1. Container fails to start

```bash
# Check logs
docker-compose logs product-service

# For ECS
aws ecs describe-tasks \
  --cluster micro-ecom-prod \
  --tasks arn:aws:ecs:us-east-1:xxxxx:task/xxxxx

# View CloudWatch logs
aws logs tail /ecs/micro-ecom --follow
```

#### 2. Database connection error

```bash
# Verify RDS is running
aws rds describe-db-instances --db-instance-identifier micro-ecom-db

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx

# Test connection
psql -h <rds-endpoint> -U produser -d postgres
```

#### 3. Health check failing

```bash
# Check service endpoints
curl http://localhost:4000/health
curl http://localhost:4001/health

# Verify DATABASE is ready
curl http://localhost:4000/ready
```

#### 4. Services can't reach each other

```bash
# For Docker Compose: verify network
docker network inspect micro-ecom_micro

# For ECS: verify security groups and task network configuration
aws ecs describe-task-definition --task-definition product-service

# For EKS: check service discovery
kubectl get svc -n micro-ecom
kubectl exec -it <pod> -- nslookup cart-service
```

### Debugging Commands

```bash
# SSH into running container
docker exec -it <container-id> /bin/sh

# Check container resource usage
docker stats

# View detailed ECS logs
aws ecs describe-tasks \
  --cluster micro-ecom-prod \
  --tasks <task-arn> \
  --include TAGS

# Stream application logs locally
docker-compose logs -f --tail=100
```

---

## Cleanup & Cost Management

### Remove AWS Resources

```bash
# Delete ECS service
aws ecs delete-service \
  --cluster micro-ecom-prod \
  --service product-service \
  --force

# Delete ECS cluster
aws ecs delete-cluster --cluster micro-ecom-prod

# Delete RDS instance
aws rds delete-db-instance \
  --db-instance-identifier micro-ecom-db \
  --skip-final-snapshot

# Delete Load Balancer
aws elbv2 delete-load-balancer \
  --load-balancer-arn arn:aws:elasticloadbalancing:...

# Delete ECR repositories
aws ecr delete-repository \
  --repository-name micro-ecom-product \
  --force
```

### Cost Optimization

1. **Use Fargate Spot** instead of On-Demand for non-critical workloads (up to 70% savings)
2. **Use Reserved Instances** for predictable load (up to 40% savings)
3. **Enable RDS auto-stop** for development environments
4. **Use S3 for frontend** instead of container (cheaper for static content)
5. **Enable CloudWatch Logs retention policies** to control log storage costs

---

## Next Steps

1. ✅ Set up AWS account and IAM users
2. ✅ Choose deployment option (ECS recommended)
3. ✅ Create RDS PostgreSQL instance
4. ✅ Deploy application
5. ✅ Configure domain and SSL
6. ✅ Set up monitoring and alarms
7. ✅ Configure auto-scaling
8. ✅ Set up CI/CD pipeline
9. ✅ Regular backups and disaster recovery
10. ✅ Optimize costs

---

## Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [AWS Pricing Calculator](https://calculator.aws/#/)

---

**Last Updated:** December 2024  
**For support:** See repository issues or AWS Support
