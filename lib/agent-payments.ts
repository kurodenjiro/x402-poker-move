import { Account } from "@aptos-labs/ts-sdk";
import { aptos, padAddressToAptos } from "./movement";
import { accountFromPrivateKey } from "./agent-wallets";

export interface AgentPaymentTransfer {
    fromAddress: string;
    toAddress: string;
    amountInMove: number;
    chipAmount: number;
    handNumber?: number;
    gameId?: string;
}

/**
 * Transfer MOVE tokens between two agent wallets
 * @param fromPrivateKey - Sender's private key
 * @param toAddress - Receiver's address
 * @param amountInOctas - Amount to transfer in octas
 * @returns Transaction hash
 */
export async function transferBetweenAgents(
    fromPrivateKey: string,
    toAddress: string,
    amountInOctas: number
): Promise<string> {
    try {
        // Create account from private key
        const senderAccount = accountFromPrivateKey(fromPrivateKey);
        const senderAddress = padAddressToAptos(senderAccount.accountAddress.toString());
        const recipientAddress = padAddressToAptos(toAddress);

        console.log(`💸 Agent payment: ${senderAddress.slice(0, 10)}... → ${recipientAddress.slice(0, 10)}... (${amountInOctas / 100_000_000} MOVE)`);

        // Build transaction
        const transaction = await aptos.transaction.build.simple({
            sender: senderAddress,
            data: {
                function: "0x1::aptos_account::transfer",
                functionArguments: [recipientAddress, amountInOctas],
            },
        });

        // Sign transaction
        const senderAuthenticator = aptos.transaction.sign({
            signer: senderAccount,
            transaction,
        });

        // Submit transaction
        const pendingTx = await aptos.transaction.submit.simple({
            transaction,
            senderAuthenticator,
        });

        // Wait for confirmation
        const executedTx = await aptos.waitForTransaction({
            transactionHash: pendingTx.hash,
        });

        if (!executedTx.success) {
            throw new Error(`Agent payment transaction failed: ${pendingTx.hash}`);
        }

        console.log(`✅ Agent payment confirmed: ${executedTx.hash}`);
        return executedTx.hash;

    } catch (error) {
        console.error("❌ Agent payment transfer failed:", error);
        throw error;
    }
}

/**
 * Calculate MOVE amount from chip amount
 * @param chips - Number of chips
 * @returns Amount in MOVE tokens
 */
export function chipsToMove(chips: number): number {
    // Exchange rate: 1 MOVE = 10,000 chips
    return chips / 10_000;
}

/**
 * Calculate octas from chip amount
 * @param chips - Number of chips
 * @returns Amount in octas (1 MOVE = 100M octas)
 */
export function chipsToOctas(chips: number): number {
    const moveAmount = chipsToMove(chips);
    return Math.floor(moveAmount * 100_000_000);
}
