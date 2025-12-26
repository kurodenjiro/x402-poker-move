
import { init } from '@instantdb/admin';
import schema from "@/instant.schema";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

async function cleanupDatabase() {
    console.log("Cleaning up invalid records...");

    // 1. Find games without createdAt
    const games = await db.query({
        games: {
            $: {},
        }
    });

    const invalidGames = games.games.filter((g: any) => !g.createdAt || !g.totalRounds);
    console.log(`Found ${invalidGames.length} invalid games`);

    for (const game of invalidGames) {
        console.log(`Deleting game ${game.id}`);
        await db.transact(db.tx.games[game.id].delete());
    }

    // 2. Find players without createdAt or name
    const players = await db.query({
        players: {
            $: {},
        }
    });

    const invalidPlayers = players.players.filter((p: any) => !p.createdAt || !p.name || !p.status);
    console.log(`Found ${invalidPlayers.length} invalid players`);

    for (const player of invalidPlayers) {
        console.log(`Deleting player ${player.id}`);
        await db.transact(db.tx.players[player.id].delete());
    }

    console.log("Cleanup complete!");
}

cleanupDatabase();
