
import { Aptos, AptosConfig, Network, Account, AccountAddress, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import fs from "fs";
import path from "path";

// Configuration
const NETWORK = Network.CUSTOM;
const CONFIG = new AptosConfig({
    network: NETWORK,
    fullnode: "https://testnet.movementnetwork.xyz/v1",
    faucet: "https://faucet.testnet.movementnetwork.xyz/"
});
const aptos = new Aptos(CONFIG);

// Contract Address (matches the account we generated)
// We'll read the deploy key to reconstruct the signer
const KEY_PATH = path.join(process.cwd(), "contracts/prediction_market/deploy_key");

async function main() {
    console.log("Starting Prediction Market Test...");

    if (!fs.existsSync(KEY_PATH)) {
        console.error("Deploy key not found at:", KEY_PATH);
        return;
    }

    const privateKeyHex = fs.readFileSync(KEY_PATH, "utf-8").trim();
    const privateKey = new Ed25519PrivateKey(privateKeyHex);
    const account = Account.fromPrivateKey({ privateKey });

    console.log("Account Address:", account.accountAddress.toString());

    // Check balance
    try {
        const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
        console.log("Balance (APT):", balance / 100_000_000);

        if (balance < 100_000) {
            console.warn("WARNING: Low balance. Please fund the account via faucet.");
        }
    } catch (e) {
        console.error("Account likely invalid or not found on-chain. Please fund it.");
        return;
    }

    const contractParams = {
        function: `${account.accountAddress.toString()}::prediction_market::initialize_market`,
        typeArguments: [],
        functionArguments: ["game_test_123"]
    };

    try {
        console.log("Initializing Market...");
        const transaction = await aptos.transaction.build.simple({
            sender: account.accountAddress,
            data: {
                function: contractParams.function as "${string}::${string}::${string}",
                functionArguments: contractParams.functionArguments,
            },
        });

        const pendingTxn = await aptos.signAndSubmitTransaction({ signer: account, transaction });
        console.log("Init Transaction submitted:", pendingTxn.hash);
        await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
        console.log("Market Initialized!");

    } catch (e: any) {
        // Ignore if already exists for this test run
        if (e.message.includes("E_MARKET_ALREADY_EXISTS")) {
            console.log("Market already initialized.");
        } else {
            console.error("Init failed:", e);
        }
    }

    // Place Bet
    try {
        console.log("Placing Bet...");
        // 1 APT = 100,000,000 Octas. Bet 0.1 APT
        const betAmount = 10_000_000;

        const betTxn = await aptos.transaction.build.simple({
            sender: account.accountAddress,
            data: {
                function: `${account.accountAddress.toString()}::prediction_market::place_bet` as "${string}::${string}::${string}",
                functionArguments: ["game_test_123", 0, betAmount] // Bet on Seat 0
            },
        });

        const pendingBet = await aptos.signAndSubmitTransaction({ signer: account, transaction: betTxn });
        console.log("Bet Transaction submitted:", pendingBet.hash);
        await aptos.waitForTransaction({ transactionHash: pendingBet.hash });
        console.log("Bet Placed Successfully!");

    } catch (e) {
        console.error("Betting failed:", e);
    }
}

main().catch(console.error);
