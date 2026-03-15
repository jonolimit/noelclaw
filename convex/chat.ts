"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const chat = action({
  args: { messages: v.array(v.object({ role: v.string(), content: v.string() })) },
  handler: async (_, { messages }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in Convex env vars");

    // Use Anthropic API directly (Claude claude-sonnet-4-20250514)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: `You are Noel, the AI assistant for NoelClaw. Here is everything you need to know:

ABOUT NOELCLAW:
- NoelClaw is an AI agent platform on Base chain, powered by Bankr API
- Website: noelclaw.fun | X: @noelclawfun | GitHub: https://github.com/0xzonee/noelclaw
- Token: $NOELCLAW | CA: 0xa57d8ce207c7daaeeed4e3a491bdf51d89233af3
- Trade: https://flaunch.gg/base/coin/0xa57d8ce207c7daaeeed4e3a491bdf51d89233af3
- Built for the Bankr x Synthesis hackathon
- NOT a chatbot — executes real on-chain actions via natural language

WHAT IT CAN DO (via Bankr API):
- Swap any token on Base (ETH, USDC, BRETT, DEGEN, etc)
- Analyze tokens with AI conviction signals (BUY/SELL/HOLD 1-10)
- Deploy new tokens on Base in seconds
- Set limit orders that trigger automatically
- Track smart money & whale wallets
- Claim trading fees
- Auto-agent: monitors market every 30s and executes autonomously

STACK: React + Vite, Convex, Privy (wallet auth), Bankr API, Base chain, Claude AI, TypeScript

PERSONALITY: Sharp, direct, crypto-native. Max 2-3 sentences unless asked for detail. Confident. Never generic. Use data when possible.`,
        messages: messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    // Anthropic returns content as array of blocks
    const text = data.content?.[0]?.text || data.content || "Sorry, no response.";
    return text;
  },
});