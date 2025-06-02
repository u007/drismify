#!/bin/bash

# MongoDB Test Runner for Drismify
# This script sets up MongoDB and runs the adapter tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        print_error "Please install Docker to run MongoDB tests"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        print_error "Please start Docker and try again"
        exit 1
    fi
}

# Check if MongoDB is already running
check_existing_mongodb() {
    if docker ps | grep -q "drismify-mongodb-test"; then
        print_warning "MongoDB test container is already running"
        return 0
    fi
    
    if docker ps -a | grep -q "drismify-mongodb-test"; then
        print_status "Removing existing MongoDB test container"
        docker rm -f drismify-mongodb-test
    fi
    
    return 1
}

# Start MongoDB using Docker Compose
start_mongodb() {
    print_status "Starting MongoDB for testing..."
    
    cd "$(dirname "$0")"
    
    if docker-compose up -d; then
        print_success "MongoDB container started"
    else
        print_error "Failed to start MongoDB container"
        exit 1
    fi
    
    # Wait for MongoDB to be ready
    print_status "Waiting for MongoDB to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose exec -T mongodb mongosh --username root --password 000000 --authenticationDatabase admin --eval "db.adminCommand('ping')" &> /dev/null; then
            print_success "MongoDB is ready!"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "MongoDB failed to start within timeout"
            docker-compose logs mongodb
            exit 1
        fi
        
        print_status "Attempt $attempt/$max_attempts - waiting for MongoDB..."
        sleep 2
        ((attempt++))
    done
}

# Run the tests
run_tests() {
    print_status "Running MongoDB adapter tests..."

    cd "$(dirname "$0")/../.."

    # Note: MongoDB connection details are now hardcoded in src/config/mongodb.config.ts
    # No need to set environment variables

    if bun test tests/009-mongodb-adapter/mongodb-adapter.test.ts; then
        print_success "All MongoDB adapter tests passed!"
        return 0
    else
        print_error "Some MongoDB adapter tests failed"
        return 1
    fi
}

# Clean up MongoDB
cleanup_mongodb() {
    print_status "Cleaning up MongoDB test environment..."
    
    cd "$(dirname "$0")"
    
    if docker-compose down -v; then
        print_success "MongoDB test environment cleaned up"
    else
        print_warning "Failed to clean up MongoDB test environment"
    fi
}

# Main execution
main() {
    print_status "Starting MongoDB adapter test suite"
    
    # Check prerequisites
    check_docker
    
    # Setup trap for cleanup
    trap cleanup_mongodb EXIT
    
    # Start MongoDB if not already running
    if ! check_existing_mongodb; then
        start_mongodb
    else
        print_status "Using existing MongoDB container"
    fi
    
    # Run tests
    if run_tests; then
        print_success "MongoDB adapter test suite completed successfully!"
        exit 0
    else
        print_error "MongoDB adapter test suite failed!"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    "start")
        check_docker
        start_mongodb
        print_success "MongoDB started. Run 'bun test tests/009-mongodb-adapter/mongodb-adapter.test.ts' to run tests"
        ;;
    "stop")
        cleanup_mongodb
        ;;
    "test")
        main
        ;;
    "")
        main
        ;;
    *)
        echo "Usage: $0 [start|stop|test]"
        echo "  start - Start MongoDB container only"
        echo "  stop  - Stop and clean up MongoDB container"
        echo "  test  - Run full test suite (default)"
        exit 1
        ;;
esac
