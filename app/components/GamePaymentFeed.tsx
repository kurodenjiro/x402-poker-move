"use client";

import { init } from "@instantdb/react";
import schema from "@/instant.schema";
import {
    CurrencyCircleDollar,
    CheckCircle,
    Clock,
    ArrowRight,
} from "@phosphor-icons/react";
import { formatMoveAmount } from "@/lib/movement";
import { AnimatePresence, motion } from "motion/react";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "";
const db = init({ appId: APP_ID, schema });

interface GamePaymentFeedProps {
    gameId: string;
}

export default function GamePaymentFeed({ gameId }: GamePaymentFeedProps) {
    // Query payments and agent wallets for THIS GAME ONLY
    const { data, isLoading } = db.useQuery({
        payments: {
            $: {
                where: {
                    game: gameId, // ← Filter by current game!
                },
                order: {
                    createdAt: "desc",
                },
                limit: 50,
            },
        },
        agentWallets: {
            $: {
                where: {
                    game: gameId, // ← Filter by current game!
                },
            },
        },
    });

    const payments = data?.payments || [];
    const agentWallets = data?.agentWallets || [];

    // Helper function to get agent name from address
    const getAgentName = (address: string | undefined) => {
        if (!address) return "Unknown";
        const agent = agentWallets.find((w: any) => w.address === address);
        return agent?.agentName || `Seat ${(agent?.seatNumber ?? 0) + 1}` || address.slice(0, 6) + "...";
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin">
                    <Clock size={24} className="text-text-dim" />
                </div>
            </div>
        );
    }

    if (payments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <CurrencyCircleDollar size={48} className="text-text-dim mb-3" />
                <p className="text-sm text-text-dim font-semibold uppercase">
                    No Payments Yet
                </p>
                <p className="text-xs text-text-dim mt-1">
                    Agent payments will appear here in real-time
                </p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-dark-5 relative overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
                {payments.map((payment: any) => {
                    const paymentDate = new Date(payment.createdAt);
                    const isConfirmed = payment.status === "confirmed";

                    return (
                        <motion.div
                            key={payment.id}
                            layout
                            initial={{ opacity: 0, y: -20, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, scale: 0.95, height: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="px-4 py-3 hover:bg-dark-3 transition-colors flex items-center gap-3"
                        >
                            {/* Status Icon */}
                            <div className={`flex-shrink-0 ${isConfirmed ? "text-green-500" : "text-yellow-500"}`}>
                                {isConfirmed ? (
                                    <CheckCircle size={20} weight="fill" />
                                ) : (
                                    <Clock size={20} weight="fill" />
                                )}
                            </div>

                            {/* Payment Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-green-400">
                                        {formatMoveAmount(payment.amount)}
                                    </span>
                                    <ArrowRight size={14} className="text-text-dim" />
                                    {payment.paymentType === 'agent_transfer' && payment.fromAddress && payment.toAddress ? (
                                        <>
                                            <span className="text-xs text-orange-400 font-semibold">
                                                {getAgentName(payment.fromAddress)}
                                            </span>
                                            <ArrowRight size={12} className="text-orange-500" weight="bold" />
                                            <span className="text-xs text-blue-400 font-semibold">
                                                {getAgentName(payment.toAddress)}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-text-dim font-mono truncate">
                                            {payment.walletAddress?.slice(0, 8)}...{payment.walletAddress?.slice(-4)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-text-dim">
                                        {paymentDate.toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                        })}
                                    </span>
                                    {payment.chipAmount && (
                                        <span className="text-xs text-yellow-400">
                                            ({payment.chipAmount.toLocaleString()} chips)
                                        </span>
                                    )}
                                    {payment.handNumber && (
                                        <span className="text-xs text-text-dim">
                                            Hand #{payment.handNumber}
                                        </span>
                                    )}
                                </div>
                                {payment.txHash && (
                                    <a
                                        href={`https://explorer.movementnetwork.xyz/txn/${payment.txHash}?network=testnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-400 hover:text-blue-300 font-mono truncate block mt-1"
                                    >
                                        TX: {payment.txHash.slice(0, 12)}...
                                    </a>
                                )}
                            </div>

                            {/* Payment Type & Status Badge */}
                            <div className="flex-shrink-0 flex flex-col gap-1">
                                {payment.paymentType && (
                                    <div className={`text-xs font-medium px-2 py-1 text-center ${payment.paymentType === 'agent_transfer'
                                        ? 'bg-purple-950/30 text-purple-400 border border-purple-900/50'
                                        : 'bg-blue-950/30 text-blue-400 border border-blue-900/50'
                                        }`}>
                                        {payment.paymentType === 'agent_transfer' ? 'Agent Pay' : 'Entry Fee'}
                                    </div>
                                )}
                                <div className={`text-xs font-medium px-2 py-1 text-center ${isConfirmed
                                    ? "bg-green-950/30 text-green-400 border border-green-900/50"
                                    : "bg-yellow-950/30 text-yellow-400 border border-yellow-900/50"
                                    }`}>
                                    {isConfirmed ? "Confirmed" : "Pending"}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
