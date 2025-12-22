import { NextRequest, NextResponse } from "next/server";
import { calculatePaymentAmount, PAYMENT_CONFIG, verifyPayment } from "@/lib/movement";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { startingStack, participants, walletAddress } = body;

        // Check if payment header exists
        const paymentHeader = request.headers.get("X-PAYMENT");

        if (!paymentHeader) {
            // No payment provided - return 402 with payment requirements
            const paymentAmount = calculatePaymentAmount(startingStack, participants);

            return NextResponse.json(
                {
                    error: "Payment Required",
                    payment: {
                        amount: paymentAmount,
                        currency: "MOVE",
                        recipient: PAYMENT_CONFIG.RECIPIENT_ADDRESS,
                        description: `Poker game entry fee (${startingStack} stack for ${participants} players)`,
                    },
                },
                {
                    status: 402,
                    headers: {
                        "X-Payment-Required": "true",
                        "X-Payment-Amount": paymentAmount.toString(),
                        "X-Payment-Currency": "MOVE",
                        "X-Payment-Recipient": PAYMENT_CONFIG.RECIPIENT_ADDRESS,
                    }
                }
            );
        }

        // Payment header provided - verify it
        try {
            const paymentData = JSON.parse(paymentHeader);
            const { txHash } = paymentData;

            if (!txHash) {
                return NextResponse.json(
                    { error: "Invalid payment data" },
                    { status: 400 }
                );
            }

            // Verify the payment transaction
            const expectedAmount = calculatePaymentAmount(startingStack, participants);
            const isValid = await verifyPayment(txHash, expectedAmount, walletAddress);

            if (!isValid) {
                return NextResponse.json(
                    { error: "Payment verification failed" },
                    { status: 402 }
                );
            }

            // Payment verified - return success
            return NextResponse.json({
                success: true,
                message: "Payment verified",
                txHash,
            });

        } catch (error) {
            console.error("Error processing payment:", error);
            return NextResponse.json(
                { error: "Invalid payment format" },
                { status: 400 }
            );
        }

    } catch (error) {
        console.error("Error in verify-payment:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
