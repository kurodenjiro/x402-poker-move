// Game initialization and setup functions

import { init, id } from '@instantdb/admin';
import { DateTime } from "luxon";
import { logger } from './logger';
import { Player } from './types';
import { GAME_CONFIG, AI_MODELS, createDeck, OPENROUTER_MODELS } from './constants';
import { shuffle } from './utils';

import { generateAgentWallet, distributeToAgents, accountFromPrivateKey } from '@/lib/agent-wallets';
import { chipsToOctas } from '@/lib/agent-payments';

// Initialize database
export const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID || "",
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN || "",
});

// Helper for funding agents from server wallet
const SERVER_PRIVATE_KEY = process.env.MOVEMENT_SERVER_PRIVATE_KEY || process.env.MOVEMENT_PRIVATE_KEY;

/**
 * Initialize a new game with configurable settings
 * @param handsPerGame - Number of hands to play in the game
 * @param initialStack - Starting stack size for each player
 * @param triggerHandleId - The trigger handle ID to save in the game record
 * @returns Game ID and initial game state
 */
export async function initializeGame(
  handsPerGame: number = GAME_CONFIG.HANDS_PER_GAME,
  initialStack: number = GAME_CONFIG.INITIAL_STACK,
  triggerHandleId?: string
): Promise<{
  gameId: string;
  players: Record<string, Player>;
}> {
  const deck = createDeck();
  shuffle(deck);
  const gameId = id();

  // Create game record
  await db.transact(
    db.tx.games[gameId].merge({
      totalRounds: handsPerGame,
      createdAt: DateTime.now().toISO(),
      buttonPosition: 0,
      currentActivePosition: 3,
      deck: { cards: deck },
      jobHandleId: triggerHandleId,
    })
  );

  logger.log("Game created", { gameId, triggerHandleId });

  // Initialize players with custom stack size
  const players = await initializePlayers(gameId, initialStack);

  return { gameId, players };
}

/**
 * Initialize all players for the game
 * @param gameId - The game ID to link players to
 * @param initialStack - Starting stack size for each player
 * @returns Record of initialized players
 */
async function initializePlayers(gameId: string, initialStack: number): Promise<Record<string, Player>> {
  const players: Record<string, Player> = {};

  for (let i = 0; i < GAME_CONFIG.PLAYER_COUNT; i++) {
    const playerId = id();
    const model = AI_MODELS[i].model;

    await db.transact(
      db.tx.players[playerId]
        .update({
          name: AI_MODELS[i].name,
          stack: initialStack,
          status: "active",
          model: AI_MODELS[i].model,
          createdAt: DateTime.now().toISO(),
        })
        .link({ game: gameId })
    );

    players[playerId] = {
      id: playerId,
      cards: [],
      stack: initialStack,
      model: model,
    };

    logger.log("Player created", { playerId, model });
  }

  return players;
}

/**
 * Reset players who have run out of chips
 * @param players - Current player states
 * @param initialStack - Stack size to reset players to
 */
export async function resetBustedPlayers(
  players: Record<string, Player>,
  initialStack: number = GAME_CONFIG.INITIAL_STACK
): Promise<void> {
  const bustedPlayers = Object.values(players).filter(player => player.stack <= 0);

  for (const player of bustedPlayers) {
    await db.transact(
      db.tx.players[player.id].update({
        stack: initialStack,
      })
    );

    players[player.id].stack = initialStack;
    logger.log("Player reset", { playerId: player.id, newStack: initialStack });
  }
}

/**
 * Update game state with new button and active positions
 * @param gameId - Game ID to update
 * @param buttonPosition - New button position
 * @param deck - Current deck state
 */
export async function updateGameState(
  gameId: string,
  buttonPosition: number,
  deck: string[]
): Promise<void> {
  const activePosition = (buttonPosition + 4) % GAME_CONFIG.PLAYER_COUNT;

  await db.transact(
    db.tx.games[gameId].merge({
      buttonPosition,
      currentActivePosition: activePosition,
      deck: { cards: deck },
    })
  );
}

/**
 * Clear the active position when a round ends
 * @param gameId - Game ID to update
 */
export async function clearActivePosition(gameId: string): Promise<void> {
  await db.transact(
    db.tx.games[gameId].merge({
      currentActivePosition: null,
    })
  );
}

export interface PlayerConfig {
  model: string;
  seatNumber?: number;
  emptySeat?: boolean;
}

/**
 * Initialize a custom game with user-configured players
 * @param playerConfigs - Array of player configurations
 * @param initialStack - Starting stack size for each player
 * @param handsPerGame - Number of hands to play in the game
 * @param providedGameId - Optional game ID to use instead of generating one
 * @param triggerHandleId - The trigger handle ID to save in the game record
 * @returns Game ID and initial game state
 */
