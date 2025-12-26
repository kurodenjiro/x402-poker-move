import { NextRequest, NextResponse } from 'next/server';
import { Client } from "@upstash/workflow";
import { id, init } from '@instantdb/admin';
import { DateTime } from "luxon";
import type { AIProvider } from '@/engine/ai-player';

// Force dynamic rendering - skip static analysis at build time
export const dynamic = 'force-dynamic';

export interface PlayerConfig {
  model: string;
  seatNumber?: number;
  emptySeat?: boolean;
}

// Initialize database for creating pending game records
const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID || "",
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN || "",
});

// Get base URL for workflow endpoints
const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { players, startingStack, numberOfHands } = body as {
      players: PlayerConfig[];
      startingStack: number;
      numberOfHands: number;
    };

    // Get API key from environment variable (Vercel AI Gateway only)
    const apiKey = process.env.V_GATEWAY_API_KEY;
    const provider = 'vercel-ai-gateway' as const;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'V_GATEWAY_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    // Validate input
    if (!players || !Array.isArray(players) || players.length !== 6) {
      return NextResponse.json(
        { error: 'Please provide exactly 6 player configurations' },
        { status: 400 }
      );
    }

    // Validate each player configuration
    for (let i = 0; i < players.length; i++) {
      const player = players[i];

      // Empty seats don't need a model
      if (player.emptySeat) {
        continue;
      }

      // Non-empty seats must have a model
      if (!player.model || typeof player.model !== 'string') {
        return NextResponse.json(
          { error: `Player at position ${i} must have a valid model or be marked as an empty seat` },
          { status: 400 }
        );
      }
    }



    if (startingStack < 100 || startingStack > 100000) {
      return NextResponse.json(
        { error: 'Starting stack must be between 100 and 100,000' },
        { status: 400 }
      );
    }

    if (numberOfHands < 1 || numberOfHands > 100) {
      return NextResponse.json(
        { error: 'Number of hands must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Generate a game ID upfront to return to the client
    // If gameId is provided (from payment/wallet creation), use it
    // Otherwise generate a new one
    const gameId = body.gameId || id();
    const isFromPayment = !!body.gameId;

    console.log(`🎮 Using game ID: ${gameId}${isFromPayment ? ' (from payment)' : ' (new)'}`)

      ;

    // Create or update game record
    // If gameId came from payment, the game entity already exists with payment/wallet links
    // We need to UPDATE it without breaking those relationships
    const placeholderPlayerId = id();

    if (isFromPayment) {
      // Game already exists from payment - just update game-specific fields
      // and add placeholder player
      console.log(`♻️  Updating existing game from payment: ${gameId}`);
      await db.transact([
        db.tx.games[gameId].merge({
          totalRounds: numberOfHands,
          buttonPosition: 0,
          currentActivePosition: null,
          deck: { cards: [] },
          customGame: true,
          // Note: createdAt already set during payment, don't overwrite
        }),
        // Create a placeholder player so the frontend doesn't see "no players"
        db.tx.players[placeholderPlayerId]
          .update({
            name: "Initializing...",
            stack: 0,
            status: "folded",
            model: "initializing",
            createdAt: DateTime.now().toISO(),
          })
          .link({ game: gameId })
      ]);
    } else {
      // New game (no payment) - create from scratch
      console.log(`🆕 Creating new game: ${gameId}`);
      await db.transact([
        db.tx.games[gameId].merge({
          totalRounds: numberOfHands,
          createdAt: DateTime.now().toISO(),
          buttonPosition: 0,
          currentActivePosition: null,
          deck: { cards: [] },
          customGame: true,
        }),
        // Create a placeholder player so the frontend doesn't see "no players"
        db.tx.players[placeholderPlayerId]
          .update({
            name: "Initializing...",
            stack: 0,
            status: "folded",
            model: "initializing",
            createdAt: DateTime.now().toISO(),
          })
          .link({ game: gameId })
      ]);
    }

    // Trigger the Upstash Workflow
    // The workflow will delete the placeholder and create real players
    const client = new Client({
      token: process.env.QSTASH_TOKEN!,
      baseUrl: process.env.QSTASH_URL || undefined, // Use local QStash server if specified
    });
    const baseUrl = getBaseUrl();
    console.log('baseUrl', baseUrl);
    console.log('QSTASH_URL', process.env.QSTASH_URL);
    console.log('QSTASH_TOKEN', process.env.QSTASH_TOKEN ? 'present' : 'missing');
    const { workflowRunId } = await client.trigger({
      url: `${baseUrl}/api/workflow/start-custom-game`,
      body: {
        gameId,
        players,
        startingStack,
        numberOfHands,
        apiKey,
        provider,
      },
      retries: 1,
    });

    // Return the game ID directly
    return NextResponse.json({
      simulationId: gameId,
      message: 'Simulation started successfully',
      workflowRunId
    });

  } catch (error) {
    console.error('Error starting simulation:', error);
    return NextResponse.json(
      { error: 'Failed to start simulation' },
      { status: 500 }
    );
  }
}
