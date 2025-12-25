import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";
import schema from "@/instant.schema";

const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

export async function POST(request: NextRequest) {
    try {
        const { roundId } = await request.json();

        console.log(`\n💰 ========== Processing payments for round: ${roundId} ==========`);

        // Get transactions for this round with player relations
        // NOTE: transactions link to gameRound via relationship, not a roundId field
        const data = await db.query({
            transactions: {
                $: {
                    where: {
                        gameRound: roundId  // ← This is a relationship, not a field!
                    }
                },
                player: {
                    game: {}
                }
            }
        });

        const transactions = data.transactions || [];

        console.log(`📝 Found ${transactions.length} transactions for round ${roundId}\n`);

        // Log all transactions with full player details
        console.log(`🔍 Transaction Details:`);
        transactions.forEach((tx: any, index: number) => {
            const player = tx.player;
            console.log(`  [${index + 1}] Player: ${player?.name || 'Unknown'} (Seat ${player?.seatNumber || '?'}, ID: ${player?.id?.slice(0, 8) || 'N/A'})`);
            console.log(`      Amount: ${tx.amount}, Credit: ${tx.credit}, Delta: ${tx.credit ? '+' : '-'}${tx.amount}`);
        });

        // Group transactions by player to calculate net chip change
        const playerChanges: Record<string, number> = {};
        const playerInfo: Record<string, any> = {};

        console.log(`\n📊 Calculating chip changes:`);
        for (const tx of transactions) {
            const player = tx.player;
            const playerId = player?.id;

            if (!playerId) {
                console.warn(`⚠️  Transaction ${tx.id} has no player relationship, skipping`);
                continue;
            }

            // Store player info
            if (!playerInfo[playerId]) {
                playerInfo[playerId] = {
                    name: player.name,
                    seatNumber: player.seatNumber,
                    id: playerId
                };
                console.log(`  📌 Tracking new player: ${player.name} (Seat ${player.seatNumber}, ID: ${playerId.slice(0, 8)})`);
            }

            if (!playerChanges[playerId]) {
                playerChanges[playerId] = 0;
            }

            const delta = tx.credit ? tx.amount : -tx.amount;
            playerChanges[playerId] += delta;

            console.log(`  ${tx.credit ? '➕' : '➖'} ${player.name} (Seat ${player.seatNumber}): ${delta > 0 ? '+' : ''}${delta} chips → Total: ${playerChanges[playerId]}`);
        }

        console.log(`\n💰 Final Chip Changes by Player:`);
        const playerIds = Object.keys(playerChanges);
        console.log(`  Total unique players: ${playerIds.length}`);

        for (const [playerId, change] of Object.entries(playerChanges)) {
            const info = playerInfo[playerId];
            console.log(`  • ${info?.name} (Seat ${info?.seatNumber}, ID: ${playerId.slice(0, 8)}): ${change > 0 ? '+' : ''}${change} chips`);
        }

        // Get gameId from first transaction's player->game relationship
        const gameId = transactions[0]?.player?.game?.id;

        if (!gameId) {
            console.error("❌ Could not find gameId from transaction relationships");
            return NextResponse.json({ success: false, error: "No gameId" }, { status: 400 });
        }

        // Get agent wallets for this game to filter AI players only
        const agentData = await db.query({
            agentWallets: {
                $: {
                    where: {
                        game: gameId
                    }
                }
            }
        });

        const agentWallets = agentData.agentWallets || [];
        const agentSeatNumbers = new Set(agentWallets.map((w: any) => w.seatNumber));

        console.log(`\n🤖 Found ${agentWallets.length} agent wallets for game ${gameId}`);
        console.log(`   Agent seats: ${Array.from(agentSeatNumbers).join(', ')}`);

        // Identify losers (negative change) and winners (positive change)
        // ONLY for AI players with agent wallets
        const losers = [];
        const winners = [];

        console.log(`\n🎯 Determining Losers and Winners:`);
        for (const [playerId, change] of Object.entries(playerChanges)) {
            const info = playerInfo[playerId];
            const hasWallet = agentSeatNumbers.has(info?.seatNumber);

            if (change < 0) {
                if (hasWallet) {
                    losers.push({ playerId, chipsLost: Math.abs(change) });
                    console.log(`  ❌ LOSER: ${info?.name} (Seat ${info?.seatNumber}) lost ${Math.abs(change)} chips`);
                } else {
                    console.log(`  ⚠️  Loser ${info?.name} (Seat ${info?.seatNumber}) has no agent wallet, skipping`);
                }
            } else if (change > 0) {
                if (hasWallet) {
                    winners.push({ playerId, chipsWon: change });
                    console.log(`  ✅ WINNER: ${info?.name} (Seat ${info?.seatNumber}) won ${change} chips`);
                } else {
                    console.log(`  ⚠️  Winner ${info?.name} (Seat ${info?.seatNumber}) has no agent wallet, skipping`);
                }
            } else {
                console.log(`  ⚖️  EVEN: ${info?.name} (Seat ${info?.seatNumber}) broke even (0 chips)`);
            }
        }

        console.log(`\n📊 Summary: ${losers.length} losers, ${winners.length} winners`);
        console.log(`   (Filtered to AI players with agent wallets only)`);

        // Call the payment processing API
        if (losers.length > 0 && winners.length > 0) {
            console.log(`✅ Conditions met for payment processing! Calling payment API...`);

            // gameId already retrieved above

            console.log(`  Game ID: ${gameId}`);
            console.log(`  Losers:`, losers.map((l: any) => `${playerInfo[l.playerId]?.name} (-${l.chipsLost})`).join(', '));
            console.log(`  Winners:`, winners.map((w: any) => `${playerInfo[w.playerId]?.name} (+${w.chipsWon})`).join(', '));

            const paymentResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/process-agent-payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    losers,
                    winners,
                    gameId
                })
            });

            const paymentResult = await paymentResponse.json();
            console.log(`💳 Payment API response:`, paymentResult);
            console.log(`========== Payment processing complete ==========\n`);

            return NextResponse.json({
                success: true,
                roundId,
                losers: losers.length,
                winners: winners.length,
                payments: paymentResult.payments || 0
            });
        }

        console.log(`⚠️  No payments needed (need both losers AND winners)`);
        console.log(`========== Payment processing complete ==========\n`);

        return NextResponse.json({
            success: true,
            roundId,
            message: "No payments needed"
        });

    } catch (error: any) {
        console.error("❌ Failed to trigger hand payments:", error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
