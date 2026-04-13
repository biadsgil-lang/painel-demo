export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const BASE = "https://api.pluggy.ai";
  const CLIENT_ID = process.env.PLUGGY_CLIENT_ID || process.env.VITE_PLUGGY_CLIENT_ID;
  const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET || process.env.VITE_PLUGGY_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: "Missing Pluggy credentials in env vars" });
  }

  try {
    const authRes = await fetch(`${BASE}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
    });
    if (!authRes.ok) {
      const errBody = await authRes.text();
      return res.status(authRes.status).json({ error: "Auth failed", detail: errBody });
    }
    const { apiKey } = await authRes.json();

    const { path, ...rest } = req.query;
    const pluggyPath = path || "/";
    const qs = new URLSearchParams(rest).toString();
    const url = `${BASE}${pluggyPath}${qs ? "?" + qs : ""}`;

    const pluggyRes = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, "Authorization": `Bearer ${apiKey}` },
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });

    const ct = pluggyRes.headers.get("content-type") || "";
    if (ct.includes("json")) {
      return res.status(pluggyRes.status).json(await pluggyRes.json());
    }
    return res.status(pluggyRes.status).json({ error: await pluggyRes.text() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
