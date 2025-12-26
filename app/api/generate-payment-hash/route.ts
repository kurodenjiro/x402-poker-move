import { NextRequest, NextResponse } from "next/server";
import { aptos } from "@/lib/movement";
import { generateSigningMessageForTransaction } from "@aptos-labs/ts-sdk";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sender, recipientAddress, amountInOctas } = body;

        if (!sender || !recipientAddress || !amountInOctas) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        console.log("🔨 Building transaction:", { sender, recipientAddress, amountInOctas });

        // Build the raw transaction
        const rawTxn = await aptos.transaction.build.simple({
            sender,
            data: {
                function: "0x1::aptos_account::transfer",
                functionArguments: [recipientAddress, amountInOctas],
            },
        });

        // Generate signing message/hash
        const message = generateSigningMessageForTransaction(rawTxn);
        const hash = `0x${Buffer.from(message).toString('hex')}`;

        // Serialize raw transaction to hex
        const rawTxnBytes = rawTxn.bcsToBytes();
        const rawTxnHex = Buffer.from(rawTxnBytes).toString('hex');

        console.log("✅ Transaction hash generated");

        return NextResponse.json({
            hash,
            rawTxnHex,
        });

    } catch (error) {
        console.error("❌ Error generating hash:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate hash" },
            { status: 500 }
        );
    }
}
