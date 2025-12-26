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
            txHash,  // Optional: User-provided signed transaction hash (user-signed flow)
            seatSelections,
            startingStack,
        } = body;

        let finalTxHash: string;

        // Server-signed flow: Create, sign, and submit transaction
        if (!txHash) {
            console.log("📝 Server-signed payment flow:");

            if (!senderAddress || !recipientAddress || !amountInOctas) {
                throw new Error("senderAddress, recipientAddress, and amountInOctas are required for server-signed payments");
            }

            // Use server wallet to sign and submit
            const serverPrivateKey = process.env.MOVEMENT_PRIVATE_KEY;
            if (!serverPrivateKey) {
                throw new Error("Server wallet required for server-signed payments");
            }

            const privateKey = new Ed25519PrivateKey(serverPrivateKey);
            const serverAccount = Account.fromPrivateKey({ privateKey });

            console.log("✅ Creating and signing payment transaction:", {
                from: serverAccount.accountAddress.toString(),
                to: recipientAddress,
                amount: `${amountInOctas / 100_000_000} MOVE`
            });

            // Build and submit transaction
            const transaction = await aptos.transaction.build.simple({
                sender: serverAccount.accountAddress,
                data: {
                    function: "0x1::aptos_account::transfer",
                    functionArguments: [recipientAddress, amountInOctas],
                },
            });

            const committedTxn = await aptos.signAndSubmitTransaction({
                signer: serverAccount,
                transaction,
            });

            console.log("⏳ Waiting for server-signed transaction confirmation...");
            const executedTransaction = await aptos.waitForTransaction({
                transactionHash: committedTxn.hash,
            });

            if (!executedTransaction.success) {
                throw new Error("Server-signed transaction failed on blockchain");
            }

            finalTxHash = committedTxn.hash;
            console.log("✅ Server-signed transaction confirmed:", finalTxHash);
        }
        // User-signed flow: Wait for user's transaction
        else {
            console.log("✅ User-signed payment flow:");
            console.log("⏳ Waiting for user transaction confirmation:", txHash);

            const executedTransaction = await aptos.waitForTransaction({
                transactionHash: txHash,
            });

            console.log("✅ User transaction confirmed:", executedTransaction.hash);

            // Verify transaction was successful
            if (!executedTransaction.success) {
                throw new Error("User transaction failed on blockchain");
            }

            finalTxHash = txHash;
        }

        // Check if payment already exists in database
        const existingPayment = await db.query({
            payments: {
                $: {
                    where: {
                        txHash: finalTxHash
                    }
                }
            }
        });

        if (existingPayment?.payments && existingPayment.payments.length > 0) {
            const existing = existingPayment.payments[0];
            console.log("ℹ️ Payment already recorded in database:", {
                paymentId: existing.id,
                txHash: finalTxHash
            });

            return NextResponse.json({
                success: true,
                txHash: finalTxHash,
                paymentId: existing.id,
                message: "Payment already recorded",
                amount: 0.2,
                existing: true,
            });
        }

        // Generate game ID and create game entity in database
        const gameId = id();
        console.log(`🎮 Creating game entity with ID: ${gameId}`);

        // Create game entity first (required for relationships to work!)  
        await db.transact([
            db.tx.games[gameId].merge({
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
                    txHash: finalTxHash,
                    amount: 0.2,
                    currency: "MOVE",
                    walletAddress: senderAddress,
                    paymentType: "entry_fee",
                    status: "confirmed",
                    createdAt: Date.now(),
                    confirmedAt: Date.now(),
                })
                .link({ game: gameId }), // ← Link payment to game!
        ]);

        console.log("💾 Payment saved and linked to game:", { paymentId, txHash: finalTxHash, gameId });

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
                const chipsPerAgentInOctas = Math.floor(20_000_000 / aiAgents.length);
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

                // Distribute funds to agents - need server wallet for this
                const serverPrivateKey = process.env.MOVEMENT_PRIVATE_KEY;
                if (!serverPrivateKey) {
                    throw new Error("Server wallet required to fund agents");
                }

                const privateKey = new Ed25519PrivateKey(serverPrivateKey);
                const serverAccount = Account.fromPrivateKey({ privateKey });

                try {
                    distributionTxHashes = await distributeToAgents(
                        serverAccount,
                        agentWallets.map((w: any) => w.address),
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
            amount: 0.2,
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
