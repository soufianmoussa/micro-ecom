# AWS Deployment Checklist

Use this checklist to ensure your micro-ecommerce application is properly configured and deployed on AWS.

---

## Pre-Deployment (Local Testing)

- [ ] Clone repository
- [ ] Install Docker and Docker Compose
- [ ] Run `docker-compose up -d`
- [ ] Test all services locally:
  - [ ] Frontend: http://localhost:8080
  - [ ] Product API: http://localhost:4000/products
  - [ ] Health checks: http://localhost:4000/health
  - [ ] User registration and login working
  - [ ] Add to cart functionality
  - [ ] Checkout process
- [ ] Verify `.env.example` has all required variables
- [ ] Review AWS_DEPLOYMENT_GUIDE.md thoroughly

---

## AWS Account Setup

- [ ] AWS account created
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS credentials configured (`aws configure`)
- [ ] Correct AWS region selected (default: us-east-1)
- [ ] IAM user has appropriate permissions:
  - [ ] EC2 (for EC2 deployment)
  - [ ] ECS (for ECS deployment)
  - [ ] RDS (for database)
  - [ ] ECR (for Docker registry)
  - [ ] CloudWatch (for monitoring)
  - [ ] Secrets Manager (for credentials)
  - [ ] ALB/ELB (for load balancing)

---

## Security Preparation

### Secrets Management
- [ ] Generate strong database password:
  ```bash
  openssl rand -base64 16
  ```
- [ ] Generate strong JWT_SECRET:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Store secrets in AWS Secrets Manager:
  ```bash
  aws secretsmanager create-secret --name micro-ecom/db ...
  aws secretsmanager create-secret --name micro-ecom/jwt ...
  ```
- [ ] Never commit `.env.production` to git
- [ ] Review `.gitignore` includes sensitive files

### SSL/TLS
- [ ] Request SSL certificate via AWS Certificate Manager:
  - [ ] Primary domain (yourdomain.com)
  - [ ] Wildcard domain (*.yourdomain.com) if needed
- [ ] Wait for certificate validation
- [ ] Record certificate ARN for load balancer configuration

### Network Security
- [ ] Plan VPC architecture:
  - [ ] Public subnets for ALB
  - [ ] Private subnets for services
  - [ ] Database in private subnet only
- [ ] Create security groups:
  - [ ] ALB security group (HTTP/HTTPS from 0.0.0.0/0)
  - [ ] Application security group (from ALB only)
  - [ ] Database security group (from app security group only)
- [ ] Review CIDR blocks and ranges

---

## Choose Deployment Option

### Option 1: EC2 + Docker Compose (Simplest)

- [ ] Launch EC2 instance:
  - [ ] AMI: Amazon Linux 2 (ami-0c55b159cbfafe1f0)
  - [ ] Instance type: t3.medium (production) or t3.small (testing)
  - [ ] Storage: 30GB minimum
  - [ ] Key pair created and saved securely
- [ ] Configure security group:
  - [ ] Allow port 22 (SSH) from your IP
  - [ ] Allow port 80 (HTTP) from 0.0.0.0/0
  - [ ] Allow port 443 (HTTPS) from 0.0.0.0/0
  - [ ] Allow port 5432 (PostgreSQL) from 10.0.0.0/8 (VPC only)
