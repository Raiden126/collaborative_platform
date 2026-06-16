# Collaborative Workflow Builder

A web app for **building, running and collaborating on automation workflows** — visually,
in your browser, with your teammates editing the same canvas live. Think Zapier / n8n /
Retool: you drag nodes onto a canvas, wire them together (a trigger → some conditions →
actions like *send email* / *call webhook* / *send SMS*), configure each step, then run
and debug it.

It's built with a Vue 3 front end and a NestJS back end. This README is the **user guide**:
what you can do in the UI right now, and how. For architecture and contributor docs see
[CLAUDE.md](./CLAUDE.md) and [SKILL.md](./SKILL.md).

---

## 1. Signing in

Open the app at **http://localhost:5173** and log in. Three demo accounts are seeded
(password for all: `password123`):

| Email | Role | What they can do |
|---|---|---|
| `admin@cwb.dev` | **Admin** | Everything — create, edit, delete, duplicate, **publish**, run, view analytics, manage users |
| `editor@cwb.dev` | **Editor** | Create, edit, duplicate and **run** workflows; **cannot publish or delete** |
| `viewer@cwb.dev` | **Viewer** | **Read-only** — can open and view workflows + analytics, but not change anything |

> The UI adapts to your role automatically. Buttons you're not allowed to use (e.g.
> *Publish*, *Delete*) simply don't appear. This is the dynamic permission system — try
> logging in as each role to see the interface change.

Your session stays alive across refreshes (tokens auto-refresh in the background), and
*Logout* (top-right) ends it.

---

## 2. The Dashboard

The landing page after login. It shows live analytics:

- **Total Workflows**, **Active (Published)**, **Failed Executions**, **Success Rate**
- An **Execution Trends** chart (last 14 days, success vs. failed) powered by Chart.js

Use it to get a health overview of all your automations at a glance.

---

## 3. Managing workflows (the Workflows page)

This is your library of workflows. Here you can:

| Action | How | Who |
|---|---|---|
| **Create** | Click **+ New workflow**, type a name, press *Create*. You're taken straight into the builder. | Admin, Editor |
| **Open** | Click **Open** on any card to edit it on the canvas. | Everyone |
| **Duplicate** | Click **Duplicate** to make a full copy (named "… (copy)"). | Admin, Editor |
| **Publish** | Click **Publish** to mark a workflow live (status turns to `PUBLISHED`). | Admin |
| **Delete** | Click **Delete** (confirms first). | Admin |

Each card shows the workflow's name, status badge (`DRAFT` / `PUBLISHED`) and version.

---

## 4. The Visual Builder

Open a workflow to enter the builder. It has three parts: a **node palette** (left), the
**canvas** (middle), and a **right panel** with three tabs (Props / Run / Versions).

### Adding nodes
The palette lists node types grouped by category. There are two ways to add one:
- **Click** a node in the palette → it drops onto the canvas, or
- **Drag** it from the palette and drop it where you want.

Available node types: **Trigger** (the entry point), **Condition**, **Action**, **Delay**,
**Webhook**, **Email**, **SMS** — plus any plugin nodes (a sample **Slack** node ships as
an example). Each renders with its own icon and color.

### Wiring nodes together
Every node has connection handles (small dots). **Drag from one node's bottom handle to
another node's top handle** to create a connection. The flow runs along these links
(triggers first, then downstream).

### Moving & arranging
- **Drag** a node to reposition it.
- **Scroll / pinch** to zoom; **drag the empty canvas** to pan.
- Bottom-left **controls** give you zoom in/out, fit-to-view and lock.
- The **minimap** (bottom-right) shows the whole graph for quick navigation on large
  workflows.

### Configuring a node (Props tab)
Click a node to select it. The **Props** panel on the right shows a form tailored to that
node type — e.g. an Email node asks for *To / Subject / Body*; a Webhook node asks for
*URL / Method*. These forms are generated dynamically from the node's schema, so every
node type gets the right fields (text, number, email, dropdown, checkbox, etc.). Edits
save as you type. You can also **Delete** the selected node from here.

### Undo / Redo
Every change (add, move, edit, connect, delete) is undoable:
- **Ctrl + Z** to undo, **Ctrl + Y** (or **Ctrl + Shift + Z**) to redo
- Or use the **↶ Undo / Redo ↷** buttons in the toolbar

History keeps your last 100 actions.

