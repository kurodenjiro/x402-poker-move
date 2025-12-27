import { NextRequest, NextResponse } from "next/server";
import { aptos } from "@/lib/movement";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { PREDICTION_MARKET } from "@/app/config/contracts";

// This route is called server-side when a game starts
// It uses the admin/server wallet to initialize the market
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { gameId } = body;

        if (!gameId) {
            return NextResponse.json(
                { error: "Missing gameId" },
                { status: 400 }
            );
        }

        // Server wallet private key (same one used for deployment)
        // Fallback to the key we generated during deployment
        const serverPrivateKey = process.env.PREDICTION_MARKET_ADMIN_KEY || "A22AD4DC00A99F5E322A9F06E177290FC8FEDAD8FA341550D2FD8F86C768BAD3";

        if (!serverPrivateKey) {
            return NextResponse.json(
                { error: "Server wallet not configured" },
                { status: 500 }
            );
        }

        console.log("🎲 Initializing prediction market for game:", gameId);

        const privateKey = new Ed25519PrivateKey(serverPrivateKey);
        const adminAccount = Account.fromPrivateKey({ privateKey });

        // Build and submit transaction
        const transaction = await aptos.transaction.build.simple({
            sender: adminAccount.accountAddress,
            data: {
                function: PREDICTION_MARKET.FUNCTIONS.INITIALIZE_MARKET as `${string}::${string}::${string}`,
                functionArguments: [gameId],
            },
        });

        const pendingTxn = await aptos.signAndSubmitTransaction({
            signer: adminAccount,
            transaction,
        });

        const executedTxn = await aptos.waitForTransaction({
            transactionHash: pendingTxn.hash,
        });

        if (!executedTxn.success) {
            throw new Error("Market initialization failed");
        }

        console.log("✅ Market initialized:", pendingTxn.hash);

        return NextResponse.json({
            success: true,
            txHash: pendingTxn.hash,
            gameId,
        });

    } catch (error) {
        console.error("❌ Error initializing market:", error);

        // Check if market already exists (expected error)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("E_MARKET_ALREADY_EXISTS") ||
            errorMessage.includes("MARKET_ALREADY_EXISTS") ||
            errorMessage.includes("0x1")) { // Error code 1 often means "already exists"
            return NextResponse.json({
                success: true,
                message: "Market already initialized",
            });
        }

        return NextResponse.json(
            { error: errorMessage || "Failed to initialize market" },
            { status: 500 }
        );
    }
}
