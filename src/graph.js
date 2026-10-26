export class Graph {
  constructor(data) {
    Object.assign(this, data);
    this.adj = this.nodes.map(() => []);
    for (const e of this.edges) {
      this.adj[e.a].push({ node: e.b, edge: e.id });
      this.adj[e.b].push({ node: e.a, edge: e.id });
      e.cumulative = [0];
      for (let i = 1; i < e.geometry.length; i++)
        e.cumulative.push(
          e.cumulative.at(-1) +
            Math.hypot(
              e.geometry[i][0] - e.geometry[i - 1][0],
              e.geometry[i][1] - e.geometry[i - 1][1],
            ),
        );
    }
    const N = this.nodes.length;
    this.dist = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (_, j) => (i === j ? 0 : Infinity)),
    );
    this.next = Array.from({ length: N }, () => Array(N).fill(null));
    for (const e of this.edges)
      for (const [a, b] of [
        [e.a, e.b],
        [e.b, e.a],
      ])
        if (e.length < this.dist[a][b]) {
          this.dist[a][b] = e.length;
          this.next[a][b] = b;
        }
    for (let k = 0; k < N; k++)
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++)
          if (this.dist[i][k] + this.dist[k][j] < this.dist[i][j]) {
            this.dist[i][j] = this.dist[i][k] + this.dist[k][j];
            this.next[i][j] = this.next[i][k];
          }
  }
  actor(node) {
    return { node, edge: null, from: node, to: node, offset: 0 };
  }
  anchor(a) {
    return a.edge === null ? a.node : a.to;
  }
  endpoints(a) {
    return a.edge === null
      ? [[a.node, 0]]
      : [
          [a.from, a.offset],
          [a.to, this.edges[a.edge].length - a.offset],
        ];
  }
  distance(a, b) {
    let d = Infinity;
    if (a.edge !== null && a.edge === b.edge) {
      const e = this.edges[a.edge];
      const u = a.from === e.a ? a.offset : e.length - a.offset;
      const v = b.from === e.a ? b.offset : e.length - b.offset;
      d = Math.abs(u - v);
    }
    for (const [i, x] of this.endpoints(a))
      for (const [j, y] of this.endpoints(b))
        d = Math.min(d, x + this.dist[i][j] + y);
    return d;
  }
  toNode(a, n) {
    return Math.min(...this.endpoints(a).map(([i, d]) => d + this.dist[i][n]));
  }
  point(a) {
    if (a.edge === null) {
      const n = this.nodes[a.node];
      return { x: n.x, y: n.y };
    }
    const e = this.edges[a.edge];
    const s =
      ((a.from === e.a ? a.offset : e.length - a.offset) / e.length) *
      e.cumulative.at(-1);
    let i = 1;
    while (i < e.cumulative.length - 1 && e.cumulative[i] < s) i++;
    const p = e.geometry[i - 1],
      q = e.geometry[i],
      t =
        (s - e.cumulative[i - 1]) /
        (e.cumulative[i] - e.cumulative[i - 1] || 1);
    return { x: p[0] + (q[0] - p[0]) * t, y: p[1] + (q[1] - p[1]) * t };
  }
  visible(a, b, range) {
    const d = this.distance(a, b);
    if (d > range) return false;
    if (a.edge !== null && a.edge === b.edge) return true;
    const p = this.point(a),
      q = this.point(b);
    return d <= Math.hypot(p.x - q.x, p.y - q.y) * 1.065 + 3;
  }
  depart(a, target) {
    if (a.edge !== null) return false;
    const c = this.adj[a.node].find((c) => c.node === target);
    if (!c) return false;
    a.from = a.node;
    a.to = target;
    a.edge = c.edge;
    a.offset = 0;
    return true;
  }
  move(a, metres) {
    if (a.edge === null) return 0;
    const e = this.edges[a.edge],
      d = Math.min(metres, e.length - a.offset);
    a.offset += d;
    if (a.offset >= e.length - 1e-8) {
      a.node = a.to;
      a.edge = null;
      a.from = a.node;
      a.offset = 0;
    }
    return d;
  }
  route(a, b) {
    const path = [a];
    let guard = 0;
    while (a !== b && guard++ < this.nodes.length) {
      a = this.next[a][b];
      if (a === null) return [];
      path.push(a);
    }
    return path;
  }
}
export function random(seed) {
  let x = seed >>> 0;
  return () => {
    x += 0x6d2b79f5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const copy = (x) => JSON.parse(JSON.stringify(x));