### Importing & exporting (JSON)
The builder toolbar has **⬆ Import** and **⬇ Export**:
- **Import** — upload a `.json` file and its nodes (and connections) are added straight
  onto the canvas. Accepts a full graph `{ "nodes": [...], "connections": [...] }`, a plain
  array of nodes, or a single node. Unknown node types are skipped (you'll get a notice),
  ids are regenerated so imports never clash, and each imported node is persisted like a
  normal edit. A ready-to-try example lives at `samples/order-processing.workflow.json`.
- **Export** — downloads the current workflow as JSON (round-trips with Import).

### Publishing
When a workflow is ready, click **Publish** in the toolbar (Admins only) to mark it live.

---

## 5. Running & debugging a workflow (Run tab)

Switch the right panel to the **Run** tab and click **▶ Run** to simulate the workflow.
You'll see:

- **Step-by-step execution** — each node is processed in order. Use the **⏮ / ⏭** buttons
  to step through, **Reset** to start over.
- **Node highlighting** — the node currently executing is highlighted on the canvas;
  finished nodes show ✓ (success), ✕ (failed) or are dimmed (skipped).
- **Execution log** — each step shows its status, duration (ms) and any error message.
- An overall **SUCCESS / FAILED** badge and total run time.

This doubles as a **debugger**: failed and skipped nodes are called out, with error text
and timing, so you can see exactly where a run breaks.

Nodes run for real: **Webhook** makes an actual HTTP request, **Condition** follows the
matching true/false branch, **Email** sends over SMTP and **SMS** via Twilio. Email and
SMS use a safe mock (validates + logs, no real send) until you add credentials to
`backend/.env` (`SMTP_*` / `EMAIL_FROM`, `TWILIO_*`) — then the very same workflow delivers
for real with no code change.

---

## 6. Versioning & history (Versions tab)

Workflows are versioned automatically (on create, publish, restore) and on demand:

- **Snapshot** — click to save the current state as a new version with a note.
- **Restore** — roll any workflow back to a previous version (the canvas updates, and for
  collaborators too).
- **Compare / Diff** — pick two versions (A and B) and click **Diff** to see which nodes
  were **added** (green) or **removed** (red) between them.

### Time travel
In the **Run** tab, the **Time Travel** list shows every change ever made to the workflow
(as a numbered event stream). Click any entry (`#3 NODE_CREATED`, …) to **jump the canvas
to exactly how the workflow looked at that point in time**. Because everything is stored
as an event stream, any historical state is perfectly reproducible.

---

## 7. Real-time collaboration

Multiple people can edit the **same workflow at the same time**:

- **Presence** — avatars of everyone currently in the workflow appear in the toolbar
  (a green dot = live connection).
- **Live cursors** — you see collaborators' mouse cursors move on the canvas, each in
  their own color with their name.
- **Live edits** — when someone adds, moves, connects or edits a node, it appears on your
  canvas instantly.
- **Conflict handling** — if two people change the same thing at once, the server applies
  changes in order (Last-Write-Wins), so everyone converges on the same state.

**Try it:** open the same workflow in two browsers (e.g. `admin@cwb.dev` in one, a
different browser/incognito as `editor@cwb.dev`), and edit in one — watch it update live
in the other.

---

## 8. Working offline

The builder is **offline-first**. If your connection drops (look for the **Offline**
indicator in the sidebar):

- You can keep **adding, moving, editing and deleting** nodes — it all keeps working.
- Your changes are saved locally (in the browser) and a **"N queued"** badge shows how
  many are pending.
- When you're back **Online**, the queued changes sync to the server automatically and
  you get a *"Synced"* notification.

**Try it:** in your browser's DevTools → Network tab, switch to *Offline*, make some
edits, then go back *Online*.

---

## 9. Notifications & Activity

- **Notifications** — toast messages pop up (top-right) for key events: workflow created,
  updated, published, failed, or offline changes synced. They **auto-dismiss after 5
  seconds** (or click to dismiss).
- **Activity Timeline** (sidebar → *Activity*) — a chronological feed of everything that
  has happened: who created, edited, published, deleted or ran which workflow, and when.

---

## 10. Quick reference: what each role sees

| Capability | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|
| View workflows & dashboard | ✅ | ✅ | ✅ |
| Create / edit / duplicate | ✅ | ✅ | — |
| Run / simulate / debug | ✅ | ✅ | — |
| Versions: snapshot / restore / diff | ✅ | ✅ | view only |
| Publish | ✅ | — | — |
| Delete | ✅ | — | — |

If you don't see a button, your role doesn't have that permission — that's by design.

---

## Running the app (for reference)

The database is already set up. To start everything:

```bash
pnpm dev          # starts the API (:3000) and the web app (:5173)
```

First-time setup (if starting fresh on a new machine):

```bash
pnpm install
pnpm build
cp backend/.env.example backend/.env
pnpm db:up                                    # PostgreSQL via Docker
pnpm --filter @cwb/backend prisma:migrate
pnpm --filter @cwb/backend prisma:seed        # demo roles + users
pnpm dev
```

API reference (Swagger): http://localhost:3000/api/docs

---

## Under the hood (one line)

Every change you make is recorded as an **event**, and the workflow you see is the sum of
those events replayed. That single idea is what makes undo/redo, live collaboration,
offline sync, versioning and time-travel all work together. See
[CLAUDE.md](./CLAUDE.md) for the full architecture.

**Stack:** Vue 3 · Vuex · Vue Flow · Chart.js · Dexie · NestJS · Prisma · PostgreSQL ·
Socket.IO. **License:** MIT.
