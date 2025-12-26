import { NextRequest, NextResponse } from "next/server";
import { aptos } from "@/lib/movement";
import {
    AccountAuthenticatorEd25519,
    Ed25519PublicKey,
    Ed25519Signature,
    SimpleTransaction,
    Deserializer,
} from "@aptos-labs/ts-sdk";
import { init } from "@instantdb/admin";

const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { rawTxnHex, publicKey, signature, seatSelections, startingStack } = body;

        if (!rawTxnHex || !publicKey || !signature) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        console.log("📝 Received signed transaction");

        // Deserialize raw transaction from hex
        const rawTxnBytes = Buffer.from(rawTxnHex, 'hex');
        const deserializer = new Deserializer(new Uint8Array(rawTxnBytes));
        const rawTxn = SimpleTransaction.deserialize(deserializer);

        // Clean public key
        let cleanPublicKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
        if (cleanPublicKey.length === 66) {
            cleanPublicKey = cleanPublicKey.slice(2);
        }

        // Clean signature
        let cleanSignature = signature.startsWith('0x') ? signature.slice(2) : signature;

        console.log("🔑 Public key length:", cleanPublicKey.length);
        console.log("✍️ Signature length:", cleanSignature.length);

        // Create authenticator
        const senderAuthenticator = new AccountAuthenticatorEd25519(
            new Ed25519PublicKey(cleanPublicKey),
            new Ed25519Signature(cleanSignature)
        );

        // Submit transaction
        console.log("🚀 Submitting transaction to blockchain...");
        const committedTxn = await aptos.transaction.submit.simple({
            transaction: rawTxn,
            senderAuthenticator,
        });

        console.log("⏳ Waiting for confirmation...");
        const executedTransaction = await aptos.waitForTransaction({
            transactionHash: committedTxn.hash,
        });

        if (!executedTransaction.success) {
            throw new Error("Transaction failed on blockchain");
        }

        const txHash = committedTxn.hash;
        console.log("✅ Payment confirmed:", txHash);

        // Record payment and create game in database (optional)
        try {
            if (process.env.INSTANT_APP_ADMIN_TOKEN && process.env.NEXT_PUBLIC_INSTANT_APP_ID) {
                // Ensure wallet address is available, fallback to derived if needed (though PaymentModal sends it now)
                const userAddress = body.walletAddress || `0x${cleanPublicKey}`;

                const paymentId = crypto.randomUUID();
                await db.transact([
                    db.tx.payments[paymentId].merge({
                        txHash,
                        status: "confirmed",
                        amount: 0.2, // Hardcoded entry fee
                        currency: "MOVE",
                        walletAddress: userAddress,
                        paymentType: "entry_fee",
                        createdAt: Date.now(),
                        confirmedAt: Date.now(),
                    }),
                ]);

                // Create game
                const gameId = crypto.randomUUID();
                await db.transact([
                    db.tx.games[gameId].merge({
                        id: gameId,
                        startingStack,
                        seatSelections,
                        status: "active",
                        paymentTxHash: txHash,
                        createdAt: Date.now(),
                        totalRounds: 10, // Default rounds
                        buttonPosition: 0,
                        currentActivePosition: 0,
                        deck: { cards: [] }, // Initial empty deck
                    }),
                ]);

                console.log("🎮 Game created:", gameId);

                const explorerUrl = `https://explorer.movementnetwork.xyz/txn/${txHash}?network=testnet`;

                return NextResponse.json({
                    success: true,
                    txHash,
                    gameId,
                    explorerUrl,
                });
            }
        } catch (dbError) {
            console.warn("⚠️ Database operation failed:", dbError);
        }

        // If database is not configured, still return success with transaction
        const gameId = crypto.randomUUID();
        const explorerUrl = `https://explorer.movementnetwork.xyz/txn/${txHash}?network=testnet`;
        console.log("🎮 Payment successful, game ID:", gameId);

        return NextResponse.json({
            success: true,
            txHash,
            gameId,
            explorerUrl,
        });

    } catch (error) {
        console.error("❌ Error submitting transaction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to submit transaction" },
            { status: 500 }
        );
    }
}
