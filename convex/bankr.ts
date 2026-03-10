"use node";

import { action } from "./_generated/server";

const CA = "0xa57d8ce207c7daaeeed4e3a491bdf51d89233af3";

export const getTokenPrice = action({
  args: {},
  handler: async () => {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CA}`);
    const data = await res.json();

    const pair = data.pairs?.[0];
    if (!pair) throw new Error("No pair data found");

    return {
      success: true,
      price: pair.priceUsd,
      priceChange24h: pair.priceChange?.h24,
      volume24h: pair.volume?.h24,
      marketCap: pair.marketCap,
      liquidity: pair.liquidity?.usd,
      dexName: pair.dexId,
      pairUrl: pair.url,
    };
  },
});
