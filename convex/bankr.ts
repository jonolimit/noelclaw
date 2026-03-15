"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// ══════════════════════════════════════════════════════
// Core Bankr API caller
// ══════════════════════════════════════════════════════
async function callBankr(
  prompt: string,
  threadId?: string,
  walletAddress?: string
): Promise<{ response: string; threadId?: string; transactions: any[]; method: string }> {
  const privateKey    = process.env.BANKR_PRIVATE_KEY;
  const contextWallet = walletAddress || process.env.BANKR_WALLET_ADDRESS;

  // Method 1: x402 SDK (if private key set)
  if (privateKey) {
    try {
      // @ts-ignore — optional dependency, install with: npm install @bankr/sdk
      const { BankrClient } = await import("@bankr/sdk");
      const client = new BankrClient({
        privateKey,
        ...(contextWallet ? { walletAddress: contextWallet } : {}),
      });
      const result = await client.promptAndWait({
        prompt,
        ...(threadId ? { threadId } : {}),
      });
      return {
        response: result.response || result.result || "Done.",
        threadId: result.threadId || threadId,
        transactions: result.transactions || [],
        method: "x402",
      };
    } catch (e: any) {
      console.log("x402 SDK error, falling back to API key:", e?.message);
    }
  }

  // Method 2: API key (direct REST)
  const apiKey = process.env.BANKR_API_KEY;
  if (!apiKey) throw new Error("Set BANKR_API_KEY or BANKR_PRIVATE_KEY in Convex env vars.");

  const body: Record<string, string> = { prompt };
  if (threadId) body.threadId = threadId;
  if (contextWallet) body.walletAddress = contextWallet;

  const startRes = await fetch("https://api.bankr.bot/agent/prompt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Bankr ${startRes.status}: ${err.slice(0, 300)}`);
  }

  const { jobId, threadId: newThreadId } = await startRes.json();

  // Poll for completion (max 50s)
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.bankr.bot/agent/job/${jobId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) continue;
    const data = await pollRes.json();
    if (data.status === "completed") {
      return {
        response: data.response || data.result || "Done.",
        threadId: newThreadId || threadId,
        transactions: data.transactions || [],
        method: "api_key",
      };
    }
    if (data.status === "failed") throw new Error("Bankr job failed: " + (data.error || "unknown"));
  }
  throw new Error("Bankr timeout after 50s");
}

// ══════════════════════════════════════════════════════
// Exported Convex actions
// ══════════════════════════════════════════════════════

export const bankrAsk = action({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
  },
  handler: async (_, { prompt, threadId, walletAddress }) =>
    callBankr(prompt, threadId, walletAddress),
});

export const getTokenPrice = action({
  args: { token: v.string() },
  handler: async (_, { token }) =>
    callBankr(`Price of ${token} on Base? Give: price USD, 24h change %, volume, market cap.`),
});

export const getRecentTrades = action({
  args: { token: v.optional(v.string()) },
  handler: async (_, { token }) =>
    callBankr(`Recent trades for ${token || "NOELCLAW"} on Base: buys vs sells, volume, biggest trades last hour.`),
});

export const getTrendingBase = action({
  args: {},
  handler: async (_) =>
    callBankr("Top 8 trending tokens on Base right now. List symbol, price, 24h change, volume."),
});

export const getAlphaBankr = action({
  args: { token: v.string() },
  handler: async (_, { token }) =>
    callBankr(`Alpha analysis ${token} on Base: momentum, whale activity. BUY/SELL/HOLD + conviction 1-10.`),
});

export const getPortfolio = action({
  args: { walletAddress: v.string() },
  handler: async (_, { walletAddress }) =>
    callBankr(`Portfolio for ${walletAddress} on Base: holdings, USD values, 24h PnL.`, undefined, walletAddress),
});

export const swapTokens = action({
  args: {
    fromToken: v.string(),
    toToken: v.string(),
    amount: v.string(),
    walletAddress: v.optional(v.string()),
  },
  handler: async (_, { fromToken, toToken, amount, walletAddress }) =>
    callBankr(`Swap ${amount} ${fromToken} to ${toToken} on Base.`, undefined, walletAddress),
});

export const getBalance = action({
  args: { wallet: v.optional(v.string()), token: v.optional(v.string()) },
  handler: async (_, { wallet, token }) =>
    callBankr(`Wallet balance${token ? ` for ${token}` : ""} on Base.${wallet ? ` Wallet: ${wallet}` : ""}`, undefined, wallet),
});

export const setLimitOrder = action({
  args: {
    token: v.string(),
    action: v.string(),
    amount: v.string(),
    targetPrice: v.string(),
  },
  handler: async (_, { token, action: act, amount, targetPrice }) =>
    callBankr(`Limit order: ${act} ${amount} ${token} at $${targetPrice} on Base.`),
});

export const claimFees = action({
  args: { token: v.optional(v.string()) },
  handler: async (_, { token }) =>
    callBankr(`Claim trading fees for ${token || "NOELCLAW"} on Base.`),
});

export const getSmartMoney = action({
  args: { token: v.optional(v.string()) },
  handler: async (_, { token }) =>
    callBankr(`Smart money wallets for ${token || "Base chain"}: recent trades, PnL.`),
});

export const setupDCA = action({
  args: { token: v.string(), amount: v.string(), frequency: v.string() },
  handler: async (_, { token, amount, frequency }) =>
    callBankr(`Setup DCA: buy $${amount} of ${token} every ${frequency} on Base.`),
});

export const deployToken = action({
  args: {
    name: v.string(),
    symbol: v.string(),
    supply: v.optional(v.string()),
  },
  handler: async (_, { name, symbol, supply }) =>
    callBankr(`Deploy token on Base: name "${name}", symbol "${symbol}", supply ${supply || "1,000,000,000"}.`),
});

export const runAlphaAgent = action({
  args: { condition: v.string(), action: v.string(), token: v.string() },
  handler: async (_, { condition, action: act, token }) =>
    callBankr(`Auto-agent for ${token}: if ${condition}, then ${act}.`),
});