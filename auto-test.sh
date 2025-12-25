#!/bin/bash

echo "🧪 AUTOMATED WALLET CREATION TEST"
echo "================================="
echo ""

# Clear previous logs
echo "📝 Clearing previous logs..."
> /tmp/dev-server.log
echo "✅ Logs cleared"
echo ""

# Kill existing dev server
echo "🔄 Restarting dev server..."
pkill -f "next dev" 2>/dev/null
sleep 2

# Start dev server in background
cd /Users/mac/dev/x402-poker-move-1
npm run dev > /tmp/dev-server.log 2>&1 &
DEV_PID=$!
echo "✅ Dev server started (PID: $DEV_PID)"
echo ""

# Wait for server to be ready
echo "⏳ Waiting for server to start (10 seconds)..."
sleep 10

echo "🎮 Server should be ready at http://localhost:3000"
echo ""
echo "📊 Monitoring logs for:"
echo "  - 🤖 Wallet generation"
echo "  - 💰 Gas buffer allocation"
echo "  - ✅ Wallet creation success"
echo "  - ❌ Any errors"
echo ""
echo "================================="
echo "LIVE LOG MONITORING (press Ctrl+C to stop)"
echo "================================="
echo ""

# Monitor logs in real-time
tail -f /tmp/dev-server.log | grep --line-buffered -E "(Generating|Gas buffer|Creating wallet|agent wallets|Payment|ERROR|Error)" &
TAIL_PID=$!

# Wait for user to stop
wait $TAIL_PID
