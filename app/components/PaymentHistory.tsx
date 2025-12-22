"use client";

import { useState } from "react";
import { init } from "@instantdb/react";
import schema from "@/instant.schema";
import {
    CircleNotch,
    CurrencyCircleDollar,
    CardsThree,
    CheckCircle,
    Clock,
    XCircle,
} from "@phosphor-icons/react";
import { formatMoveAmount } from "@/lib/movement";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "";
const db = init({ appId: APP_ID, schema });

export default function PaymentHistory() {
    const { data, isLoading, error } = db.useQuery({
        payments: {
            $: {
                order: {
                    createdAt: "desc",
                },
            },
            game: {
                players: {},
            },
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <CircleNotch size={20} className="animate-spin text-text-dim" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-sm text-red-400">{error.message}</p>
            </div>
        );
    }

    const payments = data?.payments || [];

    if (payments.length === 0) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <CurrencyCircleDollar size={48} className="text-text-dim mx-auto mb-4" />
                    <p className="text-sm text-text-dim font-semibold uppercase mb-2">
                        No Payments Yet
                    </p>
                    <p className="text-xs text-text-dim">
                        Your poker game entry payments will appear here.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-dark-2 divide-y divide-dark-5">
            {payments.map((payment: any) => {
                const paymentDate = new Date(payment.createdAt);
                const confirmedDate = payment.confirmedAt
                    ? new Date(payment.confirmedAt)
                    : null;

                const statusConfig = {
                    confirmed: {
                        icon: CheckCircle,
                        color: "text-green-500",
                        bgColor: "bg-green-950/30",
                        borderColor: "border-green-900/50",
                        label: "Confirmed",
                    },
                    pending: {
                        icon: Clock,
                        color: "text-yellow-500",
                        bgColor: "bg-yellow-950/30",
                        borderColor: "border-yellow-900/50",
                        label: "Pending",
                    },
                    failed: {
                        icon: XCircle,
                        color: "text-red-500",
                        bgColor: "bg-red-950/30",
                        borderColor: "border-red-900/50",
                        label: "Failed",
                    },
                };

                const status = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                    <div key={payment.id} className="px-4 py-4 hover:bg-dark-3 transition-colors">
                        <div className="grid grid-cols-12 gap-4 items-center">
                            {/* Date & Status */}
                            <div className="col-span-3">
                                <div className="text-xs text-text-medium">
                                    {paymentDate.toLocaleDateString()}
                                </div>
                                <div className="text-xs text-text-dim">
                                    {paymentDate.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </div>
                                <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-1 ${status.bgColor} border ${status.borderColor}`}>
                                    <StatusIcon size={12} className={status.color} weight="fill" />
                                    <span className={`text-xs font-medium ${status.color}`}>
                                        {status.label}
                                    </span>
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="col-span-2">
                                <div className="text-sm font-semibold text-green-400">
                                    {formatMoveAmount(payment.amount)}
                                </div>
                                <div className="text-xs text-text-dim">Entry Fee</div>
                            </div>

                            {/* Wallet Address */}
                            <div className="col-span-3">
                                <div className="text-xs font-mono text-text-medium">
                                    {payment.walletAddress.slice(0, 8)}...{payment.walletAddress.slice(-6)}
                                </div>
                                <div className="text-xs text-text-dim">Wallet</div>
                            </div>

                            {/* Game Info */}
                            <div className="col-span-2">
                                {payment.game ? (
                                    <>
                                        <div className="text-xs text-text-medium">
                                            Game #{payment.game.id.slice(-8)}
                                        </div>
                                        <div className="text-xs text-text-dim flex items-center gap-1">
                                            <CardsThree size={12} />
                                            {payment.game.players?.length || 0} players
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-xs text-text-dim">-</div>
                                )}
                            </div>

                            {/* Transaction Hash */}
                            <div className="col-span-2">
                                <div className="text-xs font-mono text-text-dim truncate">
                                    {payment.txHash.slice(0, 10)}...
                                </div>
                                <a
                                    href={`https://explorer.movementlabs.xyz/txn/${payment.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                                >
                                    View on Explorer →
                                </a>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
