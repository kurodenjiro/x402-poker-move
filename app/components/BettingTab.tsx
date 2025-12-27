"use client";

import { useState, useEffect } from "react";
import { CircleNotch, Target, Trophy, CurrencyCircleDollar, Confetti, CheckCircle } from "@phosphor-icons/react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useAptosWallet } from "@/hooks/useAptosWallet";
import NumberFlow from "@number-flow/react";
import { motion, AnimatePresence } from "motion/react";

interface Bet {
    id: string;
    gameId: string;
    seatIndex: number;
    amount: number;
    walletAddress: string;
    txHash: string;
    createdAt: number;
    playerName?: string;
}

interface BettingTabProps {
    gameId: string;
    players: Array<{ seatIndex: number; name: string }>;
    isGameComplete?: boolean;
    winnerSeatIndex?: number;
}

export default function BettingTab({ gameId, players, isGameComplete, winnerSeatIndex }: BettingTabProps) {
    const { authenticated, login } = usePrivy();
    const { aptosAddress, publicKey } = useAptosWallet();
    const { signRawHash } = useSignRawHash();

    const [bets, setBets] = useState<Bet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimSuccess, setClaimSuccess] = useState(false);
    const [claimError, setClaimError] = useState<string | null>(null);

    // Poll for bets from the database
    useEffect(() => {
        const fetchBets = async () => {
            try {
                const response = await fetch(`/api/prediction-market/get-bets?gameId=${gameId}`);
                if (response.ok) {
                    const data = await response.json();
                    setBets(data.bets || []);
                }
            } catch (error) {
                console.error("Failed to fetch bets:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBets();
        const interval = setInterval(fetchBets, 5000);
        return () => clearInterval(interval);
    }, [gameId]);

    // Calculate pool per agent
    const poolByAgent = players.reduce((acc, player) => {
        acc[player.seatIndex] = bets
            .filter(b => b.seatIndex === player.seatIndex)
            .reduce((sum, b) => sum + b.amount, 0);
        return acc;
    }, {} as Record<number, number>);

    const totalPool = Object.values(poolByAgent).reduce((sum, v) => sum + v, 0);

    // Get user's bets
    const userBets = bets.filter(b =>
        b.walletAddress?.toLowerCase() === aptosAddress?.toLowerCase()
    );

    const userTotalBet = userBets.reduce((sum, b) => sum + b.amount, 0);

    // Check if user bet on the winner
    const userBetOnWinner = winnerSeatIndex !== undefined &&
        userBets.some(b => b.seatIndex === winnerSeatIndex);

    const userWinningBets = userBets.filter(b => b.seatIndex === winnerSeatIndex);
    const userWinningAmount = userWinningBets.reduce((sum, b) => sum + b.amount, 0);

    // Calculate potential winnings
    const winnerPool = winnerSeatIndex !== undefined ? (poolByAgent[winnerSeatIndex] || 0) : 0;
    const potentialWinnings = winnerPool > 0 && userWinningAmount > 0
        ? (userWinningAmount / winnerPool) * totalPool
        : 0;

    const handleClaimPrize = async () => {
        if (!authenticated) {
            login();
            return;
        }

        if (!aptosAddress || !publicKey) {
            setClaimError("Wallet not ready");
            return;
        }

        if (winnerSeatIndex === undefined) {
            setClaimError("Winner not determined yet");
            return;
        }

        setIsClaiming(true);
        setClaimError(null);

        try {
            // Step 0: Resolve market first (if not already resolved)
            console.log("🏆 Resolving market...");
            try {
                const resolveResponse = await fetch("/api/prediction-market/resolve-market", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ gameId, winnerSeatIndex }),
                });
                const resolveResult = await resolveResponse.json();
                console.log("Market resolution:", resolveResult.message || resolveResult.txHash || "done");
            } catch (resolveErr) {
                console.warn("Market resolution warning:", resolveErr);
                // Continue anyway - might already be resolved
            }

            console.log("💰 Claiming winnings...");

            // Step 1: Get claim transaction hash
            const hashResponse = await fetch("/api/prediction-market/claim-winnings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sender: aptosAddress, gameId }),
            });

            if (!hashResponse.ok) {
                const errData = await hashResponse.json();
                throw new Error(errData.error || "Failed to prepare claim");
            }

            const { hash, rawTxnHex } = await hashResponse.json();

            // Step 2: Sign with Privy
            const { signature } = await signRawHash({
                address: aptosAddress,
                chainType: "aptos",
                hash,
            });

            // Step 3: Submit signed transaction
            const submitResponse = await fetch("/api/prediction-market/submit-bet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rawTxnHex,
                    publicKey,
                    signature,
                    gameId,
                    walletAddress: aptosAddress,
                }),
            });

            if (!submitResponse.ok) {
                const errData = await submitResponse.json();
                throw new Error(errData.error || "Failed to claim");
            }

            const result = await submitResponse.json();
            console.log("✅ Prize claimed:", result.txHash);
            setClaimSuccess(true);

        } catch (err) {
            console.error("❌ Claim error:", err);
            setClaimError(err instanceof Error ? err.message : "Claim failed");
        } finally {
            setIsClaiming(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <CircleNotch size={24} className="animate-spin text-gray-500" />
            </div>
        );
    }

    const winnerPlayer = winnerSeatIndex !== undefined
        ? players.find(p => p.seatIndex === winnerSeatIndex)
        : null;

    return (
        <div className="divide-y divide-dark-5">
            {/* Winner Banner (when game is complete) */}
            {isGameComplete && winnerPlayer && (
                <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-500/30">
                    <div className="flex items-center gap-3">
                        <Confetti size={24} className="text-yellow-500" weight="fill" />
                        <div>
                            <p className="text-sm font-bold text-yellow-400">GAME COMPLETE!</p>
                            <p className="text-xs text-yellow-300">
                                Winner: <span className="font-medium">{winnerPlayer.name}</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Claim Prize (if user won) */}
            {isGameComplete && userBetOnWinner && !claimSuccess && (
                <div className="p-4 bg-green-500/10 border-b border-green-500/30">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm font-bold text-green-400">🎉 You Won!</p>
                            <p className="text-xs text-green-300">
                                Estimated payout: <NumberFlow value={potentialWinnings} /> MOVE
                            </p>
                        </div>
                    </div>

                    {claimError && (
                        <p className="text-xs text-red-400 mb-2">{claimError}</p>
                    )}

                    <button
                        onClick={handleClaimPrize}
                        disabled={isClaiming}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isClaiming ? (
                            <>
                                <CircleNotch size={18} className="animate-spin" />
                                <span>Claiming...</span>
                            </>
                        ) : (
                            <>
                                <Trophy size={18} weight="fill" />
                                <span>CLAIM PRIZE</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Did not win message */}
            {isGameComplete && userBets.length > 0 && !userBetOnWinner && (
                <div className="p-4 bg-red-500/10 border-b border-red-500/30">
                    <p className="text-sm font-medium text-red-400">❌ Better luck next time!</p>
                    <p className="text-xs text-red-300">Your bet did not win this round.</p>
                </div>
            )}

            {/* Claim Success */}
            {claimSuccess && (
                <div className="p-4 bg-green-500/20 border-b border-green-500/30">
                    <div className="flex items-center gap-3">
                        <CheckCircle size={24} className="text-green-500" weight="fill" />
                        <div>
                            <p className="text-sm font-bold text-green-400">Prize Claimed!</p>
                            <p className="text-xs text-green-300">MOVE has been sent to your wallet</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Pool Summary */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-text-bright uppercase flex items-center gap-2">
                        <Trophy size={16} className="text-yellow-500" weight="fill" />
                        Prize Pool
                    </h3>
                    <span className="text-lg font-bold text-orange-400">
                        <NumberFlow value={totalPool} /> MOVE
                    </span>
                </div>

                {/* Pool per agent */}
                <div className="space-y-2">
                    {players.filter(p => !p.name.toLowerCase().includes("empty")).map((player) => {
                        const pool = poolByAgent[player.seatIndex] || 0;
                        const percentage = totalPool > 0 ? (pool / totalPool) * 100 : 0;
                        const isWinner = winnerSeatIndex === player.seatIndex;

                        return (
                            <div
                                key={player.seatIndex}
                                className={`bg-dark-2 rounded-lg p-3 ${isWinner ? 'ring-2 ring-yellow-500/50' : ''}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-sm truncate ${isWinner ? 'text-yellow-400 font-medium' : 'text-gray-300'}`}>
                                        {isWinner && '🏆 '}{player.name}
                                    </span>
                                    <span className="text-sm font-medium text-white">
                                        <NumberFlow value={pool} /> MOVE
                                    </span>
                                </div>
                                <div className="h-1.5 bg-dark-4 rounded-full overflow-hidden">
                                    <motion.div
                                        className={`h-full ${isWinner ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-orange-500 to-yellow-500'}`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* User's Bets */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-text-bright uppercase flex items-center gap-2">
                        <Target size={16} className="text-orange-500" weight="fill" />
                        Your Bets
                    </h3>
                    {userTotalBet > 0 && (
                        <span className="text-sm font-bold text-green-400">
                            <NumberFlow value={userTotalBet} /> MOVE
                        </span>
                    )}
                </div>

                {userBets.length === 0 ? (
                    <div className="text-center py-6">
                        <CurrencyCircleDollar size={32} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500">No bets placed yet</p>
                        <p className="text-xs text-gray-600 mt-1">Click "Place Bet" to get started</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        <div className="space-y-2">
                            {userBets.map((bet) => {
                                const player = players.find(p => p.seatIndex === bet.seatIndex);
                                const isBetWinner = bet.seatIndex === winnerSeatIndex;

                                return (
                                    <motion.div
                                        key={bet.id || bet.txHash}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className={`bg-dark-2 border rounded-lg p-3 ${isBetWinner ? 'border-green-500/50 bg-green-500/10' : 'border-dark-5'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className={`text-sm font-medium ${isBetWinner ? 'text-green-400' : 'text-white'}`}>
                                                    {isBetWinner && '✓ '}{player?.name || `Seat ${bet.seatIndex + 1}`}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(bet.createdAt).toLocaleTimeString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-orange-400">
                                                    <NumberFlow value={bet.amount} /> MOVE
                                                </p>
                                                <a
                                                    href={`https://explorer.movementnetwork.xyz/txn/${bet.txHash}?network=testnet`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-400 hover:underline"
                                                >
                                                    View Tx
                                                </a>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </AnimatePresence>
                )}
            </div>

            {/* Info */}
            <div className="p-4">
                <p className="text-xs text-gray-500 text-center">
                    {isGameComplete
                        ? "Game has ended. Winners can claim their prizes above."
                        : "Bets are recorded on Movement blockchain"
                    }
                </p>
            </div>
        </div>
    );
}
