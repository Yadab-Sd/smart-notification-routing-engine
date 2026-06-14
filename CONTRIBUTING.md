# Contributing to Intelligent Routing Engine

Thank you for your interest in contributing! This document provides guidelines for collaborators.

---

## Getting Started

### Prerequisites

Before contributing, you'll need:
- Git installed locally
- AWS access (see below)
- Basic knowledge of AWS CDK, Java (Spring Boot), and React

---

## AWS Access for Collaborators

**IMPORTANT**: You need AWS permissions to deploy/test changes.

### Request IAM Role Access

Contact **Yadab Sutradhar** to request AWS access:

- **Email**: contact@intelligent-routing.com
- **Subject**: AWS Access Request - Contributor

**What you'll get**:
- IAM role with write access to specific services only
- Permissions to deploy/test your changes
- No access to production data or billing
- **All costs borne by project maintainer**

**What to provide in your request**:
```
Name: [Your Name]
GitHub Username: [username]
Email: [your email]
Area of contribution: [Frontend/Backend/Infrastructure/ML]
AWS Account ID (if you have one): [optional]
```

**You'll receive**:
- IAM user credentials OR
- Instructions to assume a role from your AWS account

---

## Development Workflow

### 1. Fork & Clone

```bash
# Fork the repo on GitHub first
git clone https://github.com/YOUR_USERNAME/smart-notification-routing-engine.git
cd smart-notification-routing-engine
```

### 2. Set Up Environment

```bash
# Run one-click setup
./scripts/setup.sh

# Configure AWS credentials (provided by maintainer)
aws configure --profile ire-contributor
# Enter credentials from maintainer
```

### 3. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 4. Make Changes & Test

```bash
# Build services
./scripts/build-services.sh

# Deploy to test environment
cd infra/cdk
export AWS_PROFILE=ire-contributor
pnpm exec cdk deploy --all
```

### 5. Submit Pull Request

```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

Open PR on GitHub with clear description and test results.

---

## Code Standards

### Java (Backend)
- Java 21 with Spring Boot conventions
- Lombok for boilerplate
- JUnit 5 for tests

### TypeScript/React (Frontend)
- React 18 functional components
- TypeScript strict mode
- TailwindCSS for styling

### AWS CDK (Infrastructure)
- TypeScript for all stacks
- Environment variables for config
- Tag all resources

---

## Pull Request Checklist

- [ ] Code follows style guidelines
- [ ] Tests added for new features
- [ ] CDK synthesis successful
- [ ] No sensitive data in commits
- [ ] PR description clear

---

## Communication

- **GitHub Issues**: Bug reports, feature requests
- **Email**: contact@intelligent-routing.com (for AWS access)

---

## License

By contributing, you agree your contributions will be licensed under MIT License.

---

Thank you for contributing! 🎉
