import { NextRequest, NextResponse } from "next/server";
import { init, id } from "@instantdb/admin";
import schema from "@/instant.schema";
import { transferBetweenAgents, chipsToOctas } from "@/lib/agent-payments";

// Initialize InstantDB
const db = init({
    appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
    adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
    schema,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fromAgentId, toAgentId, chipAmount, handNumber, gameId } = body;

        console.log("💸 Processing agent payment:", {
            fromAgentId,
            toAgentId,
            chipAmount,
        });

        // Get agent wallets from database
        const agentsQuery = await db.query({
            agentWallets: {
                $: {
                    where: {
                        id: {
                            in: [fromAgentId, toAgentId],
                        },
                    },
                },
            },
        });

        const agents = agentsQuery.agentWallets;
        if (!agents || agents.length !== 2) {
            return NextResponse.json(
                { error: "Agent wallets not found" },
                { status: 404 }
            );
        }

        const fromAgent = agents.find((a: any) => a.id === fromAgentId);
        const toAgent = agents.find((a: any) => a.id === toAgentId);

        if (!fromAgent || !toAgent) {
            return NextResponse.json(
                { error: "Agent wallets not found" },
                { status: 404 }
            );
        }

        // Calculate amount in octas
        const amountInOctas = chipsToOctas(chipAmount);
        const amountInMove = chipAmount / 10_000;

        console.log(`💰 Transfer: ${amountInMove} MOVE (${chipAmount} chips)`);

        // Transfer MOVE tokens between agents
        const txHash = await transferBetweenAgents(
            fromAgent.privateKey,
            toAgent.address,
            amountInOctas
        );

        // Save payment to database
        const paymentId = id();
        await db.transact([
            db.tx.payments[paymentId].update({
                txHash,
                amount: amountInMove,
                currency: "MOVE",
                fromAddress: fromAgent.address,
                toAddress: toAgent.address,
                chipAmount,
                handNumber: handNumber || null,
                paymentType: "agent_transfer",
                status: "confirmed",
                createdAt: Date.now(),
                confirmedAt: Date.now(),
            }),
        ]);

        console.log("✅ Agent payment recorded:", {
            paymentId,
            txHash,
            from: fromAgent.agentName,
            to: toAgent.agentName,
        });

        return NextResponse.json({
            success: true,
            paymentId,
            txHash,
            amount: amountInMove,
            chipAmount,
            from: fromAgent.agentName,
            to: toAgent.agentName,
            explorerUrl: `https://explorer.movementnetwork.xyz/txn/${txHash}?network=testnet`,
        });
    } catch (error) {
        console.error("❌ Agent payment failed:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Payment failed",
            },
            { status: 500 }
        );
    }
}
