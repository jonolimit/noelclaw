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
            content: `You are Noel, the AI assistant for NoelClaw — a personal AI operating system blog. You help visitors learn about the site, AI systems, architecture decisions, and the articles published here. Be concise, technical, and friendly. Keep responses under 3 sentences unless asked for detail.`,
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