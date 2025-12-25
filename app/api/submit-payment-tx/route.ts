import { NextRequest, NextResponse } from "next/server";
import { init, id } from "@instantdb/admin";
import schema from "@/instant.schema";
import { aptos } from "@/lib/movement";
import { Account, Ed25519PrivateKey, Deserializer, SimpleTransaction } from "@aptos-labs/ts-sdk";
import { generateAgentWallet, distributeToAgents } from "@/lib/agent-wallets";

// Initialize InstantDB
const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            transaction: transactionBase64,
            senderAddress,
            recipientAddress,
            amountInOctas,
            seatSelections, // Array of seat configurations
        } = body;

        console.log("✅ Submitting payment transaction:", {
            sender: senderAddress,
            recipient: recipientAddress,
            amount: (amountInOctas / 100_000_000).toFixed(4) + " MOVE",
        });

        // Check if we have a server private key
        const serverPrivateKey = process.env.MOVEMENT_PRIVATE_KEY;

        if (!serverPrivateKey) {
            throw new Error(
                "Server wallet not configured. Please set MOVEMENT_PRIVATE_KEY environment variable to enable real blockchain transactions."
            );
        }


        // Create server account from private key
        const privateKey = new Ed25519PrivateKey(serverPrivateKey);
        const serverAccount = Account.fromPrivateKey({ privateKey });

        console.log("🔐 Signing with server wallet:", serverAccount.accountAddress.toString());

        // Deserialize the transaction from base64
        const transactionBytes = Buffer.from(transactionBase64, 'base64');
        const deserializer = new Deserializer(new Uint8Array(transactionBytes));
        const transaction = SimpleTransaction.deserialize(deserializer);

        // Sign the transaction with server account
        const senderAuthenticator = aptos.transaction.sign({
            signer: serverAccount,
            transaction: transaction,
        });

        // Submit the signed transaction
        const pendingTransaction = await aptos.transaction.submit.simple({
            transaction: transaction,
            senderAuthenticator: senderAuthenticator,
        });

        console.log("📤 Transaction submitted:", pendingTransaction.hash);

        // Wait for transaction confirmation
        const executedTransaction = await aptos.waitForTransaction({
            transactionHash: pendingTransaction.hash,
        });

        console.log("✅ Transaction confirmed:", executedTransaction.hash);

        // Verify transaction was successful
        if (!executedTransaction.success) {
            throw new Error("Transaction failed on blockchain");
        }

        const txHash = executedTransaction.hash;

        // Check if payment already exists in database
        const existingPayment = await db.query({
            payments: {
                $: {
                    where: {
                        txHash: txHash
                    }
                }
            }
        });

        if (existingPayment?.payments && existingPayment.payments.length > 0) {
            const existing = existingPayment.payments[0];
            console.log("ℹ️ Payment already recorded in database:", {
                paymentId: existing.id,
                txHash
            });

            return NextResponse.json({
                success: true,
                txHash,
                paymentId: existing.id,
                message: "Payment already recorded",
                amount: amountInOctas / 100_000_000,
                existing: true,
            });
        }

        // Generate game ID and create game entity in database
        const gameId = id();
        console.log(`🎮 Creating game entity with ID: ${gameId}`);

        // Create game entity first (required for relationships to work!)
        await db.transact([
            db.tx.games[gameId].update({
                totalRounds: 0, // Will be updated when simulation runs
                deck: [],
                buttonPosition: 0,
                createdAt: Date.now(),
            }),
        ]);

        // Save payment to database with game link
        const paymentId = id();
        await db.transact([
            db.tx.payments[paymentId]
                .update({
                    txHash,
                    amount: amountInOctas / 100_000_000,
                    currency: "MOVE",
                    walletAddress: senderAddress,
                    paymentType: "entry_fee",
                    status: "confirmed",
                    createdAt: Date.now(),
                    confirmedAt: Date.now(),
                })
                .link({ game: gameId }), // ← Link payment to game!
        ]);

        console.log("💾 Payment saved and linked to game:", { paymentId, txHash, gameId });

        // Generate agent wallets and distribute funds
        let agentWalletIds: string[] = [];
        let distributionTxHashes: string[] = [];

        if (seatSelections && seatSelections.length > 0) {
            // Count AI agents (not empty seats)
            const aiAgents = seatSelections.filter((seat: any) =>
                seat && seat.type === "model"
            );

            if (aiAgents.length > 0) {
                console.log(`🤖 Generating ${aiAgents.length} agent wallets...`);

                // With sponsored transactions, agents don't need gas - sponsor pays it all!
                const chipsPerAgentInOctas = Math.floor(amountInOctas / aiAgents.length);
                console.log(`💰 Each agent gets: ${chipsPerAgentInOctas / 100_000_000} MOVE (chips only, gas sponsored)`);


                // Generate wallets for each AI agent
                // Track which original seat index each AI agent came from
                const agentWallets = aiAgents.map((seat: any) => {
                    const wallet = generateAgentWallet();
                    const actualSeatNumber = seatSelections.indexOf(seat);

                    console.log(`   Creating wallet for seat ${actualSeatNumber}: ${seat.model?.name}`);

                    return {
                        ...wallet,
                        seatNumber: actualSeatNumber,
                        modelName: seat.model?.name || "AI Agent",
                    };
                });

                // Distribute funds to agents
                try {
                    distributionTxHashes = await distributeToAgents(
                        serverAccount,
                        agentWallets.map(w => w.address),
                        chipsPerAgentInOctas
                    );

                    console.log(`✅ Distributed funds to ${agentWallets.length} agents`);

                    // Save agent wallets to database with game linkage
                    const agentWalletTransactions = agentWallets.map((wallet: any, index: any) => {
                        const agentWalletId = id();
                        agentWalletIds.push(agentWalletId);

                        return db.tx.agentWallets[agentWalletId]
                            .update({
                                address: wallet.address,
                                privateKey: wallet.privateKey, // TODO: Encrypt in production
                                seatNumber: wallet.seatNumber,
                                agentName: wallet.modelName || `Agent Seat ${wallet.seatNumber + 1}`,
                                balance: chipsPerAgentInOctas / 100_000_000, // Only chips (not gas buffer)
                                initialBalance: chipsPerAgentInOctas / 100_000_000,
                                createdAt: Date.now(),
                            })
                            .link({ game: gameId }); // Link wallet to game!
                    });

                    await db.transact(agentWalletTransactions);

                    console.log(`💾 Saved ${agentWallets.length} agent wallets to database`);
                } catch (error) {
                    console.error("❌ Failed to distribute funds to agents:", error);
                    // Continue anyway - payment was successful
                }
            }
        }

        return NextResponse.json({
            success: true,
            txHash,
            paymentId,
            gameId, // Return gameId for game creation
            message: "Payment processed successfully",
            amount: amountInOctas / 100_000_000,
            agentWallets: agentWalletIds.length > 0 ? {
                count: agentWalletIds.length,
                distributionTxHashes,
            } : undefined,
            explorerUrl: `https://explorer.movementnetwork.xyz/txn/${txHash}?network=testnet`,
        });

    } catch (error) {
        console.error("❌ Payment submission error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Payment submission failed",
            },
            { status: 500 }
        );
    }
}
