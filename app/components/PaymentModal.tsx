"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { CircleNotch, CurrencyCircleDollar, X, CheckCircle } from "@phosphor-icons/react";
import { calculatePaymentAmount, formatMoveAmount, MOVEMENT_NETWORK, PAYMENT_CONFIG } from "@/lib/movement";
import { useAptosWallet } from "@/hooks/useAptosWallet";

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    startingStack: number;
    participants: number;
    seatSelections: any[];
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
    const { aptosAddress, publicKey, isCreating } = useAptosWallet();
    const { signRawHash } = useSignRawHash();
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

        if (isCreating || !aptosAddress || !publicKey) {
            setError("Waiting for Aptos wallet creation...");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const recipientAddress = PAYMENT_CONFIG.RECIPIENT_ADDRESS;
            const amountInOctas = Math.floor(paymentAmount * 100_000_000);

            console.log("💳 Starting user-signed payment:", {
                from: aptosAddress,
                to: recipientAddress,
                amount: paymentAmount,
            });

            // Step 1: Generate hash from backend
            console.log("🔨 Requesting transaction hash...");
            const hashResponse = await fetch("/api/generate-payment-hash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: aptosAddress,
                    recipientAddress,
                    amountInOctas,
                }),
            });

            if (!hashResponse.ok) {
                throw new Error("Failed to generate transaction hash");
            }

            const { hash, rawTxnHex } = await hashResponse.json();
            console.log("✅ Hash generated");

            // Step 2: Sign hash using Privy's signRawHash
            console.log("✍️ Signing with Privy...");
            const { signature } = await signRawHash({
                address: aptosAddress,
                chainType: "aptos",
                hash,
            });
            console.log("✅ Transaction signed");

            // Step 3: Submit signed transaction to backend
            console.log("🚀 Submitting signed transaction...");
            const submitResponse = await fetch("/api/submit-signed-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rawTxnHex,
                    publicKey,
                    signature,
                    seatSelections,
                    startingStack,
                    walletAddress: aptosAddress,
                }),
            });

            if (!submitResponse.ok) {
                throw new Error("Failed to submit transaction");
            }

            const result = await submitResponse.json();

            if (!result.success) {
                throw new Error(result.error || "Transaction failed");
            }

            const { txHash, gameId, explorerUrl } = result;

            console.log("✅ Payment confirmed:", txHash);
            if (explorerUrl) {
                console.log("🔗 Explorer:", explorerUrl);
            }
            console.log("🎮 Game ID:", gameId);

            setSuccess(true);
            setTimeout(() => {
                onPaymentSuccess(txHash, gameId);
            }, 1500);

        } catch (err) {
            console.error("❌ Payment error:", err);
            setError(err instanceof Error ? err.message : "Payment failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-dark-3 border border-dark-4 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <CurrencyCircleDollar size={32} className="text-green-500" weight="duotone" />
                        PAYMENT REQUIRED
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        disabled={isProcessing}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Payment Details */}
                <div className="bg-dark-2 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400">Entry Fee</span>
                        <span className="text-2xl font-bold text-white">
                            {formatMoveAmount(paymentAmount)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Network</span>
                        <span className="text-gray-300">{MOVEMENT_NETWORK.name}</span>
                    </div>
                </div>

                {/* Success State */}
                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                        <CheckCircle size={24} className="text-green-500" weight="fill" />
                        <div>
                            <p className="text-green-500 font-semibold">Payment Successful!</p>
                            <p className="text-green-400 text-sm">Your wallet was debited. Starting game...</p>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                        <p className="text-red-500 font-semibold">{error}</p>
                    </div>
                )}

                {/* Pay Button */}
                {!success && (
                    <button
                        onClick={handlePayment}
                        disabled={isProcessing || isCreating}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                    >
                        {isProcessing ? (
                            <>
                                <CircleNotch size={24} className="animate-spin" />
                                <span>PROCESSING PAYMENT...</span>
                            </>
                        ) : isCreating ? (
                            <>
                                <CircleNotch size={24} className="animate-spin" />
                                <span>CREATING WALLET...</span>
                            </>
                        ) : (
                            <>
                                <CurrencyCircleDollar size={24} weight="fill" />
                                <span>PAY {formatMoveAmount(paymentAmount)}</span>
                            </>
                        )}
                    </button>
                )}

                {/* Note */}
                <p className="text-gray-500 text-xs text-center mt-4">
                    Your wallet will be debited {formatMoveAmount(paymentAmount)}
                </p>
            </div>
        </div>
    );
}
