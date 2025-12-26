import { NextRequest, NextResponse } from "next/server";
import { init, id } from "@instantdb/admin";
import schema from "@/instant.schema";
import { transferBetweenAgents, chipsToOctas } from "@/lib/agent-payments";
import { getAgentBalance } from "@/lib/agent-wallets";

const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

export async function POST(request: NextRequest) {
    try {
        const { losers, winners, gameId } = await request.json();

        console.log("\n💸 ========== Processing agent payments ==========");
        console.log(`Losers: ${losers?.length}, Winners: ${winners?.length}`);

        if (!losers || !winners || losers.length === 0 || winners.length === 0) {
            return NextResponse.json({ success: true, message: "No payments to process" });
        }

        // Get agent wallets and players by querying the game directly to ensure links exist
        const gameData = await db.query({
            games: {
                $: {
                    where: {
                        id: gameId
                    }
                },
                players: {},
                agentWallets: {}
            }
        });

        const game = gameData.games[0];

        if (!game) {
            console.error(`❌ Game not found: ${gameId}`);
            return NextResponse.json({ error: "Game not found" }, { status: 404 });
        }

        const agentWallets = game.agentWallets || [];
        const dbPlayers = game.players || [];



        console.log(`Found ${agentWallets.length} agent wallets, ${dbPlayers.length} players for game ${gameId}`);

        const results = [];

        for (const loser of losers) {
            for (const winner of winners) {
                const paymentAmount = Math.floor(loser.chipsLost / winners.length);

                if (paymentAmount > 0) {
                    // Find wallets by seat number
                    const loserPlayer = dbPlayers.find((p: any) => p.id === loser.playerId);
                    const winnerPlayer = dbPlayers.find((p: any) => p.id === winner.playerId);

                    if (!loserPlayer || !winnerPlayer) {
                        console.warn("⚠️ Player not found", { loserPlayer: !!loserPlayer, winnerPlayer: !!winnerPlayer });
                        continue;
                    }

                    console.log(`  Players found: Loser seat ${loserPlayer.seatNumber}, Winner seat ${winnerPlayer.seatNumber}`);
                    console.log(`  Available wallets:`, agentWallets.map((w: any) => `Seat ${w.seatNumber} (${w.agentName})`).join(', '));

                    const loserWallet = agentWallets.find((w: any) => w.seatNumber === loserPlayer.seatNumber);
                    const winnerWallet = agentWallets.find((w: any) => w.seatNumber === winnerPlayer.seatNumber);

                    if (!loserWallet || !winnerWallet) {
                        console.warn("⚠️ Wallets not found", {
                            loserSeat: loserPlayer.seatNumber,
                            winnerSeat: winnerPlayer.seatNumber,
                            availableSeats: agentWallets.map((w: any) => w.seatNumber)
                        });
                        continue;
                    }

                    console.log(`\n💰 Transfer: ${loserWallet.agentName} → ${winnerWallet.agentName}`);
                    console.log(`  Chips: ${paymentAmount}`);
                    console.log(`  MOVE: ${chipsToOctas(paymentAmount) / 100_000_000}`);

                    try {
                        // Check balances BEFORE transfer
                        const loserBalance = await getAgentBalance(loserWallet.address);
                        const winnerBalance = await getAgentBalance(winnerWallet.address);

                        // Execute blockchain transfer
                        // Sponsored Transaction: Agent pays chips, Server pays gas
                        const transferAmount = chipsToOctas(paymentAmount);

                        console.log(`  📊 Balances BEFORE:`);
                        console.log(`     Loser (${loserWallet.agentName}): ${loserBalance} MOVE`);
                        console.log(`     Winner (${winnerWallet.agentName}): ${winnerBalance} MOVE`);
                        console.log(`  📦 Transfer amount: ${transferAmount / 100_000_000} MOVE`);
                        console.log(`  ⛽ Gas: Paid by Sponsor (Server Wallet)`);

                        // Ensure loser has enough chips (MOVE) for the transfer itself
                        if (loserBalance < (transferAmount / 100_000_000)) {
                            const error = `Insufficient balance! Wallet has ${loserBalance} MOVE but needs ${transferAmount / 100_000_000} MOVE to settle bet.`;
                            console.error(`  ❌ ${error}`);
                            results.push({ error });
                            continue;
                        }

                        // Execute blockchain transfer
                        // CRITICAL: Blockchain reserves gas BEFORE executing transfer
                        // Keep at least 0.1 MOVE in wallet to ensure gas can always be paid
                        // With sponsored transactions, transfer the full chip amount
                        // No need to reserve gas - sponsor wallet pays it!


                        console.log(`  📤 Transferring ${transferAmount / 100_000_000} MOVE (Sponsored Transaction)...`);
                        const txHash = await transferBetweenAgents(
                            loserWallet.privateKey,
                            winnerWallet.address,
                            transferAmount
                        );

                        console.log(`  ✅ Blockchain confirmed, attempting database save...`);

                        // Save to database with game link
                        const paymentId = id();
                        await db.transact([
                            db.tx.payments[paymentId]
                                .update({
                                    txHash,
                                    amount: paymentAmount / 10_000,
                                    currency: "MOVE",
                                    walletAddress: loserWallet.address, // Required field
                                    fromAddress: loserWallet.address,
                                    toAddress: winnerWallet.address,
                                    chipAmount: paymentAmount,
                                    paymentType: "agent_transfer",
                                    status: "confirmed",
                                    createdAt: Date.now(),
                                    confirmedAt: Date.now(),
                                })
                                .link({ game: gameId }), // ← Link payment to game!
                        ]);

                        console.log(`  ✅ SUCCESS! TxHash: ${txHash.slice(0, 10)}...`);

                        results.push({
                            from: loserWallet.agentName,
                            to: winnerWallet.agentName,
                            amount: paymentAmount / 10_000,
                            txHash
                        });
                    } catch (error: any) {
                        console.error(`  ❌ FAILED:`, error);
                        console.error(`  ❌ Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                        results.push({ error: error?.message || String(error) });
                    }
                }
            }
        }

        console.log(`\n📊 Summary: ${results.length} transfers attempted`);
        console.log(`========== Payment processing complete ==========\n`);

        return NextResponse.json({
            success: true,
            payments: results.length,
            results
        });
    } catch (error: any) {
        console.error("❌ Failed to process payments:", error.message);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
