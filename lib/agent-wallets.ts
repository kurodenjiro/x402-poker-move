import { Account, Ed25519PrivateKey, Aptos } from "@aptos-labs/ts-sdk";
import { aptos, padAddressToAptos } from "./movement";

export interface AgentWallet {
    address: string;
    privateKey: string;
    account: Account;
}

/**
 * Generate a new wallet for an AI agent
 * @returns Agent wallet with address, private key, and account instance
 */
export function generateAgentWallet(): AgentWallet {
    // Generate new Ed25519 keypair
    const account = Account.generate();

    // Get the private key as hex string
    const privateKeyHex = account.privateKey.toString();

    // Get the address (already in correct format from Aptos SDK)
    const address = account.accountAddress.toString();

    console.log("🤖 Generated agent wallet:", {
        address: address.slice(0, 10) + "...",
        fullLength: address.length
    });

    return {
        address,
        privateKey: privateKeyHex,
        account
    };
}

/**
 * Create an account instance from a stored private key
 * @param privateKeyHex - The private key as hex string
 * @returns Account instance
 */
export function accountFromPrivateKey(privateKeyHex: string): Account {
    const privateKey = new Ed25519PrivateKey(privateKeyHex);
    return Account.fromPrivateKey({ privateKey });
}

/**
 * Distribute funds from server wallet to multiple agent wallets
 * @param serverAccount - The server account that will send funds
 * @param agentAddresses - Array of agent wallet addresses
 * @param amountPerAgentInOctas - Amount to send to each agent in octas
 * @param aptos - Aptos client instance
 * @returns Array of transaction hashes
 */
export async function distributeToAgents(
    serverAccount: Account,
    agentAddresses: string[],
    amountPerAgentInOctas: number
): Promise<string[]> {
    const txHashes: string[] = [];

    console.log(`💸 Distributing ${amountPerAgentInOctas / 100_000_000} MOVE to ${agentAddresses.length} agents`);

    // Pad server address
    const serverAddress = padAddressToAptos(serverAccount.accountAddress.toString());

    for (const agentAddress of agentAddresses) {
        try {
            // Pad agent address to 64 characters
            const paddedAgentAddress = padAddressToAptos(agentAddress);

            console.log(`📤 Sending to agent: ${paddedAgentAddress.slice(0, 10)}...`);

            // Build transaction
            const transaction = await aptos.transaction.build.simple({
                sender: serverAddress,
                data: {
                    function: "0x1::aptos_account::transfer",
                    functionArguments: [paddedAgentAddress, amountPerAgentInOctas],
                },
            });

            // Sign transaction
            const senderAuthenticator = aptos.transaction.sign({
                signer: serverAccount,
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
                throw new Error(`Transaction failed for agent ${paddedAgentAddress}`);
            }

            console.log(`✅ Funded agent wallet: ${executedTx.hash}`);
            txHashes.push(executedTx.hash);

        } catch (error) {
            console.error(`❌ Failed to fund agent ${agentAddress}:`, error);
            throw error;
        }
    }

    console.log(`✅ Successfully distributed funds to ${txHashes.length} agents`);
    return txHashes;
}

/**
 * Get the balance of an agent wallet
 * @param agentAddress - The agent's wallet address
 * @returns Balance in MOVE tokens
 */
export async function getAgentBalance(agentAddress: string): Promise<number> {
    const paddedAddress = padAddressToAptos(agentAddress);

    try {
        const balanceInOctas = await aptos.getAccountAPTAmount({
            accountAddress: paddedAddress,
        });

        return balanceInOctas / 100_000_000;
    } catch (error) {
        console.error(`Failed to fetch balance for ${agentAddress}:`, error);
        return 0;
    }
}
