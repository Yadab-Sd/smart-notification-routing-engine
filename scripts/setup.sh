#!/bin/bash

# ============================================================================
# Smart Notification Routing Engine - One-Click Setup
# ============================================================================
# This script automates the complete development environment setup
# Usage: ./scripts/setup.sh
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}\n"
}

print_step() {
    echo -e "${GREEN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================
print_header "Step 1: Checking Prerequisites"

# Check Homebrew (macOS) or apt-get (Linux)
if [ "$OS" == "macos" ]; then
    if ! command_exists brew; then
        print_error "Homebrew not found. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        print_success "Homebrew installed"
    else
        print_success "Homebrew found"
    fi
elif [ "$OS" == "linux" ]; then
    if ! command_exists apt-get; then
        print_error "apt-get not found. This script requires a Debian-based Linux distribution."
        exit 1
    fi
    print_success "apt-get found"
fi

# ============================================================================
# Step 2: Install AWS CLI
# ============================================================================
print_header "Step 2: Installing AWS CLI"

if command_exists aws; then
    AWS_VERSION=$(aws --version | awk '{print $1}' | cut -d'/' -f2)
    print_success "AWS CLI already installed (version $AWS_VERSION)"
else
    print_step "Installing AWS CLI v2..."
    if [ "$OS" == "macos" ]; then
        brew install awscli
    elif [ "$OS" == "linux" ]; then
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip -q awscliv2.zip
        sudo ./aws/install
        rm -rf aws awscliv2.zip
    fi
    print_success "AWS CLI installed"
fi

# Configure AWS CLI
if [ ! -f ~/.aws/credentials ]; then
    print_warning "AWS credentials not configured"
    echo -e "${YELLOW}Please configure AWS CLI:${NC}"
    echo "  1. Get your AWS Access Key ID and Secret Access Key from AWS Console. (Or, email to contact@intelligent-routing.com)"
    echo "  2. Run: aws configure"
    echo "  3. Then re-run this script"
    exit 0
else
    print_success "AWS credentials configured"
fi

# Test AWS connection
print_step "Testing AWS connection..."
if ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null); then
    print_success "AWS connection successful (Account: $ACCOUNT_ID)"
    export ACCOUNT_ID
else
    print_error "Failed to connect to AWS. Please check your credentials."
    exit 1
fi

# ============================================================================
# Step 3: Install Node.js and pnpm
# ============================================================================
print_header "Step 3: Installing Node.js and pnpm"

if command_exists node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        print_success "Node.js $NODE_VERSION installed (>= 18 required)"
    else
        print_warning "Node.js $NODE_VERSION found, but version 18+ is required"
        print_step "Installing Node.js 18..."
        if [ "$OS" == "macos" ]; then
            brew install node@18
            brew link --overwrite node@18
        elif [ "$OS" == "linux" ]; then
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
            nvm install 18
            nvm use 18
        fi
        print_success "Node.js 18 installed"
    fi
else
    print_step "Installing Node.js 18..."
    if [ "$OS" == "macos" ]; then
        brew install node@18
    elif [ "$OS" == "linux" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install 18
        nvm use 18
    fi
    print_success "Node.js installed"
fi

# Install pnpm
if command_exists pnpm; then
    print_success "pnpm already installed"
else
    print_step "Installing pnpm..."
    npm install -g pnpm
    print_success "pnpm installed"
fi

# ============================================================================
# Step 4: Install Java 21
# ============================================================================
print_header "Step 4: Installing Java 21"

if command_exists java; then
    JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -ge 21 ]; then
        print_success "Java $JAVA_VERSION installed (>= 21 required)"
    else
        print_warning "Java $JAVA_VERSION found, but version 21 is required"
        print_step "Installing Java 21..."
        if [ "$OS" == "macos" ]; then
            brew install openjdk@21
            sudo ln -sfn /usr/local/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk
        elif [ "$OS" == "linux" ]; then
            sudo apt-get update
            sudo apt-get install -y openjdk-21-jdk
        fi
        print_success "Java 21 installed"
    fi
else
    print_step "Installing Java 21..."
    if [ "$OS" == "macos" ]; then
        brew install openjdk@21
        sudo ln -sfn /usr/local/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk
    elif [ "$OS" == "linux" ]; then
        sudo apt-get update
        sudo apt-get install -y openjdk-21-jdk
    fi
    print_success "Java 21 installed"
fi

# ============================================================================
# Step 5: Install Maven
# ============================================================================
print_header "Step 5: Installing Maven"

if command_exists mvn; then
    MVN_VERSION=$(mvn -version | grep "Apache Maven" | awk '{print $3}')
    print_success "Maven $MVN_VERSION already installed"
else
    print_step "Installing Maven..."
    if [ "$OS" == "macos" ]; then
        brew install maven
    elif [ "$OS" == "linux" ]; then
        sudo apt-get install -y maven
    fi
    print_success "Maven installed"
