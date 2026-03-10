"use node";

import { action } from "./_generated/server";

const CA = "0xa57d8ce207c7daaeeed4e3a491bdf51d89233af3";

export const getTokenPrice = action({
  args: {},
  handler: async () => {
    // Try token endpoint first
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/base/${CA}`);
    const data = await res.json();

    console.log("DexScreener response:", JSON.stringify(data).slice(0, 500));

    const pairs = Array.isArray(data) ? data : data.pairs;
    const pair = pairs?.[0];
    if (!pair) throw new Error("No pair: " + JSON.stringify(data).slice(0, 200));

    return {
      success: true,
      price: pair.priceUsd,
      priceChange24h: pair.priceChange?.h24,
      volume24h: pair.volume?.h24,
      marketCap: pair.marketCap || pair.fdv,
      liquidity: pair.liquidity?.usd,
    };
  },
});
