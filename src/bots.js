// Both bots use the same public runner view as the UI, never Game.enemy or AI memory.
export function botTurn(game, kind = "Courier") {
  if (
    game.state !== "playing" ||
    game.paused ||
    game.player.edge !== null ||
    game.time < game.hideUntil
  )
    return;
  const g = game.g,
    p = game.player,
    view = game.view();
  const objectives = game.goals;
  let target = objectives
    .slice()
    .sort((a, b) => g.toNode(p, a) - g.toNode(p, b))[0];
  if (kind === "Courier") {
    game.command(g.next[p.node][target]);
    return;
  }
  if (view.contact && game.decoys > 0) game.decoy();
  const known = view.enemy;
  // Weighted Dijkstra from this junction. Avoid recently observed enemy corridors.
  const dist = g.nodes.map(() => Infinity),
    prev = g.nodes.map(() => null),
    done = new Set();
  dist[p.node] = 0;
  for (let i = 0; i < g.nodes.length; i++) {
    let u = null;
    for (let n = 0; n < dist.length; n++)
      if (!done.has(n) && (u === null || dist[n] < dist[u])) u = n;
    if (u === null || !Number.isFinite(dist[u])) break;
    done.add(u);
    for (const c of g.adj[u]) {
      const danger = known
        ? Math.max(0, 170 - g.toNode(known, c.node)) *
          Math.max(0.15, 1 - view.enemyAge / 16)
        : 0;
      const cost = g.edges[c.edge].length + danger * 1.65;
      if (dist[u] + cost < dist[c.node]) {
        dist[c.node] = dist[u] + cost;
        prev[c.node] = u;
      }
    }
  }
  target = objectives.slice().sort((a, b) => dist[a] - dist[b])[0];
  let n = target;
  let guard = 0;
  while (prev[n] !== p.node && prev[n] !== null && guard++ < g.nodes.length)
    n = prev[n];
  if (n !== p.node) game.command(n);
}
