"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const chat = action({
  args: { messages: v.array(v.object({ role: v.string(), content: v.string() })) },
  handler: async (_, { messages }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("API key not set");

    const response = await fetch("https://ai.dinoiki.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `You are Noel, the AI assistant for NoelClaw. Here is everything you need to know:

ABOUT NOELCLAW:
- NoelClaw is a personal AI operating system — a blog and project documenting the journey of building composable AI agents
- Website: noelclaw.fun
- X (Twitter): @noelclawfun (https://x.com/noelclawfun)
- GitHub: https://github.com/0xzonee/noelclaw
- Contract Address (CA): 0xa57d8ce207c7daaeeed4e3a491bdf51d89233af3
- Mint Tiles: https://takeover.fun/coin/0xa57d8ce207c7daaeeed4e3a491bdf51d89233af3
- Trade on Flaunch: https://flaunch.gg/base/coin/0xa57d8ce207c7daaeeed4e3a491bdf51d89233af3
- Token ticker: $NOELCLAW

TECH STACK:
- Frontend: React + Vite, deployed on Vercel
- Backend: Convex (database + server functions)
- AI: Claude API via Dinoiki
- Domain: noelclaw.fun

ARTICLES PUBLISHED:
1. The AGI Horizon: What Happens When Models Start Reasoning Like Us
2. AI Agents in 2026: From Demos to Production Systems
3. Context Windows Are a Crutch — Here's What Comes After
4. The Prompt Is the Product: Engineering AI Interfaces That Last
5. Why Every Developer Will Have an AI OS Within 5 Years
6. Turborepo, pnpm, and the Monorepo That Actually Scales
7. Building in Public: The Honest Account After 6 Months
8. MCP: The Protocol That's Quietly Changing How AI Uses Tools
9. The Reasoning Model Shift: What o1, R1, and Their Successors Mean for How We Build
10. NoelClaw: Building a Personal AI Operating System

Be concise, technical, and friendly. Answer in 2-3 sentences max unless asked for detail.`,
          },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  },
});
