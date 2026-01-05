# Invy Deployment Guide

This guide covers deploying Invy to AWS. The API runs on Lambda + API Gateway, and the webapp is served from S3 + CloudFront.

## Prerequisites

1. **AWS CLI** configured with credentials:
   ```bash
   aws configure
   ```

2. **Serverless Framework** (installed as dev dependency, or globally):
   ```bash
   npm install -g serverless
   ```

## AWS Infrastructure Required

Before deploying, you need to set up the following AWS resources:

### 1. PostgreSQL Database (RDS)

Create an RDS PostgreSQL instance:

- **Engine**: PostgreSQL 14+
- **Instance class**: `db.t3.micro` (dev) or `db.t3.small`+ (prod)
- **Storage**: 20GB gp3
- **VPC**: Create in a private subnet
- **Security Group**: Allow inbound PostgreSQL (5432) from Lambda security group

**Via AWS Console:**
1. Go to RDS → Create database
2. Choose PostgreSQL
3. Select your instance size
4. Configure VPC settings (use private subnets)
5. Note the endpoint hostname

**Or via CLI:**
```bash
aws rds create-db-instance \
  --db-instance-identifier invy-dev \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 14 \
  --master-username postgres \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name your-subnet-group
```

### 2. SSM Parameter Store

Store your configuration in SSM Parameter Store. The Lambda function reads these on cold start (cached for 5 minutes).

**Required parameters** (replace `{stage}` with `dev` or `prod`):

```bash
# Database connection
aws ssm put-parameter --name "/invy/{stage}/db/host" --value "your-rds-endpoint.region.rds.amazonaws.com" --type String
aws ssm put-parameter --name "/invy/{stage}/db/port" --value "5432" --type String
aws ssm put-parameter --name "/invy/{stage}/db/username" --value "postgres" --type String
aws ssm put-parameter --name "/invy/{stage}/db/password" --value "your-password" --type SecureString
aws ssm put-parameter --name "/invy/{stage}/db/database" --value "invy" --type String

# CORS origins (comma-separated)
aws ssm put-parameter --name "/invy/{stage}/allowed-origins" --value "https://your-domain.com" --type String
```

**Example for dev:**
```bash
aws ssm put-parameter --name "/invy/dev/db/host" --value "invy-dev.xxxxx.eu-west-1.rds.amazonaws.com" --type String
aws ssm put-parameter --name "/invy/dev/db/port" --value "5432" --type String
aws ssm put-parameter --name "/invy/dev/db/username" --value "postgres" --type String
aws ssm put-parameter --name "/invy/dev/db/password" --value "super-secret-password" --type SecureString
aws ssm put-parameter --name "/invy/dev/db/database" --value "invy" --type String
aws ssm put-parameter --name "/invy/dev/allowed-origins" --value "http://localhost:5173,https://invy-dev.your-domain.com" --type String
```

### 3. VPC Configuration (for RDS access)

Lambda needs VPC access to reach RDS in private subnets.

**Create or identify:**
- **VPC** with private subnets
- **Security Group** for Lambda (outbound to RDS on 5432)
- **NAT Gateway** if Lambda needs internet access (for external APIs)

**Add VPC config to SSM:**
```bash
aws ssm put-parameter --name "/invy/{stage}/vpc/sg-id" --value "sg-xxxxxxxx" --type String
aws ssm put-parameter --name "/invy/{stage}/vpc/subnet-1" --value "subnet-xxxxxxxx" --type String
aws ssm put-parameter --name "/invy/{stage}/vpc/subnet-2" --value "subnet-yyyyyyyy" --type String
```

**Then uncomment VPC config in `apps/api/serverless.yml`:**
```yaml
vpc:
  securityGroupIds:
    - ${ssm:/invy/${self:provider.stage}/vpc/sg-id}
  subnetIds:
    - ${ssm:/invy/${self:provider.stage}/vpc/subnet-1}
    - ${ssm:/invy/${self:provider.stage}/vpc/subnet-2}
```

### 4. S3 Bucket (for Webapp)

Create S3 buckets for the static webapp:

```bash
# Dev bucket
aws s3 mb s3://invy-webapp-dev --region eu-west-1

# Prod bucket
aws s3 mb s3://invy-webapp-prod --region eu-west-1
```

**Configure for static hosting:**
```bash
aws s3 website s3://invy-webapp-dev --index-document index.html --error-document index.html
```

**Bucket policy for public access** (or use CloudFront OAI):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::invy-webapp-dev/*"
    }
  ]
}
```

### 5. CloudFront Distribution (Production)

For production, serve the webapp via CloudFront:

1. Create a CloudFront distribution
2. Origin: Your S3 bucket
3. Default root object: `index.html`
4. Error pages: Redirect 404 to `/index.html` (SPA fallback)
5. Enable HTTPS with ACM certificate

### 6. IAM Permissions

The Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/invy/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*"
    }
  ]
}
```

Serverless Framework creates most of this automatically, but you may need to add SSM permissions.

---

## Deployment Steps

### First-Time Setup

1. **Set up AWS infrastructure** (RDS, SSM params, S3 buckets)

2. **Run database migrations** locally against RDS:
   ```bash
   # Set environment variables pointing to RDS
   export DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
   export DB_USERNAME=postgres
   export DB_PASSWORD=your-password
   export DB_DATABASE=invy

   cd apps/api
   npm run migration:run
   ```

3. **Deploy API:**
   ```bash
   pnpm deploy:api:dev
   ```

4. **Update webapp API URL** in `.env`:
   ```bash
   VITE_API_URL=https://xxxxxx.execute-api.eu-west-1.amazonaws.com/dev/api/v1
   ```

5. **Deploy webapp:**
   ```bash
   pnpm deploy:webapp:dev
   ```

### Subsequent Deployments

```bash
# Deploy everything
pnpm deploy:all:dev

# Or individually
pnpm deploy:api:dev
pnpm deploy:webapp:dev
```

---

## Environment Summary

| Component | Dev | Prod |
|-----------|-----|------|
| API | Lambda + API Gateway | Lambda + API Gateway |
| Database | RDS PostgreSQL | RDS PostgreSQL |
| Webapp | S3 | S3 + CloudFront |
| Config | SSM `/invy/dev/*` | SSM `/invy/prod/*` |
| Region | eu-west-1 | eu-west-1 |

---

## Monitoring

- **Lambda logs**: CloudWatch Logs → `/aws/lambda/invy-api-{stage}-api`
- **API Gateway**: CloudWatch Metrics
- **RDS**: CloudWatch RDS metrics

---

## Cost Estimates (Dev)

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Lambda (1M requests) | ~$0.20 |
| API Gateway | ~$3.50 |
| RDS db.t3.micro | ~$15 |
| S3 + CloudFront | ~$1 |
| NAT Gateway (if used) | ~$32 |
| **Total** | **~$20-50/month** |

**Tips to reduce costs:**
- Use RDS in same AZ to avoid cross-AZ data transfer
- Consider Aurora Serverless v2 for variable workloads
- NAT Gateway is expensive - consider VPC endpoints for AWS services
