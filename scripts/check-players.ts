import { config } from "dotenv";
import { init } from "@instantdb/admin";
import schema from "../instant.schema";

// Load environment variables
config({ path: ".env.local" });

const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

async function checkPlayers() {
    const gameId = "3db18cc9-24f4-4a74-9581-4d354cab80dd";

    console.log(`\n🔍 Checking players for game: ${gameId}\n`);

    const data = await db.query({
        players: {
            $: {
                where: {
                    game: gameId
                }
            }
        }
    });

    console.log(`Found ${data.players.length} players:\n`);

    data.players.forEach((player: any, index: number) => {
        console.log(`Player ${index + 1}:`);
        console.log(`  ID: ${player.id}`);
        console.log(`  Name: ${player.name}`);
        console.log(`  Seat: ${player.seatNumber}`);
        console.log(`  Stack: ${player.stack}`);
        console.log(`  Model: ${player.model}`);
        console.log(``);
    });
}

checkPlayers().catch(console.error);
