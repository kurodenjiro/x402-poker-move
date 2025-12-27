#[test_only]
module x402::prediction_market_tests {
    use std::string;
    use std::signer;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use x402::prediction_market;

    struct AptosCoinCapabilities has key {
        mint_cap: coin::MintCapability<AptosCoin>,
    }

    /// Setup environment: create admin, user accounts, and initialize AptosCoin
    fun setup(admin: &signer, user1: &signer, user2: &signer): (address, address, address) {
        let admin_addr = signer::address_of(admin);
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);

        // Initialize AptosCoin (needed for testing Coin transfers)
        let framework_signer = account::create_signer_for_test(@0x1);
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(&framework_signer);

        // Create accounts
        account::create_account_for_test(admin_addr);
        account::create_account_for_test(user1_addr);
        account::create_account_for_test(user2_addr);

        // Register for AptosCoin
        coin::register<AptosCoin>(admin);
        coin::register<AptosCoin>(user1);
        coin::register<AptosCoin>(user2);

        // Mint initial funds
        let coins_u1 = coin::mint(1000, &mint_cap);
        coin::deposit(user1_addr, coins_u1);
        
        let coins_u2 = coin::mint(1000, &mint_cap);
        coin::deposit(user2_addr, coins_u2);

        // Clean up caps
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);

        (admin_addr, user1_addr, user2_addr)
    }

    #[test(admin = @x402, user1 = @0x123, user2 = @0x456)]
    public entry fun test_flow(admin: &signer, user1: &signer, user2: &signer) {
        let (_admin_addr, user1_addr, user2_addr) = setup(admin, user1, user2);
        
        // Initialize module
        prediction_market::init_for_test(admin);

        let game_id = string::utf8(b"game_1");

        // 1. Initialize Market
        prediction_market::initialize_market(admin, game_id);

        // 2. Place Bets
        // User 1 bets 100 on Seat 0
        prediction_market::place_bet(user1, game_id, 0, 100);
        assert!(coin::balance<AptosCoin>(user1_addr) == 900, 10);

        // User 2 bets 200 on Seat 1
        prediction_market::place_bet(user2, game_id, 1, 200);
        assert!(coin::balance<AptosCoin>(user2_addr) == 800, 11);

        // User 1 bets another 100 on Seat 0
        prediction_market::place_bet(user1, game_id, 0, 100);
        assert!(coin::balance<AptosCoin>(user1_addr) == 800, 12);

        // Total Pool should be 400
        // Seat 0 pool: 200
        // Seat 1 pool: 200

        // 3. Resolve Market (Seat 0 wins)
        prediction_market::resolve_market(admin, game_id, 0);

        // 4. Claim Winnings
        // User 1 should win: (200 bet / 200 total on winner) * 400 total pool = 400
        prediction_market::claim_winnings(user1, game_id);
        
        // 800 (remaining) + 400 (winnings) = 1200
        assert!(coin::balance<AptosCoin>(user1_addr) == 1200, 13);

        // User 2 attempts to claim (should fail or return nothing, here it aborts)
        // prediction_market::claim_winnings(user2, game_id); // This would abort
    }
}