- [ ] Connect to instance via SSH
- [ ] Install Docker and Docker Compose
- [ ] Clone repository
- [ ] Create `.env` file with production values
- [ ] Run `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Test all endpoints
- [ ] Configure domain DNS to point to EC2 instance IP

### Option 2: ECS with Fargate (Recommended)

#### RDS Setup
- [ ] Create RDS PostgreSQL instance:
  - [ ] DB instance identifier: micro-ecom-db
  - [ ] DB engine: PostgreSQL 15
  - [ ] Instance class: db.t3.micro (free tier) or db.t3.small (production)
  - [ ] Allocated storage: 20GB
  - [ ] Master username: produser
  - [ ] Master password: (from Secrets Manager)
  - [ ] Multi-AZ: Yes (for production)
  - [ ] Storage encryption: Yes
  - [ ] Backup retention: 7 days
  - [ ] Enhanced monitoring: Yes
- [ ] Wait for database to be available
- [ ] Connect and verify:
  ```bash
  psql -h <rds-endpoint> -U produser
  CREATE DATABASE product_db;
  CREATE DATABASE cart_db;
  CREATE DATABASE order_db;
  CREATE DATABASE user_db;
  ```
- [ ] Store connection string in Secrets Manager

#### ECR Setup
- [ ] Create ECR repositories:
  - [ ] micro-ecom-product
  - [ ] micro-ecom-cart
  - [ ] micro-ecom-order
  - [ ] micro-ecom-user
  - [ ] micro-ecom-frontend
- [ ] Get ECR login token:
  ```bash
  aws ecr get-login-password | docker login --username AWS --password-stdin
  ```
- [ ] Build and push images:
  ```bash
  # For each service
  docker build -t micro-ecom-service ./service
  docker tag micro-ecom-service:latest <account>.dkr.ecr.<region>.amazonaws.com/micro-ecom-service:latest
  docker push <account>.dkr.ecr.<region>.amazonaws.com/micro-ecom-service:latest
  ```
- [ ] Verify images in ECR console

#### ECS Cluster Setup
- [ ] Create ECS cluster: micro-ecom-prod
- [ ] Create CloudWatch log groups:
  - [ ] /ecs/micro-ecom
  - [ ] /ecs/micro-ecom-product
  - [ ] /ecs/micro-ecom-cart
  - [ ] /ecs/micro-ecom-order
  - [ ] /ecs/micro-ecom-user
  - [ ] /ecs/micro-ecom-frontend
- [ ] Create task definitions (see AWS_DEPLOYMENT_GUIDE.md):
  - [ ] product-service
  - [ ] cart-service
  - [ ] order-service
  - [ ] user-service
  - [ ] frontend
- [ ] Configure environment variables in task definitions
- [ ] Reference secrets from Secrets Manager

#### Load Balancer Setup
- [ ] Create Application Load Balancer:
  - [ ] Name: micro-ecom-alb
  - [ ] Scheme: Internet-facing
  - [ ] Type: Application
  - [ ] VPC: Select correct VPC
  - [ ] Subnets: Select public subnets
  - [ ] Security groups: ALB security group
- [ ] Create target groups for each service:
  - [ ] product-service-tg (port 4000)
  - [ ] cart-service-tg (port 4001)
  - [ ] order-service-tg (port 4002)
  - [ ] user-service-tg (port 4003)
  - [ ] frontend-tg (port 80)
- [ ] Configure health checks:
  - [ ] Path: /health
  - [ ] Port: traffic port
  - [ ] Healthy threshold: 2
  - [ ] Unhealthy threshold: 3
  - [ ] Timeout: 5 seconds
  - [ ] Interval: 30 seconds
- [ ] Create listener rules:
  - [ ] HTTP 80 → redirect to HTTPS 443
  - [ ] HTTPS 443 → path-based routing to target groups
- [ ] Attach certificate to HTTPS listener

#### ECS Services
- [ ] Create ECS services for each microservice:
  - [ ] Service name: product-service
  - [ ] Task definition: product-service:latest
  - [ ] Desired count: 2
  - [ ] Launch type: FARGATE
  - [ ] Network configuration:
    - [ ] Subnets: Private subnets
    - [ ] Security groups: Application security group
  - [ ] Load balancer integration: Enabled
  - [ ] Target group: product-service-tg
  - [ ] Container port: 4000
  - [ ] Auto-assign public IP: DISABLED (private subnet)
  - [ ] (Repeat for other services)
- [ ] Create frontend service (similar, port 80)
- [ ] Wait for services to reach steady state

#### Auto-Scaling
- [ ] Register scalable targets for each service:
  ```bash
  aws application-autoscaling register-scalable-target ...
  ```
- [ ] Create scaling policies:
  - [ ] Scale up when CPU > 70%
  - [ ] Scale down when CPU < 30%
  - [ ] Min instances: 2
  - [ ] Max instances: 10
- [ ] Test auto-scaling with load testing

### Option 3: EKS (Advanced)

- [ ] Prerequisites installed:
  - [ ] kubectl
  - [ ] eksctl
  - [ ] Helm (optional)
- [ ] Create EKS cluster:
  ```bash
  eksctl create cluster --name micro-ecom-prod --region us-east-1 --node-type t3.medium --nodes 3
  ```
- [ ] Wait for cluster creation (15-20 minutes)
- [ ] Verify cluster:
  ```bash
  kubectl cluster-info
  kubectl get nodes
  ```
- [ ] Create Kubernetes manifests (see kubernetes/ directory)
- [ ] Deploy application:
  ```bash
  kubectl apply -f kubernetes/
  ```
- [ ] Verify deployments:
  ```bash
  kubectl get pods
  kubectl get svc
  kubectl get ingress
  ```

---

## DNS & Domain Configuration

- [ ] Domain name registered (Route53 or external registrar)
- [ ] Create/update Route53 hosted zone
- [ ] Create DNS records:
  - [ ] A record: yourdomain.com → ALB DNS name (or EC2 IP)
  - [ ] CNAME record: www.yourdomain.com → yourdomain.com
  - [ ] (Optional) Subdomain: api.yourdomain.com → ALB DNS name
- [ ] Wait for DNS propagation (can take 24-48 hours)
- [ ] Test DNS resolution:
  ```bash
  dig yourdomain.com
  nslookup yourdomain.com
  ```
- [ ] Update frontend API endpoints if using subdomain

---

## Monitoring & Alerts

### CloudWatch
- [ ] Set up CloudWatch dashboard for micro-ecom
- [ ] Create custom metrics for:
  - [ ] API latency
  - [ ] Error rates
  - [ ] Request count
- [ ] Create alarms:
  - [ ] High error rate (>5%)
  - [ ] High latency (>1000ms)
  - [ ] Service down
  - [ ] RDS CPU > 80%
  - [ ] RDS storage > 80%
  - [ ] ECS task stopped
- [ ] Configure SNS notifications for alarms:
  - [ ] Email notification
  - [ ] (Optional) Slack integration
  - [ ] (Optional) PagerDuty integration

### Logs
- [ ] Configure CloudWatch Logs retention:
  - [ ] Development logs: 7 days
  - [ ] Production logs: 30 days
- [ ] Set up log insights queries for common issues
- [ ] Create log-based metrics for tracking errors

### Performance Monitoring
- [ ] Enable X-Ray tracing (optional)
- [ ] Set up APM (New Relic, DataDog, or CloudWatch)
- [ ] Monitor database performance:
  - [ ] Query execution time
  - [ ] Connection count
  - [ ] IOPS usage

---

## Testing (Post-Deployment)

### Functionality Testing
- [ ] Frontend loads and displays products
- [ ] Can register new user
- [ ] Can login with created account
- [ ] Can add items to cart
- [ ] Can checkout and create order
- [ ] Can view order history
- [ ] Can update user profile
- [ ] Product filtering works
- [ ] Product search works
- [ ] Pagination works

### Performance Testing
- [ ] Home page loads in < 2 seconds
- [ ] API responses < 500ms (95th percentile)
- [ ] Database queries optimized
- [ ] No N+1 queries

### Security Testing
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Password hashing verified (bcrypt)
- [ ] JWT token validation working
- [ ] CORS properly configured
- [ ] SQL injection not possible
- [ ] No sensitive data in logs
- [ ] Database not publicly accessible
- [ ] Security groups properly configured

### Load Testing
- [ ] Run load test with ab or wrk:
  ```bash
  ab -n 1000 -c 100 https://yourdomain.com/api/products
  ```
- [ ] Monitor auto-scaling behavior
- [ ] Verify services scale up/down correctly
- [ ] Database handles increased load

---

## Backups & Disaster Recovery

- [ ] Enable RDS automated backups:
  - [ ] Retention period: 7-30 days
  - [ ] Backup window: Off-peak hours
- [ ] Create manual database snapshot:
  ```bash
  aws rds create-db-snapshot --db-instance-identifier micro-ecom-db --db-snapshot-identifier micro-ecom-backup-$(date +%Y%m%d)
  ```
- [ ] Test restore process (monthly)
- [ ] Document disaster recovery plan
- [ ] Set up multi-AZ for RDS
- [ ] Configure cross-region backup replication (optional)

---

## Cost Optimization

- [ ] Enable AWS Budgets for cost monitoring
- [ ] Set up billing alerts:
  - [ ] Alert if > $50/day
  - [ ] Alert if > $500/month
- [ ] Review and optimize:
  - [ ] Unused security groups
  - [ ] Unused Elastic IPs
  - [ ] Old RDS snapshots
  - [ ] Old CloudWatch logs
- [ ] Consider reserved instances for predictable load
- [ ] Use Fargate Spot for non-critical workloads
- [ ] Enable S3 lifecycle policies for logs

---

## Documentation & Handoff

- [ ] Document infrastructure setup:
  - [ ] VPC configuration
  - [ ] Security groups
  - [ ] IAM roles/policies
  - [ ] RDS connection details
- [ ] Create runbook for common tasks:
  - [ ] How to deploy new version
  - [ ] How to scale services
  - [ ] How to handle outage
  - [ ] How to restore from backup
- [ ] Document current configuration:
  - [ ] Environment variables
  - [ ] Service dependencies
  - [ ] Database schema
- [ ] Share with team:
  - [ ] AWS console access
  - [ ] GitHub repository access
  - [ ] Deployment permissions
  - [ ] On-call documentation

---

## Ongoing Maintenance

### Weekly
- [ ] Review CloudWatch alarms and logs
- [ ] Check cost trends
- [ ] Verify auto-scaling is working

### Monthly
- [ ] Review security groups for unnecessary open ports
- [ ] Test disaster recovery plan
- [ ] Update dependencies for security patches
- [ ] Review and optimize slow queries

### Quarterly
- [ ] Full security audit
- [ ] Update documentation
- [ ] Review and optimize architecture
- [ ] Plan capacity for growth

---

## Post-Deployment Tasks

- [ ] [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] [ ] Add automated tests
- [ ] [ ] Implement feature flags
- [ ] [ ] Add API rate limiting
- [ ] [ ] Implement caching (Redis)
- [ ] [ ] Set up APM (Application Performance Monitoring)
- [ ] [ ] Configure email notifications
- [ ] [ ] Set up analytics tracking
- [ ] [ ] Document API (Swagger/OpenAPI)
- [ ] [ ] Create developer documentation

---

## Troubleshooting Checklist

If something goes wrong, check:

- [ ] CloudWatch logs for errors
- [ ] Health check endpoints responding
- [ ] Security groups allow necessary traffic
- [ ] RDS is accessible
- [ ] Environment variables are set correctly
- [ ] Secrets are properly configured
- [ ] Service is running (ECS/EC2)
- [ ] Load balancer target health
- [ ] DNS resolution working
- [ ] SSL certificate valid

---

## Emergency Contacts

- [ ] AWS Support Plan level: _____________
- [ ] AWS Account Manager: _____________
- [ ] Team Lead: _____________
- [ ] On-Call Engineer: _____________
- [ ] DevOps Contact: _____________

---

## Completion Sign-Off

- [ ] All checklist items completed
- [ ] All tests passed
- [ ] Security review approved
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] Team trained on deployment

**Deployment Date**: __________  
**Deployed By**: __________  
**Approved By**: __________  

---

**Ready for Production**: ✅ / ❌

---

**Appendix: Useful Commands**

```bash
# Monitoring
aws logs tail /ecs/micro-ecom --follow
aws cloudwatch get-metric-statistics --namespace AWS/ECS ...

# Debugging
aws ecs describe-tasks --cluster micro-ecom-prod --tasks <task-arn>
aws ecs describe-services --cluster micro-ecom-prod --services product-service

# Scaling
aws application-autoscaling set-desired-object-attribute-config ...
aws ecs update-service --cluster micro-ecom-prod --service product-service --desired-count 5

# Database
psql -h <rds-endpoint> -U produser
\l  # List databases
\dt # List tables
```

**Last Updated**: December 2024
