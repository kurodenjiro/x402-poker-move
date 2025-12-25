import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";
import schema from "@/instant.schema";

// Initialize InstantDB
const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');

        if (!playerId) {
            return NextResponse.json({ error: "Player ID required" }, { status: 400 });
        }

        // Query for agent wallet linked to this player
        const result = await db.query({
            players: {
                $: {
                    where: {
                        id: playerId
                    }
                }
            },
            agentWallets: {}
        });

        const player = result.players?.[0];
        if (!player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }

        // Find agent wallet by seat number
        const agentWallet = result.agentWallets?.find((wallet: any) =>
            wallet.seatNumber === player.seatNumber
        );

        return NextResponse.json({
            playerId,
            agentWalletId: agentWallet?.id || null,
            agentName: agentWallet?.agentName || null,
            address: agentWallet?.address || null
        });
    } catch (error) {
        console.error("Failed to get agent wallet:", error);
        return NextResponse.json(
            { error: "Failed to get agent wallet" },
            { status: 500 }
        );
    }
}
