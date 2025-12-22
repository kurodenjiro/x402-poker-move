import { NextRequest, NextResponse } from "next/server";
import { init, id } from "@instantdb/admin";
import schema from "@/instant.schema";
import { aptos } from "@/lib/movement";
import { Account, Ed25519PrivateKey, AccountAddress } from "@aptos-labs/ts-sdk";

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
            transaction,
            senderAddress,
            recipientAddress,
            amountInOctas,
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

        // Save payment to database
        const paymentId = id();
        await db.transact([
            db.tx.payments[paymentId].update({
                txHash,
                amount: amountInOctas / 100_000_000,
                currency: "MOVE",
                walletAddress: senderAddress,
                status: "confirmed",
                createdAt: new Date(),
                confirmedAt: new Date(),
            }),
        ]);

        console.log("💾 Payment saved to database:", { paymentId, txHash });

        return NextResponse.json({
            success: true,
            txHash,
            paymentId,
            message: "Payment processed successfully",
            amount: amountInOctas / 100_000_000,
            explorerUrl: `https://explorer.movementlabs.xyz/txn/${txHash}`,
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
