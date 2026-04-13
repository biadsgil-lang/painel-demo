// Cross-device sync via Vercel KV
// Setup: Vercel Dashboard > Storage > Create > KV > connect to project
// Then install: npm i @vercel/kv

let memStore = {};

async function getKV() {
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const key = req.query.key;
  if (!key) return res.status(400).json({ error: "Missing key" });

  const kv = await getKV();
  const fullKey = `pv:${key}`;

  try {
    if (req.method === "GET") {
      if (kv) {
        const data = await kv.get(fullKey);
        if (data) return res.status(200).json(data);
        return res.status(404).json({ error: "Not found" });
      }
      if (memStore[key]) return res.status(200).json(memStore[key]);
      return res.status(404).json({ error: "Not found" });
    }

    if (req.method === "POST") {
      const body = req.body;
      if (kv) {
        await kv.set(fullKey, body);
      } else {
        memStore[key] = body;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
