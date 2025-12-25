#!/bin/bash

# Script to monitor dev server logs for wallet creation and payment processing

echo "🔍 Monitoring logs for the new game: 067160f3-4222-40f5-b215-dfce00b0acd1"
echo ""
echo "Looking for:"
echo "1. Wallet creation (gas buffer allocation)"
echo "2. Payment processing (agent transfers)"
echo ""
echo "=============================================="
echo ""

# Function to check if dev server is running
check_dev_server() {
    if pgrep -f "next dev" > /dev/null; then
        echo "✅ Dev server is running"
        return 0
    else
        echo "❌ Dev server is NOT running"
        echo "Please run: npm run dev"
        return 1
    fi
}

# Check server status
check_dev_server

# If logs exist in .next, search them
if [ -d ".next" ]; then
    echo ""
    echo "📋 Searching for wallet creation logs..."
    echo "=============================================="
    grep -r "Generating.*agent wallets" .next/server 2>/dev/null | tail -5 || echo "No wallet creation logs found"
    
    echo ""
    echo "📋 Searching for gas buffer allocation..."
    echo "=============================================="
    grep -r "Gas buffer" .next/server 2>/dev/null | tail -5 || echo "No gas buffer logs found"
    
    echo ""
    echo "📋 Searching for payment processing..."
    echo "=============================================="
    grep -r "Found.*agent wallets.*players for game" .next/server 2>/dev/null | tail -5 || echo "No payment logs found"
    
    echo ""
    echo "📋 Searching for seat number mapping..."
    echo "=============================================="
    grep -r "Creating wallet for seat" .next/server 2>/dev/null | tail -5 || echo "No seat mapping logs found"
fi

echo ""
echo "=============================================="
echo "To see LIVE logs, run: npm run dev"
echo "Then watch for the above messages to appear"
