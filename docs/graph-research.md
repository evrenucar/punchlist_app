# Redesigning the status-board graph: research and recommendations

Scope: the Punchlist "status board" dev interface renders a live node graph of one
agent's (occasionally a few subagents') work in a session. Nodes carry state
(queued / active / done / friction), authorship (`by: user` vs `by: agent`), a
`lane`, and `children`. It lives in a single zero-dependency HTML/CSS/JS file and
must stay that way: hand-written SVG/canvas + JS, no frameworks, no npm.

The user's verdict on today's "F+ staircase": "currently not super useful",
"agents don't really update it clear to reflect intent and state." He floated an
Obsidian-style graph "with per item being fully exposed and branching."

This doc researches how the obvious reference systems actually work, pulls one
stealable idea from each, and lands on a concrete redesign.

---

## 0. What today's graph does, and why it underdelivers

From `status/index.html` (the "F+ staircase", tagged as Evren's pick 2026-07-19):

- One horizontal **trunk = a timeline**: compacted older-done → last three done →
  the glowing active node → queue → friction buckets, left to right.
- **One staircase** of children steps down-right under the *selected* trunk node.
- Sibling stacks are collapsed behind **"+N more" pills**.
- The user walks it with arrow keys.

Three structural problems fall out of that design:

1. **It hides the branching.** The user explicitly wants items "fully exposed and
   branching." A single open staircase with `+N` pills is the opposite: at any
   moment you see one path and a pile of numbers. You cannot see the *shape* of
   the work.
2. **Timeline and hierarchy are fighting over one axis.** The X axis is both
   "time / pipeline stage" (trunk) and "tree depth" (staircase steps down-right).
   That double meaning is why it reads as a staircase instead of a graph, and why
   adding a second active subagent has nowhere clean to go.
3. **State and intent are under-encoded.** Nodes are typed by kind (done/active/
   queue/bucket) but the two things the user says are missing — *intent* (why this
   task, what it branches into) and *live state* (who's on it now, what's blocked)
   — are exactly the things a flat pill-collapsed timeline flattens away.

The research below is aimed at those three problems, not at "graphs are pretty."

---

## 1. How Obsidian's graph view actually works

**Mechanics.** Graph view is a core plugin. It reads the vault's link metadata
cache, turns every note into a node and every wikilink into an edge, and lays it
out with a **force-directed simulation** (attraction along edges, repulsion
between nodes, a centering force). It runs continuously — the graph jiggles until
it settles, and re-jiggles when you drag a node. There are two modes: the
**global graph** (the whole vault, filtered) and the **local graph** (only the
current note and its neighbors out to N hops).
([DeepWiki: Graph View](https://deepwiki.com/obsidianmd/obsidian-help/4.5-graph-view),
[Obsidian Help](https://obsidian.md/help/plugins/graph))

**Controls that matter.** Filters (search terms, tags-as-nodes on/off, orphans
on/off, exclude globs), groups (color nodes matching a query), display toggles,
and physics sliders (center force, repel force, link force, link distance). Hover
highlights a node and its immediate neighbors and dims the rest.
([Obsidian Help](https://obsidian.md/help/plugins/graph))

**Why people like it — and where it dies.** The community consensus (r/ObsidianMD,
and the critique below) is blunt: it's "more fun to look at than navigate." It
reveals structural gaps *in a small vault*. Under ~50 notes it renders cleanly
and shows you where your thinking is disconnected. Past ~200 notes the
force-directed layout collapses into "**the hairball**" — a dense tangle where
individual nodes are indistinguishable; past ~500 it also gets slow. The stated
fixes are all about *cutting the graph down*: the **local graph** (stays useful at
any vault size), aggressive **filtering**, and plugins like **Excalibrain** that
impose *typed hierarchical links* (parent / child / sibling) so the layout is a
navigable tree instead of a flat mesh.
([Code Culture: "Beautiful and Almost Completely Useless"](https://codeculture.store/blogs/developer-culture/obsidian-graph-view-useful),
[In Defense of the Graph View](https://www.eleanorkonik.com/p/its-not-just-a-pretty-gimmick-in-defense-of-obsidians-graph-view))

**The load-bearing lesson for us.** The critique names exactly our problem: the
graph "shows connections but omits note status, priorities, dates, draft status" —
it lacks *operational context*. A vanity mesh of dots is not what we want. What's
worth stealing from Obsidian is **not** the global force-directed hairball. It's:

- **The local-graph idea** — show the neighborhood of what's active, not the world.
- **Hover-to-focus dimming** — highlight a node + its neighbors, fade the rest.
- **Color groups by a query** — here, color by state and by author.

Our graph is tiny (one session, tens of nodes, not thousands) and it is *already*
a strict hierarchy (`children`), so we sidestep the hairball entirely by **not**
using a free force layout for structure. More on that in §4.

---

## 2. Other node UIs worth stealing one idea from each

### d3-hierarchy tidy tree (Reingold–Tilford / Buchheim)
The canonical "tidy tree." Given a single-rooted tree, it assigns each node an
(x, depth) so that: parents are centered over their children, siblings are evenly
spaced, subtrees never overlap, and the whole thing is as narrow as possible. The
Buchheim et al. refinement makes it **linear time**. It expects one root and gives
every node the same layout box.
([D3 tree docs](https://d3js.org/d3-hierarchy/tree),
[Observable tidy tree](https://observablehq.com/@d3/tree/2))
**Steal:** the tidy-tree *placement rule itself* — center parent over children,
pack siblings, no overlap. It's a ~40-line recursive first-pass/second-pass
algorithm and it's the single best fit for "fully exposed branching." We don't
need the d3 library; we need its algorithm, reimplemented (§4, Layout B).

### dagre (layered DAG)
Sugiyama-style layered layout: assign nodes to ranks (layers), order within a rank
to minimize edge crossings, then assign coordinates. Handles *general DAGs* — a
node with multiple parents, merges — which a pure tree can't.
([React Flow dagre example](https://reactflow.dev/examples/layout/dagre))
**Steal:** the **rank = layer** concept. If a subagent's task feeds back into the
main line (a merge), pure-tree layout breaks; ranks handle it. But dagre proper is
heavy to hand-roll. Take the idea (assign an integer depth/rank per node, lay out
rank by rank) without taking the crossing-minimization machinery.

### git commit graph (`git log --graph`, GitKraken, gitgraph.js)
The most relevant prior art we found. Commits are placed by **row = topological/
temporal order** and **column = a "lane"** assigned by a single greedy pass that
keeps a list of *active branches*. Walking newest→oldest, each commit either
continues an existing lane, opens a new lane (branch), or closes lanes (merge).
Columns freed by a merge become `nil` and get **reused** by later branches, so the
graph stays narrow without any global optimization. It's explicitly designed to be
**incremental and cheap** — one pass, one active-lanes list, greedy decisions.
([pvigier: Commit Graph Drawing Algorithms](https://pvigier.github.io/2019/05/06/commit-graph-drawing-algorithms.html),
[DoltHub: Drawing a commit graph](https://www.dolthub.com/blog/2024-08-07-drawing-a-commit-graph/))
**Steal — this is the big one.** The **swimlane + active-lanes model maps almost
1:1 onto our domain.** Time flows along one axis; each concurrent worker (the main
agent, each subagent) is a *lane*; spawning a subagent = opening a lane; that
subagent finishing/merging back = closing a lane and freeing it. It is *built for
a live, append-mostly stream*, which is exactly what a session is. See §4, Layout C.

### Mermaid / markmap mindmaps
Strictly hierarchical (a node connects only to its parent), indentation-driven,
auto-balanced spacing, one shape/color per semantic category, icons on first-level
branches to categorize at a glance.
([Mermaid mindmap](https://mermaid.js.org/syntax/mindmap.html))
**Steal:** the discipline — **one shape/color per semantic category**, icons/color
for the top-level split, so category is readable *pre-attentively* without reading
labels. For us: color = state, icon/shape = author (user vs agent).

### LLM agent-trace visualizers (LangSmith / LangGraph, Langfuse)
The closest tools in *our own domain*. They render an agent run as a **nested tree
of spans**: the top-level run, then LLM calls, then tool calls, then sub-agent
runs, each with **duration** recorded so you can see where time went. LangGraph
specifically makes "the trace tree *become* the graph execution" — nodes, edges,
state transitions.
([LangSmith observability](https://www.langchain.com/langsmith/observability),
[Langfuse agent observability](https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse))
**Steal:** two things. (a) **Nesting = the primary structure** for agent work; a
span tree is the natural shape, which validates a tree/indent layout over a free
mesh. (b) **Encode duration** — even a subtle width or a dim age gradient tells the
user "this has been active a while" / "this stalled", which is live *state* the
current board omits.

### Timeline–swimlane hybrids (Gantt, trace waterfalls)
Rows = actors/lanes, X = time, bars = spans. Trivially readable for "who is doing
what, when, and for how long." Weak at showing deep branching within one lane.
**Steal:** rows-as-actors and left-to-right time as the *spine*, then hang the
branching off each row.

---

## 3. Design principles this points to

Synthesizing the above into rules for our specific graph:

1. **Separate the two axes.** Don't overload one axis with both time and depth
   (today's core mistake). Pick one meaning per axis: **X = time/progress**,
   **Y = lane/branch depth**, or **X = tree depth, Y = sibling position** — never
   both on X.
2. **Expose siblings; never collapse to `+N`.** The user asked for this directly,
   and it's cheap: a session has tens of nodes, not thousands, so there is no
   hairball to hide from. Use a tidy-tree pack so siblings all fit.
3. **Encode state and author, not just kind.** Color = state (queued / active /
   done / friction), and make **active glow / pulse** so live work is obvious at a
   glance. Shape or a small badge = author (user-created vs agent-created). Both
   are already in the data (`by`, `active`, `done`, friction P-levels).
4. **Focus locally, like Obsidian's local graph + hover dimming.** The freshest
   context (active node + its ancestors + its immediate children + any live
   subagents) is full-brightness; older/done work compacts and dims. This is how
   you keep it readable as the session grows without hiding anything permanently.
5. **Encode time subtly.** A dim age gradient or a "last touched" pulse turns a
   static tree into a live one (the LangSmith/Langfuse duration lesson). Stalled
   active work should *look* stalled.
6. **Make "intent" a first-class edge.** The user says agents "don't update it
   clear to reflect intent." The graph can't fix sloppy agent updates by itself,
   but the layout can make intent *legible*: a parent→children fan literally *is*
   "this task decomposes into these", and an explicit queued-next ordering shows
   "what I plan to do next." Branching structure = intent made visible.

A note on the real bottleneck: **the prettiest layout won't help if agents don't
write good nodes.** Half of "reflect intent and state" is a *data* problem, not a
*layout* problem. Whatever layout we pick, pair it with a tighter convention for
how agents author nodes (clear parent/child decomposition, mark active the moment
work starts, close nodes promptly) — the git-lane model in particular only sings
if "spawn subagent" and "subagent done" are actually recorded as events.

---

## 4. Three candidate layouts

All three are hand-rollable in vanilla SVG/JS. None needs a library. The current
file already has pan/zoom, an SVG link layer, and absolute-positioned nodes, so
the rendering substrate exists — only the *placement function* changes.

### Layout A — Local force-directed graph (the literal Obsidian ask)
A physics sim: edges pull, nodes repel, a weak centering force, velocity-Verlet
integration stepped on `requestAnimationFrame`. Show only the local neighborhood
of the active node.
([d3-force uses velocity Verlet](https://github.com/d3/d3-force);
hand-roll per [Springy](http://getspringy.com/) — ~100 lines, no lib.)

- **Pros:** exactly the "Obsidian graph" the user pictured; organic, fully exposed
  nodes; handles arbitrary (non-tree) links including merges for free; genuinely
  pretty; nodes can be dragged.
- **Cons:** **non-deterministic** — the same session lays out differently each
  render, and nodes *move on their own*, which is disorienting for a thing you
  glance at repeatedly and drive with arrow keys. Labels overlap and jitter.
  Inherits the hairball risk as the session grows. Every source we found says the
  global force graph is the *least* useful mode. Fighting jitter (freezing after
  settle, pinning nodes) is where the real work goes.
- **Verdict:** seductive, wrong for a *repeatedly-glanced, keyboard-driven, live*
  board. Good as an optional "explore" toggle later; bad as the default.

### Layout B — Tidy horizontal tree (Reingold–Tilford / Buchheim)
Root(s) on the left, depth increases rightward, siblings packed vertically by the
tidy-tree rule (parent centered over children, subtrees never overlap). Elbow/
bezier links. Deterministic and stable. Roughly a 40–60 line two-pass recursion,
no library.
([D3 tree docs](https://d3js.org/d3-hierarchy/tree),
[Observable tidy tree](https://observablehq.com/@d3/tree/2))

- **Pros:** **fully exposes branching — kills the `+N` pills**, which is the
  headline request. Deterministic and stable across renders (no jitter). Reads as
  "this decomposed into these" — intent made visual. Cheap, well-documented
  algorithm. Plays perfectly with arrow-key navigation (up/down = siblings,
  left/right = parent/child). Color=state and glow=active drop straight in.
- **Cons:** pure tree only — a subtask that merges back into the main line has no
  clean home (mitigable: draw the merge as a secondary dashed edge on top of the
  tree). One agent's deep session can get *tall*; needs the local-focus rule (§3.4)
  to compact done branches. Doesn't natively show *time* — sibling order must be
  chosen to mean "queued order."
- **Verdict:** the best pure fit for "fully exposed and branching," and the safest
  to build. Strong default.

### Layout C — Timeline swimlanes with per-lane branching (the git-graph hybrid)
**X = time/progress; Y = lane.** Lane 0 = the main agent. Each subagent spawns a
new lane below (a new "active branch", git-style), and closing/merging frees the
lane for reuse. Within a lane, a task that decomposes fans its children out as a
small tidy sub-tree hanging off that lane's spine. Active nodes glow; done nodes
dim and compact leftward; queued nodes sit to the right of "now". A single greedy
left-to-right pass with an active-lanes list assigns rows — no global optimization,
and it's **incremental by construction**, so live updates are cheap.
([pvigier: commit graph algorithms](https://pvigier.github.io/2019/05/06/commit-graph-drawing-algorithms.html),
[DoltHub: drawing a commit graph](https://www.dolthub.com/blog/2024-08-07-drawing-a-commit-graph/))

- **Pros:** built *for a live append-mostly stream* — exactly a session. Shows the
  three things the current board muddles, cleanly separated: **time** (X),
  **who's working in parallel** (lanes/Y), and **intent/decomposition** (the fan
  per node). Directly models "prefer parallelism — spawn named subagents"
  (`pref-parallel` in the file): a subagent is *literally a lane*. Handles merges
  natively (that's what git lanes are for). Genuinely novel and legible — no other
  agent board looks like this.
- **Cons:** the most code of the three (lane assignment + per-lane sub-tree fan +
  time axis). Two things happening on Y (lane identity *and* sibling packing within
  a fan) needs careful visual separation (indent the fan, tint the lane band).
  When only one agent is running with no subagents, it degenerates to a single lane
  and looks like Layout B anyway — so it's only a *win* when there's parallelism.
- **Verdict:** the highest ceiling and the best match to the actual domain (a live,
  sometimes-parallel agent session), but the most to build and only pays off when
  subagents are in play.

---

## 5. Recommendation

**Ship Layout B (tidy horizontal tree) as the default, and grow it toward Layout C
(swimlanes) once subagent parallelism is common.**

Reasoning:

- **B is the direct answer to what the user asked for** — "per item fully exposed
  and branching" — and it's the one change that removes the `+N` pills and the
  double-meaning X axis, i.e. the two structural sins of the current staircase. It
  is deterministic (critical for a keyboard-driven thing you glance at often),
  it's the cheapest of the three, and the algorithm is textbook.
- **Do NOT default to Layout A** (the literal Obsidian force graph). Every source,
  including Obsidian's own community, says the free force layout is the *least*
  useful mode; its jitter and non-determinism actively fight a live, arrow-key
  board. Keep it in your back pocket as an optional "explore" view, not the home
  screen.
- **C is the right long-term target** because the domain really is a live,
  sometimes-parallel stream, and the git-lane model fits that better than any tree.
  But C only earns its extra code once "spawn named subagents" is routine. Until
  then it degenerates into B, so B is the correct first step and a clean upgrade
  path: start with the tidy tree, add a time-ordered spine and lanes when parallel
  work shows up.

Regardless of layout, spend equal effort on the **encoding and the data
convention** (§3.3–3.6): color=state, glow=active, shape/badge=author, a subtle
age/duration cue, local-focus dimming of done work, and a tightened agent
convention for authoring nodes. Those are what make the graph "reflect intent and
state" — the layout only gives them a place to live.

### Suggested build order
1. Replace the staircase placement with the tidy-tree two-pass (Layout B); render
   *all* siblings, delete the `+N` pills.
2. Add encodings: state→color, active→glow/pulse, author→shape/badge, done→dim.
3. Add local focus: full brightness for active + ancestors + immediate children +
   live subagents; compact/fade older done subtrees (with a click to expand).
4. When multi-subagent sessions become common, introduce a time-ordered spine and
   git-style lanes (Layout C), keeping the per-node tidy fan from step 1.

---

## Sources

- Obsidian Graph View mechanics — [DeepWiki](https://deepwiki.com/obsidianmd/obsidian-help/4.5-graph-view), [Obsidian Help](https://obsidian.md/help/plugins/graph)
- Obsidian graph critique / hairball — [Code Culture](https://codeculture.store/blogs/developer-culture/obsidian-graph-view-useful), [In Defense of the Graph View](https://www.eleanorkonik.com/p/its-not-just-a-pretty-gimmick-in-defense-of-obsidians-graph-view)
- Tidy tree (Reingold–Tilford / Buchheim) — [D3 tree docs](https://d3js.org/d3-hierarchy/tree), [Observable tidy tree](https://observablehq.com/@d3/tree/2)
- Layered DAG layout — [React Flow dagre example](https://reactflow.dev/examples/layout/dagre)
- Commit-graph lane algorithm — [pvigier](https://pvigier.github.io/2019/05/06/commit-graph-drawing-algorithms.html), [DoltHub](https://www.dolthub.com/blog/2024-08-07-drawing-a-commit-graph/)
- Mindmap layout discipline — [Mermaid mindmap](https://mermaid.js.org/syntax/mindmap.html)
- Agent-trace visualizers — [LangSmith](https://www.langchain.com/langsmith/observability), [Langfuse](https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse)
- Vanilla force layout (Verlet) — [d3-force](https://github.com/d3/d3-force), [Springy](http://getspringy.com/)
