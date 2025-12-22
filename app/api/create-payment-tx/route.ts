import { NextRequest, NextResponse } from "next/server";
import { aptos, padAddressToAptos } from "@/lib/movement";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            senderAddress,
            recipientAddress,
            amountInOctas,
        } = body;

        console.log("✅ Creating payment transaction:", {
            sender: senderAddress,
            recipient: recipientAddress,
            amount: (amountInOctas / 100_000_000).toFixed(4) + " MOVE",
        });

        // Pad addresses to 64 characters (Aptos format)
        const paddedSenderAddress = padAddressToAptos(senderAddress);
        const paddedRecipientAddress = padAddressToAptos(recipientAddress);

        // Check sender's balance
        let balance = 0;
        try {
            balance = await aptos.getAccountAPTAmount({
                accountAddress: paddedSenderAddress,
            });
        } catch (error) {
            console.error("Failed to fetch balance:", error);

            // Check if it's a network/RPC error
            if (error instanceof Error && (
                error.message.includes("521") ||
                error.message.includes("Web server is down") ||
                error.message.includes("Request to") && error.message.includes("failed")
            )) {
                return NextResponse.json(
                    {
                        error: "Movement blockchain RPC is currently unavailable. Please try again later.",
                        rpcDown: true
                    },
                    { status: 503 }
                );
            }

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

        // Build the transaction payload
        const transaction = await aptos.transaction.build.simple({
            sender: paddedSenderAddress,
            data: {
                function: "0x1::aptos_account::transfer",
                functionArguments: [paddedRecipientAddress, amountInOctas],
            },
        });

        console.log("📝 Transaction payload created");

        // Return the unsigned transaction for the client to sign
        return NextResponse.json({
            success: true,
            transaction: transaction,
            message: "Transaction ready for signing",
            amount: amountInOctas / 100_000_000,
        });

    } catch (error) {
        console.error("❌ Payment error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Payment failed",
            },
            { status: 500 }
        );
    }
}
