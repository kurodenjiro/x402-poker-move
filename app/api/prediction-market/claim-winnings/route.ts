import { NextRequest, NextResponse } from "next/server";
import { aptos, padAddressToAptos } from "@/lib/movement";
import { generateSigningMessageForTransaction } from "@aptos-labs/ts-sdk";
import { PREDICTION_MARKET } from "@/app/config/contracts";

// Generate claim transaction for user to sign
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sender, gameId } = body;

        if (!sender || !gameId) {
            return NextResponse.json(
                { error: "Missing sender or gameId" },
                { status: 400 }
            );
        }

        console.log("💰 Building claim_winnings transaction for:", sender);

        const paddedSender = padAddressToAptos(sender);

        // Build the transaction
        const rawTxn = await aptos.transaction.build.simple({
            sender: paddedSender,
            data: {
                function: PREDICTION_MARKET.FUNCTIONS.CLAIM_WINNINGS as `${string}::${string}::${string}`,
                functionArguments: [gameId],
            },
        });

        // Generate signing message/hash
        const message = generateSigningMessageForTransaction(rawTxn);
        const hash = `0x${Buffer.from(message).toString('hex')}`;

        // Serialize raw transaction to hex
        const rawTxnBytes = rawTxn.bcsToBytes();
        const rawTxnHex = Buffer.from(rawTxnBytes).toString('hex');

        console.log("✅ Claim transaction hash generated");

        return NextResponse.json({
            hash,
            rawTxnHex,
            gameId,
        });

    } catch (error) {
        console.error("❌ Error generating claim transaction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate claim transaction" },
            { status: 500 }
        );
    }
}
