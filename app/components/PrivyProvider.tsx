"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode } from "react";

export default function CustomPrivyProvider({
    children,
}: {
    children: ReactNode;
}) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    if (!appId) {
        console.warn("NEXT_PUBLIC_PRIVY_APP_ID is not set");
        return <>{children}</>;
    }

    return (
        <PrivyProvider
            appId={appId}
            config={{
                appearance: {
                    theme: "dark",
                    accentColor: "#22c55e",
                    logo: undefined,
                },
                loginMethods: ["wallet", "email"],
            }}
        >
            {children}
        </PrivyProvider>
    );
}
