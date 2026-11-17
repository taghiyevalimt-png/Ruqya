// Heap snapshot summary over CDP: count and bytes per (node type, constructor name), and the difference of two
// summaries — to see WHAT grows in a long run, not only how much. Values of strings are not kept (only their count
// and size), so no data of the page ends up in the evidence.
async function summary(cdp) {
  let chunks = [];
  const on = (e) => chunks.push(e.chunk);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", on);
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
  cdp.off("HeapProfiler.addHeapSnapshotChunk", on);
  const s = JSON.parse(chunks.join("")); chunks = null;
  const f = s.snapshot.meta.node_fields, types = s.snapshot.meta.node_types[0], n = f.length;
  const iT = f.indexOf("type"), iN = f.indexOf("name"), iS = f.indexOf("self_size");
  const out = {};
  for (let i = 0; i < s.nodes.length; i += n) {
    const t = types[s.nodes[i + iT]];
    const name = t === "string" || t === "concatenated string" || t === "sliced string" ? "(string)" : t === "number" ? "(number)" : t + ":" + String(s.strings[s.nodes[i + iN]]).slice(0, 60);
    const o = out[name] || (out[name] = { n: 0, bytes: 0 }); o.n++; o.bytes += s.nodes[i + iS];
  }
  return out;
}
function diff(a, b, top = 30) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]), rows = [];
  for (const k of keys) { const x = a[k] || { n: 0, bytes: 0 }, y = b[k] || { n: 0, bytes: 0 }; if (y.bytes !== x.bytes || y.n !== x.n) rows.push({ k, dn: y.n - x.n, dbytes: y.bytes - x.bytes, n: y.n, bytes: y.bytes }); }
  return rows.sort((p, q) => q.dbytes - p.dbytes).slice(0, top);
}
module.exports = { summary, diff };
