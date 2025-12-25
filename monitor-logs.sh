#!/bin/bash
# Monitor Next.js dev server logs for wallet creation and payments

GAME_ID="067160f3-4222-40f5-b215-dfce00b0acd1"

echo "🔍 Watching for wallet/payment logs..."
echo "Game ID: $GAME_ID"
echo ""

# Function to check logs
check_logs() {
    echo "=== Checking for Wallet Creation Logs ==="
    if grep -q "Generating.*agent wallets" /tmp/dev-server.log 2>/dev/null; then
        grep -A 5 "Generating.*agent wallets" /tmp/dev-server.log | tail -10
    else
        echo "❌ No wallet creation logs found yet"
    fi
    
    echo ""
    echo "=== Checking for Gas Buffer Logs ==="
    if grep -q "Gas buffer" /tmp/dev-server.log 2>/dev/null; then
        grep -B 2 -A 2 "Gas buffer" /tmp/dev-server.log | tail -10
    else
        echo "❌ No gas buffer logs found yet"
    fi
    
    echo ""
    echo "=== Checking for Payment Processing Logs ==="
    if grep -q "Processing agent payments" /tmp/dev-server.log 2>/dev/null; then
        grep -A 10 "Processing agent payments" /tmp/dev-server.log | tail -20
    else
        echo "❌ No payment processing logs found yet"
    fi
    
    echo ""
    echo "=== Checking for Success/Failure ==="
    if grep -q "SUCCESS! TxHash" /tmp/dev-server.log 2>/dev/null; then
        echo "✅ PAYMENT SUCCESS FOUND!"
        grep "SUCCESS! TxHash" /tmp/dev-server.log | tail -3
    elif grep -q "INSUFFICIENT_BALANCE" /tmp/dev-server.log 2>/dev/null; then
        echo "❌ PAYMENT FAILED - INSUFFICIENT BALANCE"
        grep -B 5 "INSUFFICIENT_BALANCE" /tmp/dev-server.log | tail -10
    elif grep -q "Wallets not found" /tmp/dev-server.log 2>/dev/null; then
        echo "❌ WALLETS NOT FOUND ERROR"
        grep "Wallets not found" /tmp/dev-server.log | tail -3
    else
        echo "⏳ No payment attempts logged yet"
    fi
}

check_logs
