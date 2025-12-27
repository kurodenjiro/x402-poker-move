// Prediction Market Contract Configuration
export const PREDICTION_MARKET = {
    // Deployed contract address on Movement Testnet
    ADDRESS: "0xe76dfa821ef213232a5faff837bd3cd91d516cc75247896fb939f510cf7b732d",

    // Module name
    MODULE: "prediction_market",

    // Function paths
    FUNCTIONS: {
        INITIALIZE_MARKET: "0xe76dfa821ef213232a5faff837bd3cd91d516cc75247896fb939f510cf7b732d::prediction_market::initialize_market",
        PLACE_BET: "0xe76dfa821ef213232a5faff837bd3cd91d516cc75247896fb939f510cf7b732d::prediction_market::place_bet",
        RESOLVE_MARKET: "0xe76dfa821ef213232a5faff837bd3cd91d516cc75247896fb939f510cf7b732d::prediction_market::resolve_market",
        CLAIM_WINNINGS: "0xe76dfa821ef213232a5faff837bd3cd91d516cc75247896fb939f510cf7b732d::prediction_market::claim_winnings",
    },

    // Betting configuration
    MIN_BET_OCTAS: 1_000_000, // 0.01 MOVE minimum
    MAX_BET_OCTAS: 100_000_000_000, // 1000 MOVE maximum
};

// Helper to convert MOVE to Octas
export function moveToOctas(move: number): number {
    return Math.floor(move * 100_000_000);
}

// Helper to convert Octas to MOVE
export function octasToMove(octas: number): number {
    return octas / 100_000_000;
}
