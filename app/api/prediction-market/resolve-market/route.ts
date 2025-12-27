import { NextRequest, NextResponse } from "next/server";
import { aptos } from "@/lib/movement";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { PREDICTION_MARKET } from "@/app/config/contracts";

// Admin-only: Resolve the market with the winning seat
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { gameId, winnerSeatIndex } = body;

        if (!gameId || winnerSeatIndex === undefined) {
            return NextResponse.json(
                { error: "Missing gameId or winnerSeatIndex" },
                { status: 400 }
            );
        }

        // Server wallet private key
        const serverPrivateKey = process.env.PREDICTION_MARKET_ADMIN_KEY || "A22AD4DC00A99F5E322A9F06E177290FC8FEDAD8FA341550D2FD8F86C768BAD3";

        console.log("🏆 Resolving market for game:", gameId, "Winner seat:", winnerSeatIndex);

        const privateKey = new Ed25519PrivateKey(serverPrivateKey);
        const adminAccount = Account.fromPrivateKey({ privateKey });

        // Build and submit transaction
        const transaction = await aptos.transaction.build.simple({
            sender: adminAccount.accountAddress,
            data: {
                function: PREDICTION_MARKET.FUNCTIONS.RESOLVE_MARKET as `${string}::${string}::${string}`,
                functionArguments: [gameId, winnerSeatIndex],
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
            throw new Error("Market resolution failed");
        }

        console.log("✅ Market resolved:", pendingTxn.hash);

        return NextResponse.json({
            success: true,
            txHash: pendingTxn.hash,
            gameId,
            winnerSeatIndex,
        });

    } catch (error) {
        console.error("❌ Error resolving market:", error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if already resolved
        if (errorMessage.includes("E_MARKET_ALREADY_RESOLVED") || errorMessage.includes("ALREADY_RESOLVED")) {
            return NextResponse.json({
                success: true,
                message: "Market already resolved",
            });
        }

        return NextResponse.json(
            { error: errorMessage || "Failed to resolve market" },
            { status: 500 }
        );
    }
}