export async function initializeCustomGame(
  playerConfigs: PlayerConfig[],
  initialStack: number,
  handsPerGame: number,
  providedGameId?: string,
  triggerHandleId?: string
): Promise<{
  gameId: string;
  players: Record<string, Player>;
}> {
  const deck = createDeck();
  shuffle(deck);
  const gameId = providedGameId || id();

  // Create game record
  await db.transact(
    db.tx.games[gameId].merge({
      totalRounds: handsPerGame,
      createdAt: DateTime.now().toISO(),
      buttonPosition: 0,
      currentActivePosition: 3,
      deck: { cards: deck },
      customGame: true,
      jobHandleId: triggerHandleId,
    })
  );

  logger.log("Custom game created", { gameId, triggerHandleId });

  // Delete any placeholder players that were created during the initial game setup
  // These are temporary players with model "initializing"
  const existingGame = await db.query({
    games: {
      $: { where: { id: gameId } },
      players: {}
    }
  });

  const placeholderPlayers = existingGame.games[0]?.players?.filter(
    (p: any) => p.model === "initializing"
  ) || [];

  if (placeholderPlayers.length > 0) {
    logger.log("Deleting placeholder players", { count: placeholderPlayers.length });
    for (const placeholder of placeholderPlayers) {
      await db.transact(db.tx.players[placeholder.id].delete());
    }
  }

  // Initialize players with custom configurations
  const players: Record<string, Player> = {};

  for (let i = 0; i < playerConfigs.length; i++) {
    const playerId = id();
    const config = playerConfigs[i];
    const seatNumber = config.seatNumber ?? i;

    // Handle empty seats
    if (config.emptySeat) {
      await db.transact(
        db.tx.players[playerId]
          .update({
            name: `Empty Seat ${seatNumber + 1}`,
            stack: 0,
            status: "folded",
            model: "empty",
            seatNumber: seatNumber,
            emptySeat: true,
            createdAt: DateTime.now().toISO(),
          })
          .link({ game: gameId })
      );

      players[playerId] = {
        id: playerId,
        cards: [],
        stack: 0,
        model: "empty",
      };

      logger.log("Empty seat created", { playerId, seatNumber });
      continue;
    }

    // Handle AI players
    const model = config.model;
    const modelName = OPENROUTER_MODELS.find(m => m.id === model)?.name ||
      model.split('/').pop() ||
      model;

    await db.transact(
      db.tx.players[playerId]
        .update({
          name: modelName,
          stack: initialStack,
          status: "active",
          model: model,
          seatNumber: seatNumber,
          createdAt: DateTime.now().toISO(),
        })
        .link({ game: gameId })
    );

    players[playerId] = {
      id: playerId,
      cards: [],
      stack: initialStack,
      model: model,
    };

    logger.log("AI player created", { playerId, model, seatNumber });
  }

  // --- NEW: Generate Agent Wallets (Required for Sponsored Transactions) ---
  try {
    const aiPlayerConfigs = playerConfigs.filter(p => !p.emptySeat);

    if (aiPlayerConfigs.length > 0) {
      logger.log(`🤖 Generating wallets for ${aiPlayerConfigs.length} AI agents...`);

      // Find the players we just created to link wallets to them
      const gameQuery = await db.query({
        games: {
          $: { where: { id: gameId } },
          players: {}
        }
      });

      const dbPlayers = gameQuery.games[0]?.players || [];
      const agentAddresses: string[] = [];

      for (const player of dbPlayers) {
        // Skip empty seats
        if (player.emptySeat) continue;

        const wallet = generateAgentWallet();
        const walletId = id();

        await db.transact(
          db.tx.agentWallets[walletId].update({
            address: wallet.address,
            privateKey: wallet.privateKey, // Stored for the session
            seatNumber: player.seatNumber,
            agentName: player.name,
            balance: 0,
            initialBalance: 0,
            createdAt: Date.now(),
          })
            .link({ game: gameId })
        );

        agentAddresses.push(wallet.address);
        logger.log("  ✅ Wallet created", { seat: player.seatNumber, address: wallet.address });
      }

      // Fund agents if server key is available
      // We need to fund them with the ACTUAL VALUE of their chips in MOVE
      if (SERVER_PRIVATE_KEY && agentAddresses.length > 0) {
        try {
          const amountPerAgent = chipsToOctas(initialStack);
          logger.log(`💰 Funding agents from server wallet (${initialStack} chips = ${amountPerAgent / 100_000_000} MOVE)...`);
          const serverAccount = accountFromPrivateKey(SERVER_PRIVATE_KEY);

          // Fund agents (non-blocking)
          try {
            await distributeToAgents(serverAccount, agentAddresses, amountPerAgent);
          } catch (error) {
            console.error("⚠️ Failed to fund agents. Payments may fail, but game will proceed.", error);
          }
          logger.log("✅ Agents successfully funded");
        } catch (fundError) {
          logger.error("❌ Failed to fund agents:", fundError as any);
        }
      } else {
        logger.warn("⚠️ MOVEMENT_SERVER_PRIVATE_KEY missing - Agents created but NOT FUNDED");
      }
    }
  } catch (walletError) {
    logger.error("❌ Error setting up agent wallets:", walletError as any);
  }

  return { gameId, players };
} 