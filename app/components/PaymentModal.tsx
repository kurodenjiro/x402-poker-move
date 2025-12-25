"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { CircleNotch, CurrencyCircleDollar, X, CheckCircle } from "@phosphor-icons/react";
import { calculatePaymentAmount, formatMoveAmount, MOVEMENT_NETWORK, PAYMENT_CONFIG } from "@/lib/movement";

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    startingStack: number;
    participants: number;
    seatSelections: any[]; // Array of seat configurations
    onPaymentSuccess: (txHash: string, gameId?: string) => void;
}

export default function PaymentModal({
    isOpen,
    onClose,
    startingStack,
    participants,
    seatSelections,
    onPaymentSuccess,
}: PaymentModalProps) {
    const { authenticated, login } = usePrivy();
    const { wallets } = useWallets();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const paymentAmount = calculatePaymentAmount(startingStack, participants);

    if (!isOpen) return null;


    const handlePayment = async () => {
        if (!authenticated) {
            login();
            return;
        }

        if (wallets.length === 0) {
            setError("No wallet connected");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const wallet = wallets[0];
            const walletAddress = wallet.address;

            if (!walletAddress) {
                throw new Error("Wallet address not found");
            }

            // Get recipient address from environment
            const recipientAddress = PAYMENT_CONFIG.RECIPIENT_ADDRESS;

            // Convert MOVE amount to octas (1 MOVE = 100,000,000 octas)
            const amountInOctas = Math.floor(paymentAmount * 100_000_000);

            console.log("Creating Movement payment transaction:", {
                from: walletAddress,
                to: recipientAddress,
                amount: paymentAmount,
                amountInOctas,
            });

            // Step 1: Create unsigned transaction
            const createResponse = await fetch("/api/create-payment-tx", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    senderAddress: walletAddress,
                    recipientAddress,
                    amountInOctas,
                }),
            });

            const createData = await createResponse.json();

            if (!createResponse.ok) {
                throw new Error(createData.error || "Failed to create payment transaction");
            }


            const { transaction } = createData;

            console.log("📝 Transaction created, submitting for signing...");

            // Submit transaction to server for signing and blockchain submission
            const submitResponse = await fetch("/api/submit-payment-tx", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    transaction,
                    senderAddress: walletAddress,
                    recipientAddress,
                    amountInOctas,
                    seatSelections, // Pass seat selections for agent wallet generation
                }),
            });

            const submitData = await submitResponse.json();

            if (!submitResponse.ok) {
                throw new Error(submitData.error || "Failed to submit payment transaction");
            }

            const { txHash, explorerUrl, gameId } = submitData;

            console.log("✅ Payment transaction confirmed:", txHash);
            if (explorerUrl) {
                console.log("🔗 View on explorer:", explorerUrl);
            }
            console.log("🎮 Game ID:", gameId);

            setSuccess(true);
            setTimeout(() => {
                onPaymentSuccess(txHash, gameId); // Pass both txHash and gameId
            }, 1500);

        } catch (err) {
            console.error("❌ Payment error:", err);
            setError(err instanceof Error ? err.message : "Payment failed");
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-2 border border-dark-6 max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-6">
                    <h2 className="text-sm font-semibold text-text-bright uppercase flex items-center gap-2">
                        <CurrencyCircleDollar size={20} className="text-green-500" weight="fill" />
                        Payment Required
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="text-text-dim hover:text-text-bright transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Payment Details */}
                    <div className="space-y-4">
                        <div className="bg-dark-3 border border-dark-6 p-4 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-text-dim">Starting Stack:</span>
                                <span className="text-text-medium font-medium">{startingStack}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-text-dim">Participants:</span>
                                <span className="text-text-medium font-medium">{participants}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-text-dim">Stack per Player:</span>
                                <span className="text-text-medium font-medium">
                                    {(startingStack / participants).toFixed(0)}
                                </span>
                            </div>
                            <div className="border-t border-dark-6 pt-3 mt-3">
                                <div className="flex justify-between">
                                    <span className="text-text-bright font-semibold">Entry Fee:</span>
                                    <span className="text-green-400 font-bold text-lg">
                                        {formatMoveAmount(paymentAmount)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-dark-3/50 border border-dark-6 p-3">
                            <p className="text-xs text-text-dim">
                                <strong className="text-text-medium">Exchange Rate:</strong> 1 MOVE = 10,000 Stack
                            </p>
                            <p className="text-xs text-text-dim mt-2">
                                <strong className="text-text-medium">Network:</strong> {MOVEMENT_NETWORK.name}
                            </p>
                            <p className="text-xs text-text-dim mt-2">
                                <strong className="text-text-medium">Recipient:</strong>{" "}
                                <span className="font-mono">{PAYMENT_CONFIG.RECIPIENT_ADDRESS.slice(0, 8)}...{PAYMENT_CONFIG.RECIPIENT_ADDRESS.slice(-6)}</span>
                            </p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-950/20 border border-red-900/50 p-3">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="bg-green-950/20 border border-green-900/50 p-4 flex items-center gap-3">
                            <CheckCircle size={24} className="text-green-500" weight="fill" />
                            <div>
                                <p className="text-sm text-green-400 font-medium">Payment Confirmed!</p>
                                <p className="text-xs text-text-dim mt-1">Starting game...</p>
                            </div>
                        </div>
                    )}

                    {/* Payment Button */}
                    <button
                        onClick={handlePayment}
                        disabled={isProcessing || success}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold uppercase transition-colors ${success
                            ? "bg-green-950/50 border border-green-900/50 text-green-400 cursor-not-allowed"
                            : isProcessing
                                ? "bg-dark-3 border border-dark-6 text-text-dim cursor-wait"
                                : "bg-green-950/50 border border-green-900/50 text-green-400 hover:bg-green-950/70"
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <CircleNotch size={16} className="animate-spin" />
                                Processing Payment...
                            </>
                        ) : success ? (
                            <>
                                <CheckCircle size={16} weight="fill" />
                                Payment Confirmed
                            </>
                        ) : (
                            <>
                                <CurrencyCircleDollar size={16} weight="fill" />
                                Pay {formatMoveAmount(paymentAmount)}
                            </>
                        )}
                    </button>

                    {!authenticated && (
                        <p className="text-xs text-text-dim text-center">
                            You need to connect your wallet first
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
