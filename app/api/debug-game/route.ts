import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";
import schema from "@/instant.schema";

const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

export async function GET(request: NextRequest) {
    const gameId = request.nextUrl.searchParams.get("gameId");

    if (!gameId) {
        return NextResponse.json({ error: "gameId required" }, { status: 400 });
    }

    try {
        const result = await db.query({
            games: {
                $: { where: { id: gameId } },
                players: {},
            },
        });

        return NextResponse.json({
            gameId,
            game: result.games[0] || null,
            playerCount: result.games[0]?.players?.length || 0,
            players: result.games[0]?.players || [],
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Query failed" },
            { status: 500 }
        );
    }
}
