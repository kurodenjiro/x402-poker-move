import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";

const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gameId = searchParams.get("gameId");

        if (!gameId) {
            return NextResponse.json(
                { error: "Missing gameId parameter" },
                { status: 400 }
            );
        }

        // Query bets for this game from the database
        const result = await db.query({
            bets: {
                $: {
                    where: {
                        gameId,
                    },
                },
            },
        });

        const bets = result.bets || [];

        return NextResponse.json({
            bets,
            totalBets: bets.length,
            gameId,
        });

    } catch (error) {
        console.error("Error fetching bets:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch bets", bets: [] },
            { status: 200 } // Return 200 with empty bets to avoid breaking UI
        );
    }
}
