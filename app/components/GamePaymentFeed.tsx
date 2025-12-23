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

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "";
const db = init({ appId: APP_ID, schema });

interface GamePaymentFeedProps {
    gameId: string;
}

export default function GamePaymentFeed({ gameId }: GamePaymentFeedProps) {
    // Query all payments in real-time (filtering by game will be added later)
    const { data, isLoading } = db.useQuery({
        payments: {
            $: {
                order: {
                    createdAt: "desc",
                },
                limit: 50,
            },
        },
    });

    const payments = data?.payments || [];

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
        <div className="divide-y divide-dark-5">
            {payments.map((payment: any) => {
                const paymentDate = new Date(payment.createdAt);
                const isConfirmed = payment.status === "confirmed";

                return (
                    <div
                        key={payment.id}
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
                                <span className="text-xs text-text-dim font-mono truncate">
                                    {payment.walletAddress?.slice(0, 8)}...{payment.walletAddress?.slice(-4)}
                                </span>
                            </div>
                            <div className="text-xs text-text-dim mt-0.5">
                                {paymentDate.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                })}
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

                        {/* Amount Badge */}
                        <div className="flex-shrink-0">
                            <div className={`text-xs font-medium px-2 py-1 ${isConfirmed
                                ? "bg-green-950/30 text-green-400 border border-green-900/50"
                                : "bg-yellow-950/30 text-yellow-400 border border-yellow-900/50"
                                }`}>
                                {isConfirmed ? "Confirmed" : "Pending"}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
