import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { subscription, hour } = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: "Missing subscription" });
  }

  const key = `push:${Buffer.from(subscription.endpoint).toString("base64url")}`;
  await redis.set(key, JSON.stringify({ subscription, hour: hour ?? 8 }));

  res.status(200).json({ ok: true });
}
