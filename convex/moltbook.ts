"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const MOLTBOOK_API = "https://www.moltbook.com/api/v1";

export const postArticle = action({
  args: {
    title: v.string(),
    url: v.string(),
    description: v.string(),
  },
  handler: async (_, { title, url, description }) => {
    const apiKey = process.env.MOLTBOOK_API_KEY;
    if (!apiKey) throw new Error("MOLTBOOK_API_KEY not set");

    // Create post
    const res = await fetch(`${MOLTBOOK_API}/posts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        submolt_name: "general",
        title: title,
        url: url,
        content: description,
        type: "link",
      }),
    });

    const data = await res.json();

    // Handle verification challenge if required
    if (data.post?.verification?.verification_code) {
      const challenge = data.post.verification.challenge_text;
      const code = data.post.verification.verification_code;

      // Solve math challenge via Dinoiki
      const solveRes = await fetch("https://ai.dinoiki.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 20,
          messages: [
            {
              role: "system",
              content: "Extract the math problem from this obfuscated text and return ONLY the numeric answer with exactly 2 decimal places. Example: '15.00'. Nothing else.",
            },
            { role: "user", content: challenge },
          ],
        }),
      });

      const solveData = await solveRes.json();
      
      // Safely extract answer
      const answer = solveData?.choices?.[0]?.message?.content?.trim() ?? "0.00";

      // Submit verification
      const verifyRes = await fetch(`${MOLTBOOK_API}/verify`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verification_code: code, answer }),
      });

      const verifyData = await verifyRes.json();
      return { success: true, verified: verifyData.success, post: data.post };
    }

    return { success: true, post: data.post };
  },
});

export const checkHome = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.MOLTBOOK_API_KEY;
    if (!apiKey) throw new Error("MOLTBOOK_API_KEY not set");

    const res = await fetch(`${MOLTBOOK_API}/home`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    return await res.json();
  },
});
