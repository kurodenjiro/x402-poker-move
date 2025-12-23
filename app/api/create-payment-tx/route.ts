import { NextRequest, NextResponse } from "next/server";
import { aptos, padAddressToAptos } from "@/lib/movement";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            senderAddress,
            recipientAddress,
            amountInOctas,
        } = body;

        console.log("✅ Creating payment transaction:", {
            user: senderAddress,
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

        // Create server account from private key (this will be the actual payer)
        const privateKey = new Ed25519PrivateKey(serverPrivateKey);
        const serverAccount = Account.fromPrivateKey({ privateKey });
        const serverAddress = serverAccount.accountAddress.toString();

        console.log("💰 Server wallet will pay:", serverAddress);

        // Pad addresses to 64 characters (Aptos format)
        const paddedServerAddress = padAddressToAptos(serverAddress);
        const paddedRecipientAddress = padAddressToAptos(recipientAddress);

        // Check server's balance
        let balance = 0;
        try {
            balance = await aptos.getAccountAPTAmount({
                accountAddress: paddedServerAddress,
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
                { error: "Failed to fetch server wallet balance" },
                { status: 400 }
            );
        }

        if (balance < amountInOctas) {
            return NextResponse.json(
                {
                    error: `Server wallet has insufficient balance. Server has ${(balance / 100_000_000).toFixed(4)} MOVE but needs ${(amountInOctas / 100_000_000).toFixed(4)} MOVE`,
                    balance: balance / 100_000_000,
                    required: amountInOctas / 100_000_000,
                },
                { status: 400 }
            );
        }

        // Build the transaction payload with SERVER as sender
        const transaction = await aptos.transaction.build.simple({
            sender: paddedServerAddress,
            data: {
                function: "0x1::aptos_account::transfer",
                functionArguments: [paddedRecipientAddress, amountInOctas],
            },
        });

        console.log("📝 Transaction payload created");

        // Serialize transaction to base64 to avoid BigInt serialization issues
        const transactionBytes = transaction.bcsToBytes();
        const transactionBase64 = Buffer.from(transactionBytes).toString('base64');

        // Return the unsigned transaction for the server to sign
        return NextResponse.json({
            success: true,
            transaction: transactionBase64,
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
