module x402::prediction_market {
    use std::string::String;
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::table::{Self, Table};
    use aptos_framework::account;
    use aptos_framework::event;

    /// Error codes
    const E_MARKET_ALREADY_EXISTS: u64 = 1;
    const E_MARKET_DOES_NOT_EXIST: u64 = 2;
    const E_MARKET_ALREADY_RESOLVED: u64 = 3;
    const E_NOT_AUTHORIZED: u64 = 4;
    const E_INVALID_SEAT_INDEX: u64 = 5;
    const E_NO_WINNINGS_TO_CLAIM: u64 = 6;
    const E_MARKET_NOT_RESOLVED: u64 = 7;

    /// Stores info about a single prediction market for a game
    struct Market has key, store {
        game_id: String,
        is_resolved: bool,
        winner_seat_index: vector<u8>, // Using vector as Option<u8> (empty = None, len 1 = Some)
        total_pool: u64,
        /// Maps seat index (0-5) to total amount bet on that seat
        seat_pools: vector<u64>,
        /// Maps user address -> seat index -> amount bet
        bets: Table<address, vector<u64>>,
        /// Resource signer capability to manage the held funds
        signer_cap: account::SignerCapability,
    }

    /// Global storage for all markets, accessible by admin
    struct MarketRegistry has key {
        markets: Table<String, Market>,
    }

    /// Events
    #[event]
    struct MarketCreated has drop, store {
        game_id: String,
    }

    #[event]
    struct BetPlaced has drop, store {
        game_id: String,
        user: address,
        seat_index: u8,
        amount: u64,
    }

    #[event]
    struct MarketResolved has drop, store {
        game_id: String,
        winner_seat_index: u8,
    }

    #[event]
    struct WinningsClaimed has drop, store {
        game_id: String,
        user: address,
        amount: u64,
    }

    /// Initialize the module. Called once when publishing.
    fun init_module(resource_signer: &signer) {
        move_to(resource_signer, MarketRegistry {
            markets: table::new(),
        });
    }

    /// Initialize a new market for a specific game.
    /// Only the module owner (admin) can doing this.
    public entry fun initialize_market(admin: &signer, game_id: String) acquires MarketRegistry {
        let admin_addr = signer::address_of(admin);
        // Only the module deployer can initialize markets (simplified for this demo)
        assert!(admin_addr == @x402, E_NOT_AUTHORIZED);

        let registry = borrow_global_mut<MarketRegistry>(@x402);
        assert!(!table::contains(&registry.markets, game_id), E_MARKET_ALREADY_EXISTS);

        // Create a resource account to hold funds for this market
        let (market_signer, signer_cap) = account::create_resource_account(admin, *std::string::bytes(&game_id));
        
        // Register the resource account to receive coins
        if (!coin::is_account_registered<AptosCoin>(signer::address_of(&market_signer))) {
            coin::register<AptosCoin>(&market_signer);
        };

        let seat_pools = vector::empty<u64>();
        let i = 0;
        while (i < 6) {
            vector::push_back(&mut seat_pools, 0);
            i = i + 1;
        };

        let market = Market {
            game_id,
            is_resolved: false,
            winner_seat_index: vector::empty(),
            total_pool: 0,
            seat_pools,
            bets: table::new(),
            signer_cap,
        };

        table::add(&mut registry.markets, game_id, market);
        
        event::emit(MarketCreated { game_id });
    }