fi

# ============================================================================
# Step 6: Install AWS CDK
# ============================================================================
print_header "Step 6: Installing AWS CDK"

if command_exists cdk; then
    CDK_VERSION=$(cdk --version | awk '{print $1}')
    print_success "AWS CDK $CDK_VERSION already installed"
else
    print_step "Installing AWS CDK..."
    npm install -g aws-cdk
    print_success "AWS CDK installed"
fi

# ============================================================================
# Step 7: Bootstrap AWS CDK (if not already done)
# ============================================================================
print_header "Step 7: Bootstrapping AWS CDK"

print_step "Checking CDK bootstrap status..."
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-west-2"
    print_warning "No default region set, using us-west-2"
fi

# Check if bootstrap stack exists
if aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION >/dev/null 2>&1; then
    print_success "CDK already bootstrapped in $REGION"
else
    print_step "Bootstrapping CDK for account $ACCOUNT_ID in region $REGION..."
    cdk bootstrap aws://${ACCOUNT_ID}/${REGION}
    print_success "CDK bootstrapped"
fi

# ============================================================================
# Step 8: Install CDK Dependencies
# ============================================================================
print_header "Step 8: Installing CDK Dependencies"

cd infra/cdk
print_step "Installing npm packages..."
pnpm install
print_success "CDK dependencies installed"
cd ../..

# ============================================================================
# Step 9: Configure Environment
# ============================================================================
print_header "Step 9: Configuring Environment"

# Create .env file if it doesn't exist
if [ ! -f infra/cdk/.env ]; then
    print_step "Creating .env file..."
    if [ -f infra/cdk/.env.example ]; then
        cp infra/cdk/.env.example infra/cdk/.env
        print_success ".env file created from template"
        print_warning "Please edit infra/cdk/.env and set your SENDER_EMAIL"
        echo -e "${YELLOW}  nano infra/cdk/.env${NC}"
    else
        echo "SENDER_EMAIL=your-email@example.com" > infra/cdk/.env
        print_success ".env file created"
        print_warning "Please edit infra/cdk/.env and set your SENDER_EMAIL"
    fi
else
    print_success ".env file already exists"
    # Check if SENDER_EMAIL is configured
    SENDER_EMAIL=$(grep SENDER_EMAIL infra/cdk/.env | cut -d'=' -f2)
    if [[ "$SENDER_EMAIL" == *"example.com"* ]] || [[ "$SENDER_EMAIL" == *"CHANGE_ME"* ]]; then
        print_warning "SENDER_EMAIL not configured in infra/cdk/.env"
        print_warning "Please set a valid email address before deploying"
    else
        print_success "SENDER_EMAIL configured: $SENDER_EMAIL"
    fi
fi

# ============================================================================
# Step 10: Build Java Services
# ============================================================================
print_header "Step 10: Building Java Lambda Services"

print_step "Building all services (this may take 2-3 minutes)..."
chmod +x scripts/build-services.sh
./scripts/build-services.sh

print_success "All services built successfully"

# ============================================================================
# Step 11: Validate CDK Synthesis
# ============================================================================
print_header "Step 11: Validating CDK Configuration"

cd infra/cdk
print_step "Synthesizing CloudFormation templates..."
pnpm exec cdk synth > /dev/null
print_success "CDK synthesis successful"
cd ../..

# ============================================================================
# Setup Complete!
# ============================================================================
print_header "🎉 Setup Complete!"

echo -e "${GREEN}Your development environment is ready!${NC}\n"

echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. ${YELLOW}Configure sender email:${NC}"
echo -e "     ${GREEN}nano infra/cdk/.env${NC} (set SENDER_EMAIL)"
echo ""
echo -e "  2. ${YELLOW}Deploy infrastructure:${NC}"
echo -e "     ${GREEN}cd infra/cdk${NC}"
echo -e "     ${GREEN}pnpm exec cdk deploy --all${NC}"
echo ""
echo -e "  3. ${YELLOW}Verify deployment:${NC}"
echo -e "     ${GREEN}aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE --region $REGION${NC}"
echo ""
echo -e "  4. ${YELLOW}Test the API:${NC}"
echo -e "     See README.md 'Quick Start' section for authentication and testing"
echo ""
echo -e "${BLUE}Documentation:${NC} README.md"
echo -e "${BLUE}Support:${NC} https://github.com/Yadab-Sd/smart-notification-routing-engine/issues"
echo ""

# Save environment info for future reference
cat > .setup-info <<EOF
# Setup completed at $(date)
ACCOUNT_ID=$ACCOUNT_ID
REGION=$REGION
NODE_VERSION=$(node --version)
JAVA_VERSION=$(java -version 2>&1 | head -1)
MVN_VERSION=$(mvn -version | head -1)
AWS_CLI_VERSION=$(aws --version)
CDK_VERSION=$(cdk --version)
EOF

print_success "Setup information saved to .setup-info"
echo ""
