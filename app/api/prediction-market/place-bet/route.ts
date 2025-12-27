import { NextRequest, NextResponse } from "next/server";
import { aptos, padAddressToAptos } from "@/lib/movement";
import { generateSigningMessageForTransaction } from "@aptos-labs/ts-sdk";
import { PREDICTION_MARKET } from "@/app/config/contracts";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sender, gameId, seatIndex, amountInOctas } = body;

        if (!sender || !gameId || seatIndex === undefined || !amountInOctas) {
            return NextResponse.json(
                { error: "Missing required fields: sender, gameId, seatIndex, amountInOctas" },
                { status: 400 }
            );
        }

        // Validate seat index (0-5 for 6 players)
        if (seatIndex < 0 || seatIndex > 5) {
            return NextResponse.json(
                { error: "Invalid seat index. Must be 0-5." },
                { status: 400 }
            );
        }

        // Validate bet amount
        if (amountInOctas < PREDICTION_MARKET.MIN_BET_OCTAS) {
            return NextResponse.json(
                { error: `Minimum bet is ${PREDICTION_MARKET.MIN_BET_OCTAS / 100_000_000} MOVE` },
                { status: 400 }
            );
        }

        console.log("🎲 Building place_bet transaction:", { sender, gameId, seatIndex, amountInOctas });

        const paddedSender = padAddressToAptos(sender);

        // Check user's balance
        let balance = 0;
        try {
            balance = await aptos.getAccountAPTAmount({
                accountAddress: paddedSender,
            });
        } catch (error) {
            console.error("Failed to fetch balance:", error);
            return NextResponse.json(
                { error: "Failed to fetch wallet balance" },
                { status: 400 }
            );
        }

        if (balance < amountInOctas) {
            return NextResponse.json(
                {
                    error: `Insufficient balance. You have ${(balance / 100_000_000).toFixed(4)} MOVE but need ${(amountInOctas / 100_000_000).toFixed(4)} MOVE`,
                    balance: balance / 100_000_000,
                    required: amountInOctas / 100_000_000,
                },
                { status: 400 }
            );
        }

        // Build the transaction
        const rawTxn = await aptos.transaction.build.simple({
            sender: paddedSender,
            data: {
                function: PREDICTION_MARKET.FUNCTIONS.PLACE_BET as `${string}::${string}::${string}`,
                functionArguments: [gameId, seatIndex, amountInOctas],
            },
        });

        // Generate signing message/hash
        const message = generateSigningMessageForTransaction(rawTxn);
        const hash = `0x${Buffer.from(message).toString('hex')}`;

        // Serialize raw transaction to hex
        const rawTxnBytes = rawTxn.bcsToBytes();
        const rawTxnHex = Buffer.from(rawTxnBytes).toString('hex');

        console.log("✅ Place bet transaction hash generated");

        return NextResponse.json({
            hash,
            rawTxnHex,
            gameId,
            seatIndex,
            amount: amountInOctas / 100_000_000,
        });

    } catch (error) {
        console.error("❌ Error generating bet transaction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate transaction" },
            { status: 500 }
        );
    }
}