    /// Place a bet on a specific agent (seat index).
    public entry fun place_bet(
        user: &signer,
        game_id: String,
        seat_index: u8,
        amount: u64
    ) acquires MarketRegistry { // Market is stored inside Registry table

        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<MarketRegistry>(@x402);
        assert!(table::contains(&registry.markets, game_id), E_MARKET_DOES_NOT_EXIST);

        let market = table::borrow_mut(&mut registry.markets, game_id);
        assert!(!market.is_resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(seat_index < 6, E_INVALID_SEAT_INDEX);

        // Transfer funds from user to market resource account
        let market_addr = account::get_signer_capability_address(&market.signer_cap);
        coin::transfer<AptosCoin>(user, market_addr, amount);

        // Update pools
        market.total_pool = market.total_pool + amount;
        let current_seat_pool = *vector::borrow(&market.seat_pools, (seat_index as u64));
        *vector::borrow_mut(&mut market.seat_pools, (seat_index as u64)) = current_seat_pool + amount;

        // Record user bet
        if (!table::contains(&market.bets, user_addr)) {
            let user_bets = vector::empty<u64>();
            let i = 0;
            while (i < 6) {
                vector::push_back(&mut user_bets, 0);
                i = i + 1;
            };
            table::add(&mut market.bets, user_addr, user_bets);
        };

        let user_bets_ref = table::borrow_mut(&mut market.bets, user_addr);
        let current_bet = *vector::borrow(user_bets_ref, (seat_index as u64));
        *vector::borrow_mut(user_bets_ref, (seat_index as u64)) = current_bet + amount;

        event::emit(BetPlaced {
            game_id,
            user: user_addr,
            seat_index,
            amount
        });
    }

    /// Resolve the market by setting the winner.
    public entry fun resolve_market(
        admin: &signer,
        game_id: String,
        winner_seat_index: u8
    ) acquires MarketRegistry {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @x402, E_NOT_AUTHORIZED);

        let registry = borrow_global_mut<MarketRegistry>(@x402);
        assert!(table::contains(&registry.markets, game_id), E_MARKET_DOES_NOT_EXIST);

        let market = table::borrow_mut(&mut registry.markets, game_id);
        assert!(!market.is_resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(winner_seat_index < 6, E_INVALID_SEAT_INDEX);

        market.is_resolved = true;
        vector::push_back(&mut market.winner_seat_index, winner_seat_index);

        event::emit(MarketResolved {
            game_id,
            winner_seat_index
        });
    }

    /// Claim winnings for a resolved market.
    public entry fun claim_winnings(
        user: &signer,
        game_id: String
    ) acquires MarketRegistry {
        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<MarketRegistry>(@x402);
        assert!(table::contains(&registry.markets, game_id), E_MARKET_DOES_NOT_EXIST);

        let market = table::borrow_mut(&mut registry.markets, game_id);
        assert!(market.is_resolved, E_MARKET_NOT_RESOLVED);

        // Check if user has bets
        if (!table::contains(&market.bets, user_addr)) {
            abort E_NO_WINNINGS_TO_CLAIM
        };

        let winner_seat = *vector::borrow(&market.winner_seat_index, 0);
        let user_bets = table::borrow(&market.bets, user_addr);
        let user_bet_on_winner = *vector::borrow(user_bets, (winner_seat as u64));

        if (user_bet_on_winner == 0) {
            abort E_NO_WINNINGS_TO_CLAIM
        };

        let total_bet_on_winner = *vector::borrow(&market.seat_pools, (winner_seat as u64));
        
        // Calculate winnings: (user_bet / total_winner_bet) * total_pool
        // Careful with overflow and integer division
        let winnings = (((user_bet_on_winner as u128) * (market.total_pool as u128)) / (total_bet_on_winner as u128));
        let winnings_u64 = (winnings as u64);

        // Transfer winnings
        let market_signer = account::create_signer_with_capability(&market.signer_cap);
        coin::transfer<AptosCoin>(&market_signer, user_addr, winnings_u64);

        // Ideally, we'd zero out the user's bet to prevent double claiming (if function wasn't removing)
        // Or store a "claimed" flag.
        // For simplicity: remove user's bets record entirely to prevent re-claiming
        table::remove(&mut market.bets, user_addr);

        event::emit(WinningsClaimed {
            game_id,
            user: user_addr,
            amount: winnings_u64
        });
    }

    #[test_only]
    public fun init_for_test(resource_signer: &signer) {
        init_module(resource_signer);
    }
}
