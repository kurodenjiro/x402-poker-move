"use client";

import { useEffect, useRef } from "react";
import { init } from "@instantdb/react";
import schema from "@/instant.schema";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "";
const db = init({ appId: APP_ID, schema });

interface AgentPaymentProcessorProps {
    gameId: string;
}

/**
 * Watches for completed betting rounds and triggers agent payments automatically
 */
export default function AgentPaymentProcessor({ gameId }: AgentPaymentProcessorProps) {
    const processedRounds = useRef(new Set<string>());

    // Query the game with proper relationship structure, including transactions
    const { data } = db.useQuery({
        games: {
            $: {
                where: {
                    id: gameId
                }
            },
            players: {},
            gameRounds: {
                bettingRounds: {},
                transactions: {}  // ← Need this to detect completed hands
            }
        }
    });

    useEffect(() => {
        console.log('🔍 AgentPaymentProcessor useEffect triggered');
        console.log('📊 Data:', {
            hasGames: !!data?.games,
            gamesCount: data?.games?.length || 0,
            hasGameRounds: !!data?.games?.[0]?.gameRounds,
            gameRoundsCount: data?.games?.[0]?.gameRounds?.length || 0,
            gameId
        });

        if (!data?.games?.[0]) {
            console.log('⚠️ No game data, skipping payment check');
            return;
        }

        const game = data.games[0];
        const players = game.players || [];
        const gameRounds = game.gameRounds || [];

        if (!players.length || !gameRounds.length) {
            console.log('⚠️ Missing players or game rounds, skipping payment check');
            return;
        }

        console.log(`📋 Found ${gameRounds.length} game rounds to check`);

        // Each gameRound represents a poker hand
        for (const gameRound of gameRounds) {
            const roundId = gameRound.id;

            if (processedRounds.current.has(roundId)) {
                console.log(`⏭️ Already processed round: ${roundId}`);
                continue;
            }

            const bettingRounds = gameRound.bettingRounds || [];
            const transactions = gameRound.transactions || [];

            console.log(`🔎 Checking gameRound ${roundId}: ${bettingRounds.length} betting rounds (${bettingRounds.map((r: any) => r.type).join(', ')}), ${transactions.length} transactions`);

            // A hand is complete when there are BOTH debit and credit transactions
            // Debit = chips put into pot (bets, blinds)  
            // Credit = chips won from pot
            const hasDebit = transactions.some((t: any) => !t.credit);
            const hasCredit = transactions.some((t: any) => t.credit);
            const isComplete = transactions.length > 0 && hasDebit && hasCredit;

            if (isComplete) {
                console.log(`🎯 Detected completed hand: ${roundId} (${transactions.length} transactions)`);
                processedRounds.current.add(roundId);

                // Trigger payment processing
                triggerPaymentsForHand(roundId, players);
            }
        }
    }, [data, gameId]);

    return null; // This component is invisible
}

async function triggerPaymentsForHand(roundId: string, players: any[]) {
    try {
        console.log(`💸 Triggering payments for hand ${roundId}`);

        const response = await fetch('/api/trigger-hand-payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Payments triggered:`, result);
        } else {
            console.error(`❌ Payment trigger failed`);
        }
    } catch (error) {
        console.error(`❌ Failed to trigger payments:`, error);
    }
}
