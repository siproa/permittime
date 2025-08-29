export default async function handler(req, res) {
  try {
    const { portal, dataset, select, where, order, group, limit } = req.query;
    if (!portal || !dataset) {
      return res.status(400).json({ error: "portal and dataset required" });
    }

    const params = new URLSearchParams();
    if (select) params.set("$select", select);
    if (where)  params.set("$where", where);
    if (order)  params.set("$order", order);
    if (group)  params.set("$group", group);
    params.set("$limit", String(limit || 5000));

    const url = `${portal.replace(/\/?$/, "/")}${dataset}?${params.toString()}`;
    const r = await fetch(url, { headers: { "accept": "application/json" } });
    const txt = await r.text();
    let data; try { data = JSON.parse(txt); } catch { data = null; }

    if (!r.ok || !Array.isArray(data)) {
      return res.status(r.status || 500).json({ message: data?.message || txt || "Upstream error" });
    }

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Server error" });
  }
}
