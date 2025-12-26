import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// Movement Network Configuration
export const MOVEMENT_NETWORK = {
    name: "Movement Testnet",
    chainId: 27010, // Testnet chain ID
    rpcUrl: "https://testnet.movementnetwork.xyz/v1",
    explorerUrl: "https://explorer.movementnetwork.xyz",
};

// Initialize Aptos client for Movement
const config = new AptosConfig({
    network: Network.CUSTOM,
    fullnode: MOVEMENT_NETWORK.rpcUrl,
});

export const aptos = new Aptos(config);

// Payment configuration
export const PAYMENT_CONFIG = {
    // Exchange rate: 1 MOVE = 10,000 stack
    STACK_PER_MOVE: 10000,

    // Recipient address for poker game payments (update this with your address)
    RECIPIENT_ADDRESS: process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS || "0x1",

    // Minimum payment amount in MOVE
    MIN_PAYMENT_MOVE: 0.01,
};

/**
 * Pad an Ethereum-style address (40 chars) to Aptos/Movement format (64 chars)
 * @param address - The address to pad (with or without 0x prefix)
 * @returns Padded address in Aptos format (0x + 64 hex chars)
 */
export function padAddressToAptos(address: string): string {
    // Remove 0x prefix if present
    const cleanAddress = address.replace(/^0x/i, '');
    // Pad with leading zeros to 64 characters and add back 0x prefix
    return '0x' + cleanAddress.padStart(64, '0');
}

/**
 * Calculate payment amount in MOVE tokens based on stack and participants
 * @param startingStack - The starting stack for each player
 * @param numParticipants - Number of non-empty seats
 * @returns Payment amount in MOVE tokens
 */
export function calculatePaymentAmount(
    startingStack: number,
    numParticipants: number
): number {
    // Fixed entry fee of 0.2 MOVE per game
    // This funds all agent wallets
    return 0.2;
}

/**
 * Format MOVE amount for display
 */
export function formatMoveAmount(amount: number): string {
    return `${amount.toFixed(4)} MOVE`;
}

/**
 * Verify a payment transaction on Movement blockchain
 * @param txHash - Transaction hash to verify
 * @param expectedAmount - Expected payment amount in MOVE
 * @param sender - Sender's address
 * @returns True if payment is valid
 */
export async function verifyPayment(
    txHash: string,
    expectedAmount: number,
    sender: string
): Promise<boolean> {
    try {
        const transaction = await aptos.getTransactionByHash({
            transactionHash: txHash,
        });

        // Check if transaction is committed (has success property)
        // and verify it succeeded
        if ('success' in transaction && !transaction.success) {
            console.error("Transaction failed");
            return false;
        }

        // Additional verification logic can be added here
        // to check recipient, amount, etc.

        return true;
    } catch (error) {
        console.error("Error verifying payment:", error);
        return false;
    }
}
