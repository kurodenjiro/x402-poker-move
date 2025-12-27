"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { CircleNotch, X, CheckCircle, Target, CurrencyCircleDollar } from "@phosphor-icons/react";
import { MOVEMENT_NETWORK } from "@/lib/movement";
import { useAptosWallet } from "@/hooks/useAptosWallet";
import { PREDICTION_MARKET, octasToMove, moveToOctas } from "@/app/config/contracts";
import NumberFlow from "@number-flow/react";

interface BettingModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameId: string;
    players: Array<{ seatIndex: number; name: string; avatar?: string }>;
    onBetPlaced?: (txHash: string, seatIndex: number, amount: number) => void;
}

export default function BettingModal({
    isOpen,
    onClose,
    gameId,
    players,
    onBetPlaced,
}: BettingModalProps) {
    const { authenticated, login } = usePrivy();
    const { aptosAddress, publicKey, isCreating } = useAptosWallet();
    const { signRawHash } = useSignRawHash();

    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [betAmount, setBetAmount] = useState<string>("0.1");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);

    if (!isOpen) return null;

    const handlePlaceBet = async () => {
        if (!authenticated) {
            login();
            return;
        }

        if (isCreating || !aptosAddress || !publicKey) {
            setError("Waiting for wallet creation...");
            return;
        }

        if (selectedSeat === null) {
            setError("Please select an agent to bet on");
            return;
        }

        const amountNum = parseFloat(betAmount);
        if (isNaN(amountNum) || amountNum < octasToMove(PREDICTION_MARKET.MIN_BET_OCTAS)) {
            setError(`Minimum bet is ${octasToMove(PREDICTION_MARKET.MIN_BET_OCTAS)} MOVE`);
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const amountInOctas = moveToOctas(amountNum);

            console.log("🎲 Placing bet:", {
                gameId,
                seatIndex: selectedSeat,
                amount: amountNum,
                from: aptosAddress,
            });

            // Step 0: Initialize market if not exists (server-side)
            console.log("🏗️ Ensuring market is initialized...");
            try {
                const initResponse = await fetch("/api/prediction-market/initialize-market", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ gameId }),
                });
                const initResult = await initResponse.json();
                if (initResponse.ok) {
                    console.log("✅ Market ready:", initResult.message || initResult.txHash);
                } else {
                    console.warn("⚠️ Market init warning:", initResult.error);
                    // Continue anyway - might already exist or we'll get a clear error on bet
                }
            } catch (initErr) {
                console.warn("⚠️ Market init failed, continuing:", initErr);
            }

            // Step 1: Generate transaction hash
            console.log("🔨 Requesting transaction hash...");
            const hashResponse = await fetch("/api/prediction-market/place-bet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: aptosAddress,
                    gameId,
                    seatIndex: selectedSeat,
                    amountInOctas,
                }),
            });

            if (!hashResponse.ok) {
                const errData = await hashResponse.json();
                throw new Error(errData.error || "Failed to generate transaction");
            }

            const { hash, rawTxnHex } = await hashResponse.json();
            console.log("✅ Hash generated");

            // Step 2: Sign with Privy
            console.log("✍️ Signing with Privy...");
            const { signature } = await signRawHash({
                address: aptosAddress,
                chainType: "aptos",
                hash,
            });
            console.log("✅ Transaction signed");

            // Step 3: Submit signed transaction
            console.log("🚀 Submitting signed bet...");
            const submitResponse = await fetch("/api/prediction-market/submit-bet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rawTxnHex,
                    publicKey,
                    signature,
                    gameId,
                    seatIndex: selectedSeat,
                    amount: amountNum,
                    walletAddress: aptosAddress,
                }),
            });

            if (!submitResponse.ok) {
                const errData = await submitResponse.json();
                throw new Error(errData.error || "Failed to submit bet");
            }

            const result = await submitResponse.json();

            if (!result.success) {
                throw new Error(result.error || "Bet failed");
            }

            console.log("✅ Bet placed successfully:", result.txHash);
            setTxHash(result.txHash);
            setSuccess(true);

            setTimeout(() => {
                onBetPlaced?.(result.txHash, selectedSeat, amountNum);
                onClose();
            }, 2000);

        } catch (err) {
            console.error("❌ Bet error:", err);
            setError(err instanceof Error ? err.message : "Bet failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const selectedPlayer = players.find(p => p.seatIndex === selectedSeat);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-dark-3 border border-dark-4 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Target size={28} className="text-orange-500" weight="duotone" />
                        PLACE YOUR BET
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        disabled={isProcessing}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Player Selection */}
                <div className="mb-6">
                    <label className="text-gray-400 text-sm mb-3 block">Select Agent to Win</label>
                    <div className="grid grid-cols-2 gap-2">
                        {players.filter(p => !p.name.toLowerCase().includes("empty")).map((player) => (
                            <button
                                key={player.seatIndex}
                                onClick={() => setSelectedSeat(player.seatIndex)}
                                disabled={isProcessing}
                                className={`p-3 rounded-xl border transition-all text-left ${selectedSeat === player.seatIndex
                                    ? "bg-orange-500/20 border-orange-500 text-orange-400"
                                    : "bg-dark-2 border-dark-5 text-gray-300 hover:border-dark-6"
                                    }`}
                            >
                                <div className="font-medium text-sm truncate">{player.name}</div>
                                <div className="text-xs text-gray-500">Seat {player.seatIndex + 1}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bet Amount */}
                <div className="mb-6">
                    <label className="text-gray-400 text-sm mb-2 block">Bet Amount (MOVE)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            min={octasToMove(PREDICTION_MARKET.MIN_BET_OCTAS)}
                            step="0.01"
                            disabled={isProcessing}
                            className="w-full bg-dark-2 border border-dark-5 rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-orange-500"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                            MOVE
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        {[0.1, 0.5, 1, 5].map((amount) => (
                            <button
                                key={amount}
                                onClick={() => setBetAmount(amount.toString())}
                                disabled={isProcessing}
                                className="flex-1 py-1.5 text-xs bg-dark-2 border border-dark-5 rounded-lg text-gray-400 hover:text-white hover:border-dark-6 transition-colors"
                            >
                                {amount} MOVE
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary */}
                {selectedPlayer && (
                    <div className="bg-dark-2 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">Betting on</span>
                            <span className="text-white font-medium">{selectedPlayer.name}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">Amount</span>
                            <span className="text-xl font-bold text-orange-400">
                                <NumberFlow value={parseFloat(betAmount) || 0} /> MOVE
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Network</span>
                            <span className="text-gray-300">{MOVEMENT_NETWORK.name}</span>
                        </div>
                    </div>
                )}

                {/* Success State */}
                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                        <CheckCircle size={24} className="text-green-500" weight="fill" />
                        <div>
                            <p className="text-green-500 font-semibold">Bet Placed Successfully!</p>
                            <p className="text-green-400 text-sm">Your bet has been recorded on-chain.</p>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                        <p className="text-red-500 font-semibold">{error}</p>
                    </div>
                )}

                {/* Place Bet Button */}
                {!success && (
                    <button
                        onClick={handlePlaceBet}
                        disabled={isProcessing || isCreating || selectedSeat === null}
                        className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                    >
                        {isProcessing ? (
                            <>
                                <CircleNotch size={24} className="animate-spin" />
                                <span>PLACING BET...</span>
                            </>
                        ) : isCreating ? (
                            <>
                                <CircleNotch size={24} className="animate-spin" />
                                <span>CREATING WALLET...</span>
                            </>
                        ) : (
                            <>
                                <CurrencyCircleDollar size={24} weight="fill" />
                                <span>PLACE BET</span>
                            </>
                        )}
                    </button>
                )}

                {/* Footer */}
                <p className="text-gray-500 text-xs text-center mt-4">
                    Your wallet will be debited {betAmount} MOVE
                </p>
            </div>
        </div>
    );
}
