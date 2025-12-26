
import { init, id } from '@instantdb/admin';
import { DateTime } from "luxon";
import schema from "@/instant.schema";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Add this to debug if env vars are loaded
console.log("App ID:", process.env.NEXT_PUBLIC_INSTANT_APP_ID ? "Loaded" : "Missing");
console.log("Admin Token:", process.env.INSTANT_APP_ADMIN_TOKEN ? "Loaded" : "Missing");

const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

const GAME_ID = "ca40b5ea-e629-488b-8ffd-5236681827b0";

async function testPlayerCreation() {
    console.log("Testing player creation...");

    // Test 1: Using DateTime.now().toISO() (String)
    try {
        const p1 = id();
        console.log(`Attempting create with ISO String ID: ${p1}`);
        const tx = db.tx.players[p1].update({
            name: "Debug Player String",
            stack: 1000,
            status: "active",
            model: "debug",
            createdAt: DateTime.now().toISO(),
        }).link({ game: GAME_ID });

        await db.transact(tx);
        console.log("✅ Success: DateTime.now().toISO()");
    } catch (e) {
        console.log("❌ Failed: DateTime.now().toISO()");
        // console.log(JSON.stringify(e, null, 2));
    }

    // Test 2: Using Date.now() (Number)
    try {
        const p2 = id();
        console.log(`Attempting create with Timestamp Number ID: ${p2}`);
        const tx = db.tx.players[p2].update({
            name: "Debug Player Number",
            stack: 1000,
            status: "active",
            model: "debug",
            createdAt: Date.now(),
        }).link({ game: GAME_ID });

        await db.transact(tx);
        console.log("✅ Success: Date.now()");
    } catch (e) {
        console.log("❌ Failed: Date.now()");
    }
}

testPlayerCreation();
