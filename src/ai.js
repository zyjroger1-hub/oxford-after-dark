// Information boundary: this module receives ONLY graph, own actor, public scenario,
// and a sensor packet. It never receives a Game, player object, inputs or future route.
import { copy, random } from "./graph.js";
export class Pursuer {
  constructor(graph, own, publicScenario, mode, seed) {
    this.g = graph;
    this.own = own;
    this.public = copy(publicScenario);
    this.mode = mode;
    this.rng = random(seed);
    this.belief = graph.nodes.map(() => 1 / graph.nodes.length);
    this.visited = graph.nodes.map(() => -1000);
    this.last = null;
    this.seen = false;
    this.ever = false;
    this.target = null;
    this.reason = "No sighting. Patrol the public clue locations.";
    this.checkedAt = -Infinity;
    this.lastUpdate = -1;
    this.noise = null;
    this.lastPlan = -10;
    this.status = "PATROL";
  }
  normalise() {
    const sum = this.belief.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) {
      this.belief = this.g.nodes.map(() => 1 / this.g.nodes.length);
    } else this.belief = this.belief.map((p) => p / sum);
  }
  observe(packet) {
    const { time, sight, noise, clearNodes } = packet;
    const g = this.g;
    if (sight) {
      this.last = {
        time,
        position: copy(sight.position),
        direction: sight.direction,
      };
      this.ever = true;
      this.seen = true;
      this.belief.fill(0);
      for (const [n, d] of g.endpoints(sight.position))
        this.belief[n] +=
          (sight.position.edge !== null
            ? n === sight.position.to
              ? 1.6
              : 0.7
            : 1) /
          (d + 8);
      this.normalise();
      this.noise = null;
    } else {
      this.seen = false;
      if (time - this.lastUpdate >= 1) {
        const out = this.belief.map(() => 0);
        for (let i = 0; i < out.length; i++) {
          let total = 0;
          for (const c of g.adj[i]) {
            let bias = 1;
            if (
              this.last?.position.edge !== null &&
              this.last?.position.edge !== undefined
            ) {
              const a = g.nodes[this.last.position.from],
                b = g.nodes[this.last.position.to],
                u = g.nodes[i],
                v = g.nodes[c.node];
              const cosine =
                ((b.x - a.x) * (v.x - u.x) + (b.y - a.y) * (v.y - u.y)) /
                (Math.hypot(b.x - a.x, b.y - a.y) *
                  Math.hypot(v.x - u.x, v.y - u.y) || 1);
              bias += 0.35 * cosine * Math.exp(-(time - this.last.time) / 12);
            }
            const p = Math.min(
              0.35,
              (4.4 / g.edges[c.edge].length / g.adj[i].length) * bias,
            );
            out[c.node] += this.belief[i] * p;
            total += p;
          }
          out[i] += this.belief[i] * (1 - total);
        }
        this.belief = out;
        // Reachability bound derives from the last OBSERVED position and elapsed time.
        if (this.last)
          for (let i = 0; i < out.length; i++)
            if (
              g.toNode(this.last.position, i) >
              4.4 * (time - this.last.time) + 110
            )
              this.belief[i] = 0;
        this.lastUpdate = time;
      }
      for (const n of clearNodes) this.belief[n] = 0;
      this.normalise();
    }
    if (noise && !sight) {
      this.noise = { node: noise.node, until: time + 13 };
      this.belief = this.belief.map((p) => p * 0.3);
      this.belief[noise.node] += 0.7;
      this.normalise();
    }
    if (
      this.noise &&
      (time > this.noise.until ||
        (this.own.edge === null && this.own.node === this.noise.node))
    )
      this.noise = null;
  }
  decide(time) {
    const g = this.g,
      own = this.own,
      anchor = g.anchor(own);
    if (own.edge !== null) return;
    this.visited[own.node] = time;
    if (
      time - this.lastPlan < 0.45 &&
      this.target !== null &&
      this.target !== own.node
    ) {
      g.depart(own, g.next[own.node][this.target]);
      return;
    }
    this.lastPlan = time;
    if (this.last && own.node === g.anchor(this.last.position))
      this.checkedAt = this.last.time;
    let target, reason, status;
    if (this.noise && !this.seen) {
      target = this.noise.node;
      reason = `Footsteps were heard at junction ${target}. Investigate the sound; it may be misleading.`;
      status = "INVESTIGATE";
    } else if (this.seen && this.last) {
      const pos = this.last.position;
      target = g.anchor(pos);
      if (pos.edge !== null) {
        const ends = g
          .endpoints(pos)
          .sort(
            ([a, x], [b, y]) =>
              g.dist[own.node][a] + x - (g.dist[own.node][b] + y),
          );
        target = ends[0][0];
        // If already at the best entry endpoint, move onto the observed edge toward the other endpoint.
        if (target === own.node)
          target = target === pos.from ? pos.to : pos.from;
      }
      status = "CHASE";
      reason = `Visual contact. Take the shortest road route to the observed position via junction ${target}.`;
      if (this.mode === "Intercept") {
        // Predict continuation of the observed heading toward PUBLIC goals. No actual objective order is known.
        const origin = g.anchor(pos);
        const goals = [
          ...this.public.clues,
          ...(this.public.exits ?? [this.public.exit]),
        ].filter((n) => n !== origin);
        let best = null;
        for (const goal of goals) {
          const route = g.route(origin, goal);
          let heading = 1;
          if (pos.edge !== null && route.length > 1) {
            const a = g.nodes[pos.from],
              b = g.nodes[pos.to],
              c = g.nodes[route[1]],
              v = [b.x - a.x, b.y - a.y],
              w = [c.x - b.x, c.y - b.y];
            const cosine =
              (v[0] * w[0] + v[1] * w[1]) /
              (Math.hypot(...v) * Math.hypot(...w) || 1);
            heading = cosine > 0.25 ? 1.45 : cosine < -0.25 ? 0.6 : 1;
          }
          for (const n of route.slice(1, 5)) {
            const etaP = g.toNode(pos, n) / 4.4,
              etaA = g.toNode(own, n) / this.public.pursuerSpeed;
            if (etaP < 3 || etaP > 42 || etaA > etaP + 1.5) continue;
            const score =
              heading * (18 / (8 + Math.abs(etaP - etaA))) +
              0.03 * g.adj[n].length;
            if (!best || score > best.score)
              best = { score, n, goal, etaP, etaA };
          }
        }
        if (best) {
          target = best.n;
          status = "INTERCEPT";
          reason = `Observed heading suggests a route toward public goal ${best.goal}. Reach junction ${target} in ${best.etaA.toFixed(0)}s; predicted runner arrival ${best.etaP.toFixed(0)}s.`;
        }
      }
    } else if (
      this.mode === "Greedy" &&
      this.last &&
      this.checkedAt < this.last.time &&
      g.toNode(own, g.anchor(this.last.position)) > 8
    ) {
      target = g.anchor(this.last.position);
      status = "LAST SEEN";
      reason = `Contact lost. Go to last observed junction ${target}; no new position is known.`;
    } else if (this.ever && this.mode !== "Greedy") {
      status = this.mode === "Intercept" ? "PREDICT / SEARCH" : "SEARCH";
      let best = -Infinity;
      for (let n = 0; n < g.nodes.length; n++) {
        const distance = g.toNode(own, n);
        if (distance < 7) continue;
        let mass = this.belief[n];
        for (const c of g.adj[n]) mass += this.belief[c.node] * 0.3;
        let score =
          (mass / (18 + distance)) * Math.min(1, (time - this.visited[n]) / 30);
        if (this.mode === "Intercept") {
          const goalWeight =
            this.public.clues.includes(n) ||
            (this.public.exits ?? [this.public.exit]).includes(n)
              ? 1.5
              : 1;
          score *= goalWeight * (1 + 0.08 * g.adj[n].length);
        }
        if (score > best) {
          best = score;
          target = n;
        }
      }
      reason = `Contact lost ${Math.round(time - (this.last?.time ?? time))}s ago. Junction ${target} covers ${(this.belief[target] * 100).toFixed(1)}% candidate mass, weighted by travel cost and recent checks.`;
    } else {
      status = "PATROL";
      const options = this.public.clues
        .concat(this.public.exits ?? [this.public.exit])
        .filter((n) => n !== own.node);
      target = options.sort(
        (a, b) =>
          this.visited[a] - this.visited[b] ||
          g.toNode(own, a) - g.toNode(own, b),
      )[0];
      if (target === this.target && time - this.visited[target] < 15)
        target =
          g.adj[own.node][Math.floor(this.rng() * g.adj[own.node].length)].node;
      reason = this.last
        ? "Last position checked. Patrol the least recently checked public objective."
        : "No sighting. Patrol the least recently checked public objective.";
    }
    if (target === own.node) {
      const opts = g.adj[own.node];
      target = opts
        .slice()
        .sort((a, b) => this.visited[a.node] - this.visited[b.node])[0]?.node;
      reason += ` Already at the observed junction; check adjacent junction ${target}.`;
    }
    this.target = target;
    this.reason = reason;
    this.status = status;
    if (target !== undefined && target !== null && target !== own.node)
      g.depart(own, g.next[anchor][target]);
  }
  record() {
    return {
      belief: this.belief.slice(),
      target: this.target,
      reason: this.reason,
      status: this.status,
      last: copy(this.last),
      seen: this.seen,
    };
  }
}
