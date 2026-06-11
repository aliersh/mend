# Ponti — design handoff package

This folder is the **repo-ready handoff** for the Ponti **app** design. Drop it into
the codebase (e.g. as `/design`) and point Claude Code at it.

## What's here
- **`DESIGN.md`** — the build contract. Tokens, locked decisions, screen-by-screen
  spec, the tweaks→production table, the repo file map, and the build order. **Start
  here.**
- **`prototype/`** — the hi-fi interactive prototypes (mobile + desktop) as a
  **read-only visual reference**. Open the `.html` files in a browser to see exact
  look, copy, and every state. They are **not** production code to copy verbatim
  (see `DESIGN.md` §2 and §13).

## How to use it with Claude Code
1. Commit this folder into `github.com/aliersh/ponti` (suggested path: `/design`).
2. Tell Claude Code, roughly:
   > *Read `design/DESIGN.md` first — it's the design spec for the app. The files in
   > `design/prototype/` are a visual reference (open them in a browser); don't copy
   > them — recreate the designs in our real stack (Privy / Pimlico / subgraph) using
   > the tokens and the repo file map in the doc.*
3. Build in the order in `DESIGN.md` §16.

## To view the prototypes
Serve this folder over HTTP and open a `.html`:

```
npx serve design        # then open prototype/Ponti — Prototype.html
```

(Opening from `file://` may be blocked by CORS — the `.jsx` load via Babel.)

## Note
This package is a **generated export** of the design project — regenerate it when the
design changes rather than hand-editing it. The canonical design source lives in the
design project, not here.
</content>
