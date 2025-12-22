import { NextRequest, NextResponse } from "next/server";
import { aptos } from "@/lib/movement";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const address = searchParams.get("address");

        if (!address) {
            return NextResponse.json(
                { error: "Address parameter is required" },
                { status: 400 }
            );
        }

        // Fetch balance from Movement blockchain
        const balance = await aptos.getAccountAPTAmount({
            accountAddress: address,
        });

        // Convert octas to MOVE (1 MOVE = 100,000,000 octas)
        const moveBalance = balance / 100_000_000;

        return NextResponse.json({
            success: true,
            balance: moveBalance,
            balanceOctas: balance,
        });

    } catch (error) {
        console.error("Error fetching balance:", error);

        // Check if it's a network/RPC error
        if (error instanceof Error && (
            error.message.includes("521") ||
            error.message.includes("Web server is down") ||
            (error.message.includes("Request to") && error.message.includes("failed"))
        )) {
            return NextResponse.json(
                {
                    error: "Movement blockchain RPC is currently unavailable. Please try again later.",
                    rpcDown: true
                },
                { status: 503 }
            );
        }

        // If account doesn't exist, return 0 balance
        if (error instanceof Error && error.message.includes("not found")) {
            return NextResponse.json({
                success: true,
                balance: 0,
                balanceOctas: 0,
            });
        }

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to fetch balance",
            },
            { status: 500 }
        );
    }
}
