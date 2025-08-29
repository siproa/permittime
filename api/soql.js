export default async function handler(req, res) {
  try {
    const { portal, dataset, select, where, limit, order } = req.query;
    if (!portal || !dataset) return res.status(400).json({ error: "portal and dataset required" });

    const params = new URLSearchParams();
    if (select) params.set("$select", select);
    if (where)  params.set("$where",  where);
    if (order)  params.set("$order",  order);
    params.set("$limit", limit || "50000");

    const url = `${portal}${dataset}?${params.toString()}`;
    const headers = {};
    if (process.env.SOCRATA_APP_TOKEN) headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;

    const r = await fetch(url, { headers });
    const body = await r.text();
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");
    res.status(r.status).send(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
