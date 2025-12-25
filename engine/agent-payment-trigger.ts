// Agent payment utilities for game simulation
import { logger } from './logger';

/**
 * Trigger agent-to-agent payment based on chip transfer
 * This calls the payment API to execute blockchain transactions
 */
export async function triggerAgentPayment({
    fromAgentId,
    toAgentId,
    chipAmount,
    handNumber,
    gameId
}: {
    fromAgentId: string;  // This is actually a player ID
    toAgentId: string;    // This is actually a player ID
    chipAmount: number;
    handNumber?: number;
    gameId?: string;
}) {
    try {
        // First, get the agent wallet IDs for these players
        const fromWallet = await getAgentWalletIdForPlayer(fromAgentId);
        const toWallet = await getAgentWalletIdForPlayer(toAgentId);

        if (!fromWallet || !toWallet) {
            logger.error("Could not find agent wallets for payment", {
                fromPlayerId: fromAgentId,
                toPlayerId: toAgentId,
                fromWallet,
                toWallet
            });
            return;
        }

        // Call the agent payment API with actual wallet IDs
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/agent-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fromAgentId: fromWallet,
                toAgentId: toWallet,
                chipAmount,
                handNumber,
                gameId
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error("Agent payment API failed", { error });
            return;
        }

        const result = await response.json();
        logger.log("✅ Agent payment triggered", {
            from: result.from,
            to: result.to,
            amount: result.amount,
            chipAmount: result.chipAmount,
            txHash: result.txHash
        });

        return result;
    } catch (error) {
        logger.error("❌ Failed to trigger agent payment", { error });
    }
}

/**
 * Get agent wallet ID from player ID
 * Queries the database to find the agent wallet associated with a player
 */
export async function getAgentWalletIdForPlayer(playerId: string): Promise<string | null> {
    try {
        // Direct fetch to the get-agent-wallet endpoint
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/get-agent-wallet?playerId=${playerId}`);

        if (!response.ok) {
            logger.error("Agent wallet API failed", {
                playerId,
                status: response.status
            });
            return null;
        }

        const data = await response.json();

        if (!data.agentWalletId) {
            logger.warn("No agent wallet found for player", {
                playerId,
                response: data
            });
            return null;
        }

        logger.log("Found agent wallet for player", {
            playerId,
            agentWalletId: data.agentWalletId,
            agentName: data.agentName
        });

        return data.agentWalletId;
    } catch (error) {
        logger.error("Failed to get agent wallet for player", { playerId, error });
        return null;
    }
}
