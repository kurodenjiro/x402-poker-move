"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Wallet, SignOut, Copy, Check } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import NumberFlow from "@number-flow/react";
import { padAddressToAptos } from "@/lib/movement";
import { useAptosWallet } from "@/hooks/useAptosWallet";

export default function WalletButton() {
    const { ready, authenticated, user, login, logout } = usePrivy();
    const { aptosAddress, isCreating } = useAptosWallet();
    const [balance, setBalance] = useState<number | null>(null);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedPadded, setCopiedPadded] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // Fetch wallet balance when Aptos address is available
    useEffect(() => {
        if (authenticated && aptosAddress) {
            fetchBalance(aptosAddress);
        }
    }, [authenticated, aptosAddress]);

    const fetchBalance = async (address: string) => {
        setIsLoadingBalance(true);
        try {
            const response = await fetch(`/api/get-balance?address=${encodeURIComponent(address)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch balance");
            }

            setBalance(data.balance);
        } catch (error) {
            console.error("Error fetching balance:", error);
            setBalance(0);
        } finally {
            setIsLoadingBalance(false);
        }
    };

    const copyAddress = async () => {
        if (aptosAddress) {
            await navigator.clipboard.writeText(aptosAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const copyPaddedAddress = async () => {
        if (aptosAddress) {
            await navigator.clipboard.writeText(aptosAddress); // Already padded
            setCopiedPadded(true);
            setTimeout(() => setCopiedPadded(false), 2000);
        }
    };

    if (!ready) {
        return (
            <button
                disabled
                className="flex items-center gap-2 px-3 py-2 text-xs 2xl:text-sm font-medium text-text-dim border border-dark-6 bg-dark-3 cursor-wait uppercase"
            >
                <Wallet size={16} className="2xl:w-5 2xl:h-5" />
                <span>Loading...</span>
            </button>
        );
    }

    if (authenticated && user) {
        // Show Aptos wallet address
        const displayAddress = isCreating
            ? "Creating wallet..."
            : aptosAddress
                ? `${aptosAddress.slice(0, 6)}...${aptosAddress.slice(-4)}`
                : user.email?.address || "No Aptos wallet";

        return (
            <div className="relative">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 px-3 py-2 text-xs 2xl:text-sm font-medium text-green-400 border border-green-900/50 bg-green-950/30 hover:bg-green-950/50 transition-colors uppercase"
                >
                    <Wallet size={16} weight="fill" className="2xl:w-5 2xl:h-5" />
                    <span>{displayAddress}</span>
                    {balance !== null && (
                        <span className="text-green-300 font-semibold ml-1">
                            <NumberFlow value={balance} format={{ maximumFractionDigits: 4 }} /> MOVE
                        </span>
                    )}
                </button>

                {/* Dropdown */}
                {showDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-dark-2 border border-dark-6 z-50 shadow-xl">
                        <div className="p-4 space-y-3">
                            {/* Wallet Address */}
                            <div>
                                <div className="text-xs text-text-dim uppercase mb-1">Aptos Wallet Address</div>
                                <div className="flex items-center gap-2 bg-dark-3 border border-dark-5 p-2">
                                    <code className="text-xs text-text-medium font-mono flex-1 truncate">
                                        {aptosAddress || "No Aptos wallet"}
                                    </code>
                                    <button
                                        onClick={copyAddress}
                                        className="text-text-dim hover:text-green-400 transition-colors flex-shrink-0"
                                        title="Copy address"
                                    >
                                        {copied ? (
                                            <Check size={16} className="text-green-400" weight="bold" />
                                        ) : (
                                            <Copy size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Movement Faucet Address */}
                            <div>
                                <div className="text-xs text-text-dim uppercase mb-1">
                                    Movement Faucet Address
                                    <span className="ml-1 text-orange-400">(Use this for faucet)</span>
                                </div>
                                <div className="flex items-center gap-2 bg-dark-3 border border-orange-900/50 p-2">
                                    <code className="text-xs text-orange-300 font-mono flex-1 truncate">
                                        {aptosAddress || "No Aptos wallet"}
                                    </code>
                                    <button
                                        onClick={copyPaddedAddress}
                                        className="text-text-dim hover:text-orange-400 transition-colors flex-shrink-0"
                                        title="Copy padded address for faucet"
                                    >
                                        {copiedPadded ? (
                                            <Check size={16} className="text-orange-400" weight="bold" />
                                        ) : (
                                            <Copy size={16} />
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-text-dim mt-1">
                                    64-character Aptos format
                                </p>
                            </div>

                            {/* Balance */}
                            <div>
                                <div className="text-xs text-text-dim uppercase mb-1">Balance</div>
                                <div className="bg-dark-3 border border-dark-5 p-3 text-center">
                                    {isLoadingBalance ? (
                                        <span className="text-sm text-text-dim">Loading...</span>
                                    ) : balance !== null ? (
                                        <div className="text-lg font-bold text-green-400">
                                            <NumberFlow value={balance} format={{ maximumFractionDigits: 4 }} /> MOVE
                                        </div>
                                    ) : (
                                        <span className="text-sm text-text-dim">Unable to load</span>
                                    )}
                                </div>
                            </div>

                            {/* Logout Button */}
                            <button
                                onClick={() => {
                                    setShowDropdown(false);
                                    logout();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 border border-red-900/50 bg-red-950/30 hover:bg-red-950/50 transition-colors uppercase"
                            >
                                <SignOut size={14} className="2xl:w-4 2xl:h-4" />
                                <span>Disconnect</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <button
            onClick={login}
            className="flex items-center gap-2 px-3 py-2 text-xs 2xl:text-sm font-medium text-text-bright border border-dark-6 bg-dark-3 hover:border-dark-8 hover:bg-dark-4 transition-colors uppercase"
        >
            <Wallet size={16} className="2xl:w-5 2xl:h-5" />
            <span>Connect Wallet</span>
        </button>
    );
}
