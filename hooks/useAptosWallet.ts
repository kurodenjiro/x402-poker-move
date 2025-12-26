"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";

/**
 * Hook to ensure user has an Aptos wallet for Movement Network
 * Creates one if it doesn't exist and extracts the public key
 */
export function useAptosWallet() {
    const { authenticated, user } = usePrivy();
    const { createWallet } = useCreateWallet();
    const [aptosAddress, setAptosAddress] = useState<string>("");
    const [publicKey, setPublicKey] = useState<string>("");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const setupAptosWallet = async () => {
            if (!authenticated || !user || isCreating) return;

            try {
                // Check if user already has an Aptos wallet
                const aptosWallet = user.linkedAccounts?.find(
                    (account: any) => account.chainType === 'aptos'
                ) as any;

                if (aptosWallet) {
                    const address = aptosWallet.address as string;
                    const pubKey = aptosWallet.publicKey as string;
                    setAptosAddress(address);
                    setPublicKey(pubKey || "");
                    console.log('✅ Aptos wallet found:', { address, publicKey: pubKey });
                } else {
                    // Create new Aptos wallet
                    console.log('📝 Creating Aptos wallet...');
                    setIsCreating(true);

                    const result = await createWallet({ chainType: 'aptos' });
                    const address = (result.wallet as any).address;
                    const pubKey = (result.wallet as any).publicKey;

                    setAptosAddress(address);
                    setPublicKey(pubKey || "");
                    console.log('✅ Created Aptos wallet:', { address, publicKey: pubKey });
                }
            } catch (err) {
                console.error('❌ Error with Aptos wallet:', err);
                setError(err instanceof Error ? err.message : 'Failed to setup Aptos wallet');
            } finally {
                setIsCreating(false);
            }
        };

        setupAptosWallet();
    }, [authenticated, user, createWallet, isCreating]);

    return { aptosAddress, publicKey, isCreating, error };
}
