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
        const { rawTxnHex, publicKey, signature, gameId, seatIndex, amount, walletAddress } = body;

        if (!rawTxnHex || !publicKey || !signature) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        console.log("📝 Received signed bet transaction");

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
        const cleanSignature = signature.startsWith('0x') ? signature.slice(2) : signature;

        console.log("🔑 Public key length:", cleanPublicKey.length);
        console.log("✍️ Signature length:", cleanSignature.length);

        // Create authenticator
        const senderAuthenticator = new AccountAuthenticatorEd25519(
            new Ed25519PublicKey(cleanPublicKey),
            new Ed25519Signature(cleanSignature)
        );

        // Submit transaction
        console.log("🚀 Submitting bet transaction to blockchain...");
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
        console.log("✅ Bet placed successfully:", txHash);

        // Record bet in database
        try {
            if (process.env.INSTANT_APP_ADMIN_TOKEN && process.env.NEXT_PUBLIC_INSTANT_APP_ID) {
                const betId = crypto.randomUUID();
                await db.transact([
                    db.tx.bets[betId].merge({
                        txHash,
                        gameId,
                        seatIndex,
                        amount,
                        walletAddress: walletAddress || `0x${cleanPublicKey}`,
                        status: "confirmed",
                        createdAt: Date.now(),
                    }),
                ]);
                console.log("📊 Bet recorded in database:", betId);
            }
        } catch (dbError) {
            console.warn("⚠️ Database operation failed:", dbError);
        }

        const explorerUrl = `https://explorer.movementnetwork.xyz/txn/${txHash}?network=testnet`;

        return NextResponse.json({
            success: true,
            txHash,
            explorerUrl,
            gameId,
            seatIndex,
            amount,
        });

    } catch (error) {
        console.error("❌ Error submitting bet transaction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to submit transaction" },
            { status: 500 }
        );
    }
}
