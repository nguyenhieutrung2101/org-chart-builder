# Function Inventory — Org Builder

> Generated from a full read of the codebase; regenerated after the module split (`public/js/*.js`) and the chart-layout module (v11). Line numbers verified by script against the source.
> Scope: all source files; `node_modules`, vendored libraries (`public/js/vendor`) and `tests/` excluded.

## Source files & roles

| File | Lines | Role |
|---|---|---|
| `public/index.html` | 308 | Markup only: header, landing, flow module (4 tabs), chart-layout module; loads `css/app.css` and the `js/` files below in order. |
| `public/css/app.css` | 388 | All styles (design tokens, both modules, print rules). |
| `public/js/01-consts.js` | 13 | Constants: box geometry, zoom limits, minimap budget, `SCHEMA_V` |
| `public/js/02-i18n.js` | 351 | i18n dictionary `STR{vi,en}`, `t/tf`, level list `LEVELS` (ĐB, CC, T1–T8) + colours, tiny utilities |
| `public/js/03-state.js` | 137 | Global state, rule/CIG seeding, presentation layer `doc`, undo, serialization |
| `public/js/04-model.js` | 259 | Org-tree model, visibility, pure layout, headcount roll-up |
| `public/js/05-org-render.js` | 212 | Flow module — org tab rendering (canvas, panel, hierarchy table), `renderAll` |
| `public/js/06-export.js` | 272 | TSV/clipboard, JSON save/load (`applyState`), draw.io export |
| `public/js/07-vline.js` | 218 | Flow module — vertical-line tab |
| `public/js/08-flow.js` | 481 | Flow engine, FC groups, Fund Centers, result table |
| `public/js/09-rules.js` | 380 | Flow module — Flow-Rules tab (palette, matrix, CIG scenarios, modes) |
| `public/js/10-zoom.js` | 115 | Org-tab zoom + minimap |
| `public/js/11-doc.js` | 658 | **Chart-layout module**: printable SVG page in mm, drag/bend interactions, print, PDF |
| `public/js/12-wiring.js` | 314 | Pan handlers, shortcuts, event wiring, landing + module switching, init |
| `public/js/vendor/*` | — | jsPDF 2.5.2 + svg2pdf 2.2.4 (MIT), loaded lazily by "Download PDF". Not inventoried. |
| `public/fonts/*.ttf` | — | Liberation Sans/Serif (SIL OFL) embedded into downloaded PDFs. |
| `tests/*.test.mjs` | — | Playwright suites (`npm test`). Not inventoried. |

Every `js/` file is a classic script sharing one global scope (no module system) — every top-level `function` is a global; files must load in numeric order. **[PUBLIC]** marks UI entry points (wired to a DOM event / called from generated DOM) or cross-section APIs.

Conventions: types are inferred (untyped ES5-style JS). `NodeId` = string like `n1`; `Node`/`VNode` = plain objects in `nodes`/`vnodes` Maps; `Layout` = return value of `layout()`; `Doc` = the presentation layer object. Side-effect legend: **DOM**, **state** (globals), **undo** (pushes snapshot via `snap`), **LS** (localStorage), **DL** (download), **CB** (clipboard).

---

## `01-consts.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|

## `02-i18n.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `LANG` | 6 | `(IIFE) → 'vi'|'en'` | Read saved UI language from localStorage, default `vi` | — / module init | reads **LS** |
| `t` | 301 | `(k: string) → string` | Translate key against `STR[LANG]`, fall back to `vi`, then key itself | — / **~200 call sites** (every label in the app) | pure |
| `tf` | 302 | `(k: string, p: object) → string` | Translate + interpolate `{name}` placeholders | `t` / all parametrised messages | pure |
| `flowLabel` | 306 | `(f: FlowKey) → string` | Display label for a flow key (`Xanh`→`Green` in EN); data key unchanged | — / `renderRules`, `renderFlowResult`, `flowTsv` | pure |
| `colLabel` | 307 | `(c: ColKey) → string` | Display label for a matrix column (`TĐ1`→`R1` in EN) | — / `applyStatic`, `renderFlowResult`, `flowTsv` | pure |
| `segLabel` | 308 | `(s: ScopeKey) → string` | Display label for scope/branch (`VH`→`Vận hành`/`Operations`) | `t` / panel, chips, result heads, badges | pure |
| `applyStatic` [PUBLIC] | 310 | `() → void` | Apply i18n to all static `data-i18n*` elements, `<title>`, `<html lang>`, language-button label | `t`, `colLabel`, `refreshStateLabels` / `setLang`, init | **DOM** |
| `setLang` [PUBLIC] | 321 | `(l: 'vi'\|'en') → void` | Switch UI language, persist, re-render everything | `applyStatic`, `renderAll` / `#bLang` click | **state** (`LANG`), **LS**, **DOM** |
| `$` | 334 | `(id: string) → Element\|null` | `getElementById` shorthand | — / **~100 call sites** | pure (read DOM) |
| `rnum` | 335 | `(lv: LevelKey) → number` | Level string → rank index (`CC`=0 … `T8`=8; −1 unknown) | — / layout, model, panel | pure |
| `msg` | 336 | `(s: string) → void` | Show toast in header, auto-clear after 3.5s | `$` / ~25 call sites | **DOM**, timer |
| `debounce` | 340 | `(fn: Function, ms: number) → Function` | Standard trailing debounce | — / builds `refreshFlowResultSoon` | pure (returns closure w/ timer) |
| `dispName` | 343 | `(n: Node) → string` | Best display name: dept → title → person → "(empty)" | `t` / many | pure |
| `cellText` | 344 | `(n: Node) → string` | Multi-line box text incl. ★ marker, for table cells & tooltips | `t` / `buildGrid`, `renderCanvas` | pure |
| `roleText` | 349 | `(n: Node\|pseudo) → string` | "title/dept ⏎ person" — approver cell text | `t` / `resolveCell`, `roleBoxText` | pure |

## `03-state.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `gridFamily` | 43 | `() → object` | Active grid family: `vlineGrids` if `ruleMode==='vline'` else `ruleGrids` | — / `gridFor`, `curGrid`, `setCurCig` | pure (reads state) |
| `gridFor` | 44 | `(cigId: string) → Grid` | Grid for a CIG scenario, falling back to Common (`''`) | `gridFamily` / `flowBlocks`, `resolveCell` default | pure (reads state) |
| `curGrid` | 45 | `() → Grid` | Grid being edited (current mode + current CIG); **creates it if missing** | `gridFamily` / `dropRole`, `cycleScope`, `removeAssign`, `renderRules` | **state** (lazy-create) |
| `vser` | 47 | `(id: VNodeId) → object` | Recursively serialize a vertical-line subtree (imported nodes keep only `orgId`) | `vser` (rec.) / `serializeAll` | pure |
| `vdisp` | 53 | `(n: VNode) → {dept,title,person,star}` | Display fields of a vnode; imported ones mirror the org-chart box live | — / `renderVline`, `renderVPanel`, `patchVNodeText`, `vDel`, `resolveCell` | pure (reads state) |
| `vlineSuperiorOf` | 61 | `(cb: Node\|null) → VNode\|null` | The BMO's direct superior on the vertical-line tree (parent of its imported vnode) | — / `resolveCell` (VLINE) | pure (reads state) |
| `defaultCigs` | 70 | `() → Cig[]` | The three default cost groups (CI-SM / CI-TE / CI-OP) used for a fresh document or a legacy file that has no `cigs` key | — / `seedRules`, `applyState` | pure |
| `seedRules` | 76 | `() → void` | Reset rules state for a fresh document: empty palette/grids, default CIGs, `flow` mode | `defaultCigs` / `applyState` (legacy files), init | **state** |
| `defaultDoc` | 90 | `() → Doc` | Default presentation layer (`page`, `orient`, `font`, `scheme`, `header`, `code{}`, `notes[]`, `show{}`) | — / `cleanDoc`, module init | pure |
| `cleanDoc` | 97 | `(src: any) → Doc` | Validate a `doc` object from a file field by field; anything missing or of the wrong type falls back to the default (old files load unchanged) | `defaultDoc` / `applyState` | pure |
| `serializeAll` | 118 | `() → object` | Whole document → plain JSON (schema `v: SCHEMA_V` = 11, incl. `doc`) | `ser`, `vser` / `snap`, `saveJSON` | pure (reads state) |
| `snap` | 124 | `(key: string\|null) → void` | Push undo snapshot; consecutive same-`key` edits coalesce; caps at 60; sets `dirty` | `serializeAll` / **~35 call sites** (every mutation) | **state** (undo stack) |
| `undo` [PUBLIC] | 131 | `() → void` | Pop snapshot and restore | `applyState`, `renderAll`, `msg` / `#bUndo`, Ctrl+Z | **state**, **DOM** |

## `04-model.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `nn` | 7 | `(dept,title,person: string, lv: LevelKey, parent: NodeId\|null, id?) → NodeId` | Create a node in `nodes` (not attached to any child list); presentation fields start blank (`hc:null, annot:'', desc:'', dx:0, wp:null`) | — / `addRoot/Child/Sib`; `applyState` uses its own `mk` | **state** |
| `addRoot` [PUBLIC] | 14 | `() → void` | New CC root (clears focus first) | `snap`, `nn`, `select`, `msg` / `#bRoot` | **state**, **undo**, **DOM** |
| `addChild` [PUBLIC] | 20 | `(pid: NodeId) → void` | New child one level below parent; un-collapses parent | `snap`, `nn`, `select` / panel `#bChild` | **state**, **undo**, **DOM** |
| `addSib` [PUBLIC] | 28 | `(id: NodeId) → void` | New sibling right after `id`, same level | `snap`, `nn`, `select` / panel `#bSib` | **state**, **undo**, **DOM** |
| `subCount` | 36 | `(id: NodeId) → number` | Subtree size incl. self | rec. / `delNode`, `renderCanvas` (+N badge) | pure |
| `wipe` | 41 | `(id: NodeId) → void` | Recursively delete subtree from `nodes` | rec. / `delNode` | **state** |
| `delNode` [PUBLIC] | 46 | `(id: NodeId) → void` | Delete box (+confirm if it has children); clean focus, group BMO refs, vline orphans, and role boxes linked to the deleted subtree (toast with counts, undoable) | `confirm`, `snap`, `wipe`, `pruneVlineOrphans`, `pruneNodeRoles`, `renderAll`, `msg` / panel `#bDel` | **state**, **undo**, **DOM** |
| `moveSib` [PUBLIC] | 61 | `(id: NodeId, dir: ±1) → void` | Reorder among siblings | `snap`, `renderAll` / panel `◀▶` | **state**, **undo**, **DOM** |
| `setT` [PUBLIC] | 70 | `(id: NodeId, t: LevelKey) → void` | Change level; raises descendants below new level (invariant child ≥ parent) | `snap`, `msg`, `renderAll` / panel `#fT` change | **state**, **undo**, **DOM** |
| `toggleStar` [PUBLIC] | 84 | `(id: NodeId) → void` | Toggle ★ BMO flag | `snap`, `renderAll` / panel `#fStar` | **state**, **undo**, **DOM** |
| `setBranch` [PUBLIC] | 90 | `(id: NodeId, kind: ''\|'VH'\|'SM'\|'BO'\|'IT'\|'AC') → void` | Set branch mark (many boxes may share one kind) | `snap`, `renderAll` / panel `#fBr` change | **state**, **undo**, **DOM** |
| `hasStarBelow` | 96 | `(id: NodeId) → boolean` | Any ★ box strictly below `id`? (gates the "BMO below approves" checkbox) | rec. walk / `renderRolePalette` | pure |
| `isAncestor` | 109 | `(a: NodeId, b: NodeId) → boolean` | Is `a` an ancestor of `b`? | — / `toggleCollapse`, `pdDelegated` | pure |
| `toggleCollapse` [PUBLIC] | 114 | `(id: NodeId) → void` | Collapse/expand children; clears focus if it would hide it | `isAncestor`, `snap`, `renderAll`, `msg` / panel `#bClps`, node `+N` badge | **state**, **undo**, **DOM** |
| `setFocus` [PUBLIC] | 124 | `(id: NodeId) → void` | Focus a branch (auto-expands ancestors), scroll it into view | `snap`, `renderAll`, `scrollNodeIntoView` / panel `#bFocus` | **state**, **undo**, **DOM** |
| `clearFocus` [PUBLIC] | 132 | `() → void` | Unfocus, keep former focus box in view | `snap`, `renderAll`, `scrollNodeIntoView` / panel, `#bUnfocus` | **state**, **undo**, **DOM** |
| `scrollNodeIntoView` | 140 | `(id: NodeId) → void` | Center a box in the viewport (zoom-aware) | `layout`, `syncMiniView` / `setFocus`, `clearFocus` | **DOM** (scroll) |
| `select` [PUBLIC] | 152 | `(id: NodeId\|null, focusInput?: boolean) → void` | Select box. Delegates to `dSelect` in the doc module. Otherwise surgical path (patch classes) if box already on canvas — avoids hover "bounce"; full render for brand-new boxes | `applySelDom`, `renderPanel` **or** `renderAll` / node click, add*, canvas bg click | **state** (`sel`), **DOM** |
| `applySelDom` | 160 | `() → void` | Patch `.sel` class on canvas nodes + minimap rect strokes in place | — / `select` | **DOM** |
| `visibleSet` | 172 | `() → Set<NodeId>` | Boxes visible under focus ∩ collapse rules | rec. walks / `layout` | pure |
| `layout` | 196 | `(dim?: {bw,bh,gx,gy,pad,all}) → {vis:Set, row:Map, pos:Map, keys:[]}` | Pure layout: rows = (level, layer-k); pass1 assigns rank/layer, pass2 packs X by subtree, converts to units. `dim` overrides box size/gaps (doc module passes mm) and `all` ignores focus/collapse | inner `pass1` (1217), `pass2` (1234); `visibleSet`, `rnum` / `renderAll`, `refreshView`, `scrollNodeIntoView`, `tsv`, `copyTable`, `exportDrawio` | pure |
| `keyLabel` | 244 | `(kk: {r,k}) → string` | Row header label `T1` / `T1 (2)` | — / `buildGrid` | pure |
| `hcOf` | 250 | `(id: NodeId) → number` | Headcount roll-up: a leaf box is its own entered number (blank = 1); a box with children is 1 + Σ children | rec. / org panel, doc panel, `buildDocSvg` | pure |
| `setHc` [PUBLIC] | 255 | `(id: NodeId, v: string\|number) → void` | Set a leaf box's own headcount (blank clears) | `snap`, `refreshView` / panel `#fHc`, `#dfHc` | **state**, **undo**, **DOM** |

## `05-org-render.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `renderCanvas` | 4 | `(L: Layout) → void` | Full rebuild of chart canvas: sizes world, SVG elbow connectors, node divs (level color, ★, branch badge w/ color-clash invert, +N collapse badge), focus chip; then minimap | `applyZoomView`, `subCount`, `cellText`, `segLabel`, `renderMinimap`; wires node click/dblclick → `select`, badge → `toggleCollapse` / `renderAll`, `refreshView` | **DOM**, **state** (`worldW/H`) |
| `renderPanel` | 82 | `() → void` | Right panel: empty hint or full edit form (3 fields, level incl. ĐB, headcount, ★, branch, actions); wires all input/button handlers | `t`, `tf`, `rnum`, `segLabel`; handlers call `snap`, `setT`, `toggleStar`, `setBranch`, `toggleCollapse`, `setFocus`/`clearFocus`, `addChild`, `addSib`, `moveSib`, `delNode`, `refreshView` / `renderAll`, `select` | **DOM** |
| `paths` | 145 | `(vis: Set) → Node[][]` | All root→leaf visible paths (one table row each); inner `dfs` | rec. / `buildGrid` | pure |
| `buildGrid` | 157 | `(L: Layout) → {header:[], rows:[][]}` | Hierarchy table as a grid; `—` marks pass-through levels | `paths`, `keyLabel`, `cellText` / `renderTable`, `tsv` | pure |
| `renderTable` | 171 | `(L: Layout) → void` | Render hierarchy table with fixed-width colgroup | `buildGrid` / `renderAll`, `refreshView` | **DOM** |
| `renderAll` [PUBLIC] | 202 | `() → void` | **Master re-render**. Doc module active → `renderDocAll`. Otherwise layout once, then canvas, panel, table, vline tab, flow tab, rules tab; drops invalid `sel` | `layout`, `renderCanvas`, `renderPanel`, `renderTable`, `renderVline`, `renderVPanel`, `renderFlow`, `renderRules` / ~14 callers (all model mutations, undo, load, setLang, init) | **DOM**, **state** (`sel`) |
| `refreshView` | 208 | `() → void` | Light re-render while typing in the panel (canvas + table + debounced result); doc module → `renderDoc` | `layout`, `renderCanvas`, `renderTable`, `refreshFlowResultSoon` / panel field `oninput` | **DOM** |

## `06-export.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `q` | 6 | `(s: any) → string` | TSV cell for Excel: quotes tabs/newlines/quotes; prefixes `'` when the cell starts with `=`, `+`, `-`, `@` so spreadsheets treat it as text (formula-injection guard). Single choke point for every copy path | — / `tsv`, `flowTsv`, `#bCopyGrp`, `#bCopyFc` | pure |
| `tsv` | 11 | `() → string` | Hierarchy table as TSV | `buildGrid`, `layout`, `q` / `copyTable` | pure |
| `copyText` | 17 | `(txt: string, okMsg: string) → void` | Clipboard write with `execCommand` fallback (a `false` return counts as failure → blocked toast); inner `ok`, `fb` | `navigator.clipboard`, `msg` / `copyTable`, `copyFlowTable`, `#bCopyGrp`, `#bCopyFc` | **CB**, **DOM** (temp textarea) |
| `copyTable` [PUBLIC] | 32 | `() → void` | Copy hierarchy TSV with hidden-count note | `layout`, `tsv`, `copyText`, `tf` / `#bCopy` | **CB** |
| `dl` | 38 | `(blob: Blob, name: string) → void` | Trigger a browser download | — / `saveJSON`, `exportDrawio` | **DL** |
| `ser` | 43 | `(id: NodeId) → object` | Recursively serialize an org subtree (presentation fields only when set) | rec. / `serializeAll` | pure |
| `saveJSON` [PUBLIC] | 58 | `() → void` | Download `orgchart.json`; clears `dirty` | `serializeAll`, `dl`, `msg` / `#bSave` | **DL**, **state** |
| `applyState` | 63 | `(d: object) → void  (throws)` | Validate + load a whole document; migrates legacy shapes (`vh`→`br`, `ruleGrid`→`ruleGrids['']`, missing `cigs` → `defaultCigs()`, missing `doc` → defaults), regenerates broken ids, prunes orphan refs, validates presentation fields (`cleanWp`). Inner: `scan`, `genId`, `cleanWp`, `mk`, `cleanGrid`, `cleanFamily`, `vmk` | `rnum`, `seedRules` (legacy), `defaultCigs` / `undo`, `loadJSON` | **state** (replaces all) |
| `loadJSON` [PUBLIC] | 222 | `(file: File) → void` | Read file → parse → `applyState` → reset undo → render; error toasts keep current data; warns (instead of "opened") when the file's `v` is newer than `SCHEMA_V` | `applyState`, `renderAll`, `msg`, `tf` / `#fileIn` change | file **I/O** (read), **state**, **DOM** |
| `xesc` | 235 | `(s: any) → string` | XML-escape | — / `exportDrawio` | pure |
| `exportDrawio` [PUBLIC] | 239 | `() → void` | Build draw.io mxGraph XML of current view (positions, colors, custom attrs) and download | `layout`, `xesc`, `dl`, `msg` / `#bDrawio` | **DL** |

## `07-vline.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `vlayout` | 5 | `() → Map<VNodeId,{x,y}>` | Depth-based tidy tree layout (leaves packed L→R, parents centered); inner `walk` | rec. / `renderVline` | pure |
| `renderVline` | 22 | `() → void` | Full rebuild of vline canvas: connectors, node divs (cyan = manual global, paper = imported w/ ★ tag), refresh import picker | `vlayout`, `vdisp`, `fillVImportPick`; wires click → `vselect` / `renderAll`, `showTab`, v* mutations | **DOM** |
| `vselect` [PUBLIC] | 67 | `(id: VNodeId\|null) → void` | Surgical selection on vline canvas (patch classes only) + panel | `renderVPanel` / node click, bg click, v* mutations | **state** (`vsel`), **DOM** |
| `renderVPanel` | 74 | `() → void` | Vline right panel: empty hint or 3 fields (disabled when imported) + actions; wires handlers | `vdisp`; handlers → `snap`, `patchVNodeText`, `vAdd`, `vAddSib`, `vMove`, `vDel` / `vselect`, `renderAll`, `showTab` | **DOM** |
| `patchVNodeText` | 110 | `(n: VNode) → void` | Patch one vline box's text in place while typing (keeps input focus) | `vdisp` / `renderVPanel` field handlers | **DOM** |
| `vnn` | 120 | `(dept,title,person, orgId, parent) → VNodeId` | Create vnode in `vnodes` | — / `vAddRoot`, `vAdd`, `vAddSib`, `vImport` | **state** |
| `vAddRoot` [PUBLIC] | 126 | `() → void` | New manual global-person root | `snap`, `vnn`, `renderVline`, `vselect` / `#bVRoot` | **state**, **undo**, **DOM** |
| `vAdd` [PUBLIC] | 133 | `(pid) → void` | New manual child | same / vpanel `#vbChild` | **state**, **undo**, **DOM** |
| `vAddSib` [PUBLIC] | 140 | `(id) → void` | New manual sibling after `id` | same / vpanel `#vbSib` | **state**, **undo**, **DOM** |
| `vMove` [PUBLIC] | 149 | `(id, dir: ±1) → void` | Reorder among siblings | `snap`, `renderVline`, `vselect` / vpanel `◀▶` | **state**, **undo**, **DOM** |
| `vSubCount` | 158 | `(id) → number` | Subtree size | rec. / `vDel` confirm | pure |
| `vDel` [PUBLIC] | 162 | `(id) → void` | Delete vnode subtree (confirm if children); inner `rm` | `vdisp`, `snap`, `refreshFlowResultSoon` / vpanel `#vbDel` | **state**, **undo**, **DOM** |
| `fillVImportPick` | 179 | `() → void` | Import dropdown = ★ boxes not yet on the tree | `starredNodes`, `dispName` / `renderVline` | **DOM** |
| `vImport` [PUBLIC] | 195 | `() → void` | Import selected ★ box as child of `vsel` (guards: valid pick + parent selected) | `msg`, `snap`, `vnn`, `renderVline`, `vselect`, `refreshFlowResultSoon` / `#bVImport` | **state**, **undo**, **DOM** |
| `pruneVlineOrphans` | 205 | `() → void` | Remove imported vnodes whose org box was deleted; reattach their children to the grandparent | — / `delNode` | **state** |

## `08-flow.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `refreshFlowResultSoon` | 7 | `() → void (debounced 150 ms)` | Debounced `renderFlowResult` for typing paths | `debounce`, `renderFlowResult` / `refreshView`, row inputs, vline edits | **DOM** (delayed) |
| `starredNodes` | 9 | `() → Node[]` | All ★ boxes | — / group row, grp paste, `fillVImportPick` | pure |
| `roleById` | 14 | `(rid: string) → RoleBox\|pseudo\|null` | Resolve role-box id; `'vline'` returns the fixed pseudo box | — / `dropRole`, `resolveCell`, `chipEl` | pure |
| `roleBoxText` | 19 | `(rb) → string` | Full multi-line text of a role box (vline / node-linked / free) | `roleText`, `t` / `resolveCell`, `chipEl` title, `patchRoleChips` | pure |
| `rolePair` | 29 | `(rb) → {t, p}` | Title+person pair for chips/palette | `t` / `chipEl`, `patchRoleChips`, `renderRolePalette`, `roleBoxName` | pure |
| `roleBoxName` | 39 | `(rb) → string` | Short name (title part) | `rolePair` / palette, `deleteRole` confirm | pure |
| `segmentOf` | 41 | `(cb: Node\|null) → ScopeKey` | BMO's branch: nearest flagged ancestor's `br`, else `REST` | — / `flowBlocks` | pure |
| `pdDelegated` | 51 | `(rb, cb) → boolean` | "BMO below approves directly": node-linked box with `pdBelow` and cb in its subtree | `isAncestor` / `resolveCell` | pure |
| `resolveCell` | 56 | `(flow, col, seg, cb, grid) → string` | **Core resolution** of one result cell: fixed-BMO cell, `—`, VLINE lookup (`vlineSuperiorOf`), pd-delegation, or role-box text | `roleText`, `vlineSuperiorOf`, `vdisp`, `roleById`, `pdDelegated`, `roleBoxText`, `t` / `renderFlowResult`, `flowTsv` | pure |
| `renderFlow` | 78 | `() → void` | Rebuild whole Approval-Flow tab | `renderGroups`, `renderFcs`, `updateGroupCounts`, `renderFlowResult` / `renderAll`, `showTab` | **DOM** |
| `groupLabel` | 81 | `(g) → string` | `"CODE · Name"` label | `t` / options, result heads | pure |
| `groupOption` | 82 | `(g) → <option>` | Build an option element for a group | `groupLabel` / `fcRow`, `addGroup` | pure (creates el) |
| `fillGroupSelect` | 90 | `(sel: HTMLSelectElement, groupId: string\|null, full: boolean) → void` | Populate one FC row's group dropdown: compact (no-group + the chosen group only) by default, full list while focused — keeps the DOM at F + G options instead of F × G | `groupOption`, `t` / `fcRow` (+ its focus/mousedown/blur handlers), `delGroup` | **DOM** |
| `patchGroupOptionLabels` | 98 | `(g) → void` | Patch this group's label in every FC dropdown that currently holds it | `groupLabel` / group row inputs | **DOM** |
| `groupRow` | 104 | `(g) → <tr>` | One group row: code/name inputs, BMO select (★ boxes), FC count, per-CIG toggle, delete; wires all handlers | `starredNodes`, `dispName`; handlers → `snap`, `patchGroupOptionLabels`, `refreshFlowResultSoon`, `renderFlowResult`, `delGroup` / `renderGroups`, `addGroup` | pure (creates el; handlers mutate) |
| `renderGroups` | 160 | `() → void` | Rebuild groups table (or empty hint) | `groupRow`, `applyGrpFilter` / `renderFlow`, pastes, `delGroup` (empty) | **DOM** |
| `addGroup` [PUBLIC] | 169 | `() → void` | Append one group row (FC dropdowns pick it up lazily on focus — no per-row injection) | `snap`, `groupRow`, `updateGroupCounts`, `renderFlowResult` / `#bAddGrp` | **state**, **undo**, **DOM** |
| `delGroup` | 178 | `(g, rowEl) → void` | Delete group; detach its FCs and reset their dropdowns to "no group" | `snap`, `fillGroupSelect`, `renderGroups`, `updateGroupCounts`, `renderFlowResult` / row ✕ | **state**, **undo**, **DOM** |
| `applyGrpFilter` [PUBLIC] | 190 | `() → void` | Show/hide group rows by filter text (id → group `Map` built once) | — / `#grpFilter` input, `renderGroups` | **DOM** |
| `updateGroupCounts` | 200 | `() → void` | Refresh per-group FC counts + card counters | — / many mutation paths | **DOM** |
| `fcRow` | 212 | `(f) → <tr>` | One FC row (code/name inputs, compact group select that expands on focus/mousedown and compacts on blur, delete) with handlers | `fillGroupSelect`; handlers → `snap`, `refreshFlowResultSoon`, `updateGroupCounts`, `renderFlowResult` / `renderFcs`, `addFc` | pure (creates el) |
| `renderFcs` | 237 | `() → void` | Rebuild FC table | `fcRow`, `applyFcFilter` / `renderFlow`, pastes | **DOM** |
| `addFc` [PUBLIC] | 242 | `() → void` | Append one FC row | `snap`, `fcRow`, `updateGroupCounts`, `applyFcFilter`, `renderFlowResult` / `#bAddFc` | **state**, **undo**, **DOM** |
| `applyFcFilter` [PUBLIC] | 251 | `() → void` | Show/hide FC rows by filter (matches code/name/group name); id → FC `Map` built once, so filtering is linear | — / `#fcFilter` input, `renderFcs` | **DOM** |
| `isHeaderRow` | 266 | `(line: string) → boolean` | Is a pasted TSV line a header row? True when the first cell equals one of the header labels the Copy buttons emit (both locales) or is a bare `Mã`/`Ma`/`Code`/`FC`/`FCG`; never for real codes like `FCG01` (no `\b` after non-ASCII letters) | `STR` / `importGrpPaste`, `importPaste` | pure |
| `importGrpPaste` [PUBLIC] | 276 | `(txt: string) → void` | Paste FCG TSV (code⇥name⇥BMO person). Header row skipped via `isHeaderRow`; matches BMO by ★ person name; same code ⇒ update in place | `isHeaderRow`, `msg`, `snap`, `starredNodes`, `renderGroups`, `renderFcs`, `updateGroupCounts`, `renderFlowResult`, `tf` / `#bPasteGrpGo` | **state**, **undo**, **DOM** |
| `importPaste` [PUBLIC] | 311 | `(txt: string) → void` | Paste FC TSV (code⇥name⇥group name); header row skipped via `isHeaderRow`; creates unknown groups, matches by name case-insensitively | `isHeaderRow`, same pattern as above / `#bPasteGo` | **state**, **undo**, **DOM** |
| `cbqlnsOf` | 341 | `(g) → Node\|null` | The group's BMO node (must exist in `nodes`) | — / `flowBlocks`, copy-group | pure |
| `flowBlocks` | 346 | `() → Block[]` | Result blocks: per group (default) or per FC; per-CIG splitting duplicates a block per CIG with that CIG's grid. Builds one index per view (FC codes by group / group by id) instead of rescanning arrays per row. Inner `segLine`, `pushSplit` | `cbqlnsOf`, `segmentOf`, `segLabel`, `groupLabel`, `gridFor`, `dispName`, `t` / `renderFlowResult`, `flowTsv` | pure |
| `renderFlowResult` | 388 | `() → void` | Rebuild result table: %-width colgroup, sticky header, one 5-flow block per entry (rows carry `data-blk`/`data-hay` for filtering), unassigned-FC notice; re-applies filter | `flowBlocks`, `resolveCell`, `flowLabel`, `colLabel`, `applyResFilter` / **~18 callers** | **DOM** |
| `applyResFilter` [PUBLIC] | 458 | `() → void` | Hide/show whole result blocks by search text | — / `#resFilter` input, `renderFlowResult` | **DOM** |
| `flowTsv` | 465 | `() → string` | Result table as TSV (same labels as UI) | `flowBlocks`, `resolveCell`, `flowLabel`, `colLabel`, `q` / `copyFlowTable` | pure |
| `copyFlowTable` [PUBLIC] | 478 | `() → void` | Copy result TSV | `flowTsv`, `copyText`, `tf` / `#bCopyFlow` | **CB** |

## `09-rules.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `usageCount` | 4 | `(rid) → number` | Count assignments of a role box across **both** grid families and all scenarios | — / palette tags, `deleteRole` | pure |
| `dropRole` [PUBLIC] | 20 | `(flow, col, rid) → void` | Drop a box into a cell. Vline mode: replace cell (`{ALL:rid}`). Flow mode: fill first free scope, else replace with All | `roleById`, `snap`, `curGrid`, `renderRules`, `renderFlowResult`, `msg` / cell `ondrop` | **state**, **undo**, **DOM** |
| `cycleScope` [PUBLIC] | 37 | `(flow, col, scope) → void` | Cycle a chip's scope All→VH→SM→BO→IT→AC→REST, skipping occupied scopes | `snap`, `curGrid`, `renderRules`, `renderFlowResult` / chip scope tag click | **state**, **undo**, **DOM** |
| `removeAssign` [PUBLIC] | 52 | `(flow, col, scope) → void` | Remove one assignment; drop empty cell object | `snap`, `curGrid`, renders / chip ✕ | **state**, **undo**, **DOM** |
| `addFreeRole` [PUBLIC] | 59 | `() → void` | New empty custom role box, focus its input | `snap`, `renderRules` / `#bAddFreeRole` | **state**, **undo**, **DOM** |
| `addNodeRole` [PUBLIC] | 66 | `() → void` | Add chart-linked role box from picker (dupe-guarded) | `msg`, `snap`, `renderRules` / `#bAddNodeRole` | **state**, **undo**, **DOM** |
| `deleteRole` [PUBLIC] | 76 | `(rb) → void` | Delete role box (+confirm if used) and scrub it from every grid in both families | `usageCount`, `roleBoxName`, `snap`, `scrubRole`, renders / palette ✕ | **state**, **undo**, **DOM** |
| `scrubRole` | 85 | `(rid: string) → number` | Remove every assignment of a role box across both grid families and all scenarios, dropping emptied cells; returns how many were removed | — / `deleteRole`, `pruneNodeRoles` | **state** |
| `pruneNodeRoles` | 104 | `() → {boxes:number, cells:number}` | Drop node-linked role boxes whose chart box no longer exists, plus their cells — keeps in-session state identical to what `applyState` would load back | `scrubRole` / `delNode` | **state** |
| `patchRoleChips` | 114 | `(rb) → void` | Patch all matrix chips for a box while typing (keeps input focus) | `rolePair`, `roleBoxText` / palette input handlers | **DOM** |
| `chipEl` | 126 | `(flow, col, scope, rid) → <div>` | Build one matrix chip (scope tag hidden in vline mode; VLINE chip tinted) | `roleById`, `rolePair`, `segLabel`, `roleBoxText`; wires `cycleScope`, `removeAssign` / `renderRules` | pure (creates el) |
| `cigById` | 149 | `(id) → Cig\|null` | Lookup CIG | — / toggle, `setCurCig` | pure |
| `setCurCig` [PUBLIC] | 150 | `(id: string) → void` | Switch editing scenario; clone Common into a CIG on first open (per current mode's family) | `cigById`, `gridFamily`, `snap`, `renderRules` / toggle buttons | **state**, **undo**, **DOM** |
| `setRuleMode` [PUBLIC] | 161 | `(m: 'flow'\|'vline') → void` | Switch resolve-by mode | `snap`, `renderRules`, `renderFlowResult` / `#modeFlow`, `#modeVline` | **state**, **undo**, **DOM** |
| `renderModeToggle` | 167 | `() → void` | Patch mode buttons' active state + note | `t` / `renderRules` | **DOM** |
| `renderCigToggle` | 177 | `(rebuild?: boolean) → void` | Scenario buttons; rebuilds only when CIG list changed, otherwise patches labels/active in place (prevents pressed-button "bounce"); "own rules" note reads the current mode's family | `cigById`, `gridFamily`, `setCurCig` (wire), `tf` / `renderRules`, `renderCigs` input, `addCig` | **DOM** |
| `renderCigs` | 204 | `() → void` | CIG table (code/name inputs + delete) with handlers; delete drops the CIG's grid from **both** families | handlers → `snap`, `renderCigToggle`, `refreshFlowResultSoon`, delete → renders / `renderRules` | **DOM** |
| `addCig` [PUBLIC] | 232 | `() → void` | Append CIG, focus its code input | `snap`, `renderCigs`, `renderCigToggle(true)` / `#bAddCig` | **state**, **undo**, **DOM** |
| `renderRules` | 240 | `() → void` | Rebuild rules matrix for current mode+scenario: mode/CIG toggles, 5 flow rows × 6 cols (locked BMO cells, chips, drop targets), palette, picker | `renderModeToggle`, `renderCigToggle`, `renderCigs`, `flowLabel`, `chipEl`, `curGrid`, `dropRole` (wire), `renderRolePalette`, `fillRolePick` / **~14 callers** | **DOM** |
| `renderRolePalette` | 281 | `() → void` | Palette: fixed VLINE card (vline mode only, undeletable, draggable), then user boxes (drag, usage tag, delete, editable fields, pd-below checkbox when ★ below) | `usageCount`, `roleBoxName`, `rolePair`, `hasStarBelow`, `tf`; wires drag + `deleteRole` + `patchRoleChips` | **DOM** |
| `fillRolePick` | 366 | `() → void` | "From chart" picker: all org boxes sorted by name | `dispName` / `renderRules` | **DOM** |

## `10-zoom.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `applyZoomView` | 5 | `() → void` | Apply current zoom: sizer = world×zoom, canvas `scale()`, % label | — / `renderCanvas`, `fitZoom`, `zoomStep` | **DOM** |
| `clampZoom` | 11 | `(z) → number` | Clamp to [0.2, 2] | — / zoom fns | pure |
| `fitZoom` [PUBLIC] | 12 | `() → void` | Fit whole chart in viewport (instant; cancels pending animation) | `clampZoom`, `applyZoomView`, `syncMiniView` / `#bZoomFit` | **state**, **DOM** |
| `animateZoomTo` [PUBLIC] | 25 | `(nz, ax?, ay?) → void` | Set animation target (anchor-preserving); starts rAF loop if idle | `clampZoom` / wheel handler, `#bZoomIn/Out/Reset` | **state** (`zoomAnim`) |
| `zoomStep` | 35 | `() → void` | One animation frame: ease 30% toward target, keep anchor, loop until <0.0015 | `applyZoomView`, `syncMiniView`, rAF / `animateZoomTo` | **state**, **DOM** |
| `renderMinimap` | 52 | `(L: Layout) → void` | Minimap snapshot: box sizes itself to chart aspect within 200×150 budget; one rect per visible node | `syncMiniView` / `renderCanvas` | **DOM**, **state** (`miniScale`) |
| `syncMiniView` | 79 | `() → void` | Position viewport rectangle; auto-hide minimap when whole chart fits | — / scroll listener, zoom fns, `scrollNodeIntoView`, minimap drag | **DOM** |

Also: an IIFE wiring pointer-capture drag on the minimap (click/drag → centre viewport).

## `11-doc.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `docPageSize` | 30 | `() → {w,h}` | Page size in mm from `doc.page` + `doc.orient` | — / doc renderer, zoom, print, PDF | pure |
| `docColors` | 34 | `() → object` | Level → fill colour for the active scheme (`TCOLOR` pastel or `TCOLOR_CLASSIC`) | — / `buildDocSvg` | pure |
| `docFont` | 35 | `() → {css,pdf}` | Font entry for `doc.font` (CSS stack for screen, embedded family name for PDF) | — / `buildDocSvg`, `docPdf` | pure |
| `docLevelName` | 36 | `(L: LevelKey) → string` | Legend label: ĐB/CC translated, T1… as is | `t` / `buildDocSvg` | pure |
| `rowPitch` | 37 | `() → number` | Row pitch in mm = fixed box height + row gap | — / layout, drag | pure |
| `textW` | 41 | `(str, size, weight, style, fam) → number` | Measure text width in mm with a canvas 2D context | — / `fitText`, `wrapText`, `buildDocSvg`, `svText` | pure (cached ctx) |
| `wrapText` | 47 | `(str, maxW, size, weight, style, fam) → string[]` | Word-wrap (breaking over-long words by character), keeping user line breaks | `textW` / `buildDocSvg` (descriptions) | pure |
| `fitLines` | 68 | `(str, maxW, size, minSize, maxLines, weight, style, fam) → {lines,size}` | Wrap; if more than `maxLines` shrink the font step-wise down to `minSize`; at the minimum keep wrapping (extra lines) — text is never truncated | `wrapText` / `boxContent` | pure |
| `boxContent` | 78 | `(n: Node, fam, W) → {dept,title,person,contentH,scale}` | Text blocks of one box inside the fixed height: dept ≤2 lines then shrink; title (+ level unless `hideLv`) 1 line then shrink; person = every entered line wrapped; if the total still overflows, all three blocks shrink together (down to 50 %) — the box never grows | `fitLines`, `wrapText` / `docLayout` | pure |
| `sv` | 95 | `(name, attrs?, parent?) → SVGElement` | Create an SVG element with attributes, optionally appended | — / doc renderer | pure (creates el) |
| `svText` | 102 | `(parent, x, y, str, o) → SVGTextElement` | SVG `<text>` with size/weight/style/anchor; underline drawn as a real `<line>` (svg2pdf ignores `text-decoration`) | `sv`, `textW` / `buildDocSvg` | pure (creates el) |
| `docLayout` | 119 | `(fam) → {pos,box,rowBase,maxRow}` | Shelf layout: every box has the same height and sits on an integer row (child = parent + 1; stacked siblings on consecutive rows; `rowShift` pushes a box and everything below it down). Columns from a memoised tidy tree: spread children side by side, `stack` children in one column (leftmost when spread siblings exist, hanging under the parent otherwise). Inner `assignRows`, `measure`, `place` | — / `buildDocSvg` | pure |
| `docEdges` | 166 | `(id, pos) → {pts,arrow}[]` | Connectors of one parent: straight drop for a single centred child, else a vertical from the parent down to a bus placed just above the topmost child row (so pushed-down rows never drag the bus through the header blocks) + drops; stacked column fed by a vertical spine (from the bus, or from the parent's left edge when it has no spread children) with an arrowed stub into each box | — / `buildDocSvg`, tests | pure |
| `buildDocSvg` | 202 | `(forExport: boolean) → SVGSVGElement` | **Core of the module**: build the page in mm — header, document-code block, notes, legend, optional fixed-size SVG logo top-left, chart placed right under the header and pushed down only when a row would touch those blocks, fit-to-page (width only when `autoH`), page height grown to the content when `autoH`, row guides while dragging, connectors with arrowheads, boxes (centred text, badge, headcount), description blocks | `docPageSize`, `docFont`, `docColors`, `docLayout`, `docEdges`, `hcOf`, `sv`, `svText`, `wrapText` / `renderDoc`, `docPdf` | pure (creates DOM), **state** (`docView`) |
| `docLogoSvg` | 376 | `(code: string) → {el,ratio}|null` | Parse pasted SVG for the logo: reject non-SVG, strip script/foreignObject/event handlers/javascript: hrefs, inline class-based fill/stroke from <style> (svg2pdf ignores <style>), normalise viewBox; returns the element and its aspect ratio | `DOMParser` / `buildDocSvg`, `renderDPage` | pure (creates DOM) |
| `renderDoc` | 408 | `() → void` | Render the page SVG into `#docPage` at the current screen zoom; update zoom label | `buildDocSvg` / `renderDocAll`, `dSelect`, `dZoomTo`, panel inputs, drags | **DOM** |
| `renderDocAll` [PUBLIC] | 414 | `() → void` | Full module render: page + Box panel + Page panel (what `renderAll` calls when the doc module is active) | `renderDoc`, `renderDPanel`, `renderDPage` / `renderAll`, `showModule` | **DOM** |
| `dSelect` | 416 | `(id, focusInput?) → void` | Selection inside the doc module (`select()` delegates here when `MOD === 'doc'`) | `renderDoc`, `renderDPanel` / `select` | **state** (`sel`), **DOM** |
| `applyDZoom` | 422 | `() → void` | Apply screen zoom by resizing the page SVG to the real page size (may exceed the paper when `autoH`); update the % label | — / `renderDoc`, `dZoomTo`, `dZoomStep` | **DOM** |
| `clampDZoom` | 427 | `(z) → number` | Clamp page zoom to [0.15, 4] | — / zoom fns | pure |
| `dZoomTo` [PUBLIC] | 428 | `(z) → void` | Instant page zoom (cancels a running animation) | `clampDZoom`, `applyDZoom` / `dZoomFit`, tests | **state** (`dzoom`), **DOM** |
| `dZoomFit` [PUBLIC] | 429 | `() → void` | Fit the whole page (real height) into the viewport | `dZoomTo` / `#bDZoomFit`, first open | **state**, **DOM** |
| `dAnimateZoomTo` [PUBLIC] | 435 | `(nz, ax?, ay?) → void` | Smooth page zoom around a viewport point (same eased, target-accumulating scheme as the org tab) | `clampDZoom` / wheel on `#docWrap`, zoom buttons | **state** (`dzoomAnim`) |
| `dZoomStep` | 443 | `() → void` | One animation frame: ease 30 % toward the target, keep the anchor point fixed, loop until done | `applyDZoom`, rAF / `dAnimateZoomTo` | **state**, **DOM** |
| `setRowShift` [PUBLIC] | 455 | `(id, v) → void` | Set how many extra rows a box is pushed down (≥ 0); boxes below follow | `snap`, `renderDoc`, `renderDPanel` / ▲▼ buttons, tests | **state**, **undo**, **DOM** |
| `renderDPanel` | 460 | `() → void` | Box panel: dept/title (+ show-level toggle), multi-line person, level, headcount, annotation-key dropdown, stack toggle, ▲▼ row buttons, description, add/reorder/delete | `hcOf`, `xesc`; handlers → `snap`, `setT`, `setHc`, `setRowShift`, `addChild`, `addSib`, `moveSib`, `delNode`, `renderDoc` / `renderDocAll`, `dSelect`, `endRowDrag`, notes editor | **DOM** |
| `docSet` | 518 | `(key, fn) → void` | Apply a page-setting change: undo snapshot (coalesced per key) + mutate + re-render page | `snap`, `renderDoc` / Page panel inputs | **state**, **undo**, **DOM** |
| `renderDPage` | 519 | `() → void` | Page panel: paper (A4/A3/A2), orientation, auto page height, font, scheme, header, SVG logo (pasted code), document-code fields, notes editor, show/hide toggles | `docSet`, `docLogoSvg`, `renderDNotes`, `msg` / `renderDocAll` | **DOM** |
| `renderDNotes` | 574 | `() → void` | Notes list rows (key + text + delete) inside the Page panel | `docSet`, `snap`, `renderDoc` / `renderDPage`, add/delete note | **DOM** |
| `startRowDrag` | 589 | `(id, e) → Drag` | Begin a vertical drag of a box between rows | — / doc pointerdown | pure |
| `moveRowDrag` | 593 | `(d, e) → void` | Drag step: pointer y → target row (never above the natural row) → `rowShift`; first real move takes the undo snapshot and turns on the row guides | `rowPitch`, `snap`, `renderDoc` / doc pointermove | **state**, **undo**, **DOM** |
| `endRowDrag` | 602 | `(d) → void` | Finish a row drag: hide guides, refresh page + panel | `renderDoc`, `renderDPanel` / doc pointerup | **state**, **DOM** |
| `docPrint` [PUBLIC] | 609 | `() → void` | Write `@page{size}` for the paper width × real page height into `#printPage` and open the print dialog | `docPageSize` / `#bPrint` | **DOM**, print dialog |
| `loadScript` | 617 | `(src) → Promise` | Inject a `<script>` and resolve on load | — / `loadPdfLibs` | **DOM** |
| `loadPdfLibs` | 623 | `() → Promise` | Lazy-load vendored jsPDF + svg2pdf once | `loadScript` / `docPdf` | **DOM** |
| `bufToB64` | 627 | `(buf: ArrayBuffer) → string` | Base64-encode a font file for jsPDF's virtual FS | — / `loadPdfFont` | pure |
| `loadPdfFont` | 633 | `(famName) → Promise<{file,style,b64}[]>` | Fetch the 4 Liberation TTF styles for a family once (Vietnamese glyphs; metric-compatible with Arial / Times New Roman) | `fetch`, `bufToB64` / `docPdf` | network |
| `docPdf` [PUBLIC] | 641 | `() → Promise` | Download the page as a vector PDF at the real page size: register embedded fonts, build an export SVG (family = embedded font), render with svg2pdf, save | `loadPdfLibs`, `loadPdfFont`, `buildDocSvg`, `msg` / `#bPdf` | **DOM**, **DL** |

## `12-wiring.js`

| Function | Line | Signature | Purpose | Calls / Called by | Side effects |
|---|---|---|---|---|---|
| `showTab` [PUBLIC] | 56 | `(which: 'org'\|'vline'\|'rules'\|'flow') → void` | Switch visible tab of the flow module (+ remember `curTab`), set active button; re-render target tab | `renderVline`, `renderVPanel`, `renderRules`, `renderFlow` / 4 tab buttons | **DOM** |
| `wireCollapse` | 113 | `(btnId, bodyId, secId?, startOpen?) → void` | Generic section collapse toggle (▴/▸ + `.collapsed` class); inner `apply`. Used for result card, CIG card (starts collapsed), palette card | — / init (3 calls) | **DOM** |
| `refreshStateLabels` | 133 | `() → void` | Re-derive all state-dependent button labels (i18n-safe) | `t` / toggles, `applyStatic`, `applyTblCollapsed` | **DOM** |
| `applyTblCollapsed` | 226 | `() → void` | Apply hierarchy-table collapsed state (defaults collapsed) | `refreshStateLabels` / `#bTgl`, init | **DOM** |
| `showModule` [PUBLIC] | 236 | `(m: 'landing'\|'flow'\|'doc') → void` | Switch top-level module: show landing / flow tabs / doc page, render the target, keep `location.hash` in sync | `renderAll`, `showTab`, `renderDocAll`, `dZoomFit` / landing cards, `#bHome`, hashchange, init | **state** (`MOD`), **DOM** |
| `moduleFromHash` | 247 | `() → string` | Module named by `location.hash` (`#doc` / `#flow`), else landing | — / init, hashchange | pure |

Also: pan IIFEs for the org and vertical-line canvases (drag-to-pan, wheel → `animateZoomTo`), the doc-page pointer IIFE (row drag, background pan, wheel → `dAnimateZoomTo`), the global Ctrl+Z listener (skipped inside textareas), ~40 direct button handlers (tabs, zoom, save/open, copy, paste boxes, module cards), `onbeforeunload` (warns whenever `dirty`), and the init sequence `seedRules(); applyStatic(); applyTblCollapsed(); renderAll(); showModule(moduleFromHash());`.

---

## Notes & cleanup log

The first pass of this inventory (commit `fe0ad60`) flagged the items below; all of them were cleaned up in the follow-up commit, so the tables above describe the code **after** cleanup.

| Finding | Resolution |
|---|---|
| Dead `applyZoom()` — instant-zoom API left over from before the smooth-zoom refactor; no caller inside the app | **Deleted.** Wheel and all zoom buttons go through `animateZoomTo`; `fitZoom` has its own body. |
| `copyText(t, okMsg)` — parameter `t` shadowed the i18n function `t()`, so the double-fallback path (`msg(t('msgCopyBlocked'))`) would throw instead of showing the toast | **Fixed.** Parameter renamed to `txt`; verified with a Playwright test that stubs out both `navigator.clipboard` and `execCommand`. |
| Dead i18n key `cbqlnsFull` (both locales, no call site) | **Removed** from `STR.vi` and `STR.en`. |
| Stale comments: JS table of contents said "v5" and omitted sections [1b]/[7v]/[8f]; `cbqlnsOf` mentioned the removed off-chart-BMO feature; `seedRules` claimed to seed a standard matrix; `ckPdBelow` was filed under an "off-chart BMO" comment | **Rewritten** to match current behaviour. |
| Un-i18n'd literals: `Focus:` in `#focusChip` and the `Fund Center` card header | **Keyed** as `focusLbl` / `fcH` (both wrapped in `<span data-i18n>` so `applyStatic` no longer risks clobbering sibling elements). |

### Code-review fixes (second follow-up commit)

| Finding (external review) | Resolution |
|---|---|
| Excel header row "Mã FCG" imported as a real group — `\b` after `ã` never matches in JS, so the Copy → paste round-trip of the app's own output was broken | **Fixed.** New shared `isHeaderRow()` compares the first cell with the exact header labels the Copy buttons emit (both locales) plus bare generic words; both importers use it. |
| Deleting every CIG did not survive save/reload (`cigs: []` was treated like a legacy file) | **Fixed.** `applyState` keys off the presence of the `cigs` array; defaults come from the new `defaultCigs()` (also removes the duplicated literal). |
| CIG delete and the "has its own rules" note only looked at `ruleGrids`, leaving orphan `vlineGrids` entries and a wrong note in Vertical-line mode | **Fixed.** Both families are cleared on delete; the note reads `gridFamily()`. |
| Role boxes linked to a deleted chart box survived in-session but vanished silently on reload | **Fixed.** `delNode` now prunes them immediately via `pruneNodeRoles()` (+ their cells, via the shared `scrubRole()`) and shows a toast with counts; Ctrl+Z restores everything. |
| `execCommand('copy')` returns `false` instead of throwing → false "copied" toast | **Fixed** in `copyText`. |
| Global Ctrl+Z hijacked native undo inside the paste textareas | **Fixed.** Handler ignores events whose target is a `<textarea>`. |
| `.over` highlight flickered when dragging across chips inside a cell (`dragleave` on child entry) | **Fixed.** `body.rdrag` is set during a palette drag and the CSS gives slot children `pointer-events:none` for its duration. |
| Header said version 10 while JSON wrote `v:9` and `applyState` never read `d.v` | **Fixed.** `SCHEMA_V = 10` is written by `serializeAll`; `loadJSON` warns when a file is newer. |
| Parameters named `t` in `nn`/`rnum`/`msg`/`debounce` shadowed the i18n helper (same bug class as `copyText`) | **Renamed** (`lv`, `s`, `tm`). The i18n helper keeps its name; the node field `n.t` stays for file-format stability. |
| Stale comments/hints (duplicate "TAB 3", `[8a]` branch list, "Tài chính", static fallback hints behind `STR`) | **Refreshed**; static hints now carry a comment that `applyStatic` overwrites them. |

### Second external review (third follow-up commit)

| Finding | Verdict | Resolution |
|---|---|---|
| "Legacy JSON migration silently drops rules" (`ruleGrid` present but `roleBoxes` absent) | **Not a bug** — both keys were introduced in the same commit (`db8f708`, v6); no shipped version ever wrote one without the other. v5 files carried no user-defined rules. | No change. |
| `onbeforeunload` only warned when the chart had boxes, so unsaved FCs/rules with an empty chart were lost silently | Real, minor | **Fixed** — warns on `dirty` alone. |
| FC table quadratic: every row's group `<select>` held every group (F × G options), plus `find`/`filter` inside loops | Real — measured 2.4 s render / 0.3 s per filter keystroke at 2,000 FC × 50 groups | **Fixed** — `fillGroupSelect` keeps dropdowns compact until focused; `Map` indexes in the filters and `flowBlocks`. After: 0.42 s / 11 ms at the same size; 5,000 × 300 went from 31 s to 0.97 s. |
| TSV export lets cells starting with `=`/`+`/`-`/`@` reach Excel as formulas | Real class, low risk here | **Fixed** in `q()`, the single choke point for all four copy paths. |

Remaining observation (not a defect): `debounce` has exactly one consumer (`refreshFlowResultSoon`).

### Restructure + chart-layout module (v11)

| Change | Notes |
|---|---|
| Single file → `css/app.css` + 12 `js/` section files | Pure slicing of the old sections in load order; state stays global, no behaviour change (56 existing checks pass over HTTP). |
| Playwright suites moved into `tests/` | `npm test` runs a static server + Chromium; `PW_MODULE`/`PW_CHROMIUM` point at a pre-installed Playwright. |
| Level `ĐB` above `CC`; `LMAX` replaces hard-coded `8` | Root default stays CC; old files load unchanged. |
| Headcount (`hc`) with roll-up (`hcOf`) | Editable in both modules; parents show the computed sum. |
| Schema v11: node presentation fields (`hc`, `annot`, `desc`, `dx`, `wp`) + `doc` layer | Validated on load; absent → blank/defaults, so the flow module never depends on them. |
| Landing page + `MOD` dispatch in `renderAll` / `select` / `refreshView` | One tree, two modules; the org-tree mutators are shared unchanged. |
| Chart-layout module (`11-doc.js`) | SVG page in mm; header / document-code block / notes / legend / badges / headcount / descriptions; drag boxes within their row; bend connectors; print via `@page`; vector PDF via jsPDF + svg2pdf with embedded Liberation fonts. |

*Every table above is generated from the current source; each row's line number is verified to start the named function.*

### Restructure + chart-layout module (v11)

| Change | Notes |
|---|---|
| Single file → `css/app.css` + 12 `js/` section files | Pure slicing of the old sections in load order; state stays global, no behaviour change (56 existing checks pass over HTTP). |
| Playwright suites moved into `tests/` | `npm test` runs a static server + Chromium; `PW_MODULE`/`PW_CHROMIUM` point at a pre-installed Playwright. |
| Level `ĐB` above `CC`; `LMAX` replaces hard-coded `8` | Root default stays CC; old files load unchanged. |
| Headcount (`hc`) with roll-up (`hcOf`) | Editable in both modules; parents show the computed sum. |
| Schema v11: node presentation fields (`hc`, `annot`, `desc`, `dx`, `wp`) + `doc` layer | Validated on load; absent → blank/defaults, so the flow module never depends on them. |
| Landing page + `MOD` dispatch in `renderAll` / `select` / `refreshView` | One tree, two modules; the org-tree mutators are shared unchanged. |
| Chart-layout module (`11-doc.js`) | SVG page in mm; header / document-code block / notes / legend / badges / headcount / descriptions; drag boxes within their row; bend connectors; print via `@page`; vector PDF via jsPDF + svg2pdf with embedded Liberation fonts. |

*Every table above is generated from the current source; each row's line number is verified to start the named function.*

### Restructure + chart-layout module (v11)

| Change | Notes |
|---|---|
| Single file → `css/app.css` + 12 `js/` section files | Pure slicing of the old sections in load order; state stays global, no behaviour change (56 existing checks pass over HTTP). |
| Playwright suites moved into `tests/` | `npm test` runs a static server + Chromium; `PW_MODULE`/`PW_CHROMIUM` point at a pre-installed Playwright. |
| Level `ĐB` above `CC`; `LMAX` replaces hard-coded `8` | Root default stays CC; old files load unchanged. |
| Headcount (`hc`) with roll-up (`hcOf`) | Editable in both modules; parents show the computed sum. |
| Schema v11: node presentation fields (`hc`, `annot`, `desc`, `dx`, `wp`) + `doc` layer | Validated on load; absent → blank/defaults, so the flow module never depends on them. |
| Landing page + `MOD` dispatch in `renderAll` / `select` / `refreshView` | One tree, two modules; the org-tree mutators are shared unchanged. |
| Chart-layout module (`11-doc.js`) | SVG page in mm; header / document-code block / notes / legend / badges / headcount / descriptions; drag boxes within their row; two connector styles (spread / stacked group); smooth zoom + pan; print via `@page`; vector PDF via jsPDF + svg2pdf with embedded Liberation fonts. |

*Every table above is generated from the current source; each row's line number is verified to start the named function.*

### Restructure + chart-layout module (v11)

| Change | Notes |
|---|---|
| Single file → `css/app.css` + 12 `js/` section files | Pure slicing of the old sections in load order; state stays global, no behaviour change (56 existing checks pass over HTTP). |
| Playwright suites moved into `tests/` | `npm test` runs a static server + Chromium; `PW_MODULE`/`PW_CHROMIUM` point at a pre-installed Playwright. |
| Level `ĐB` above `CC`; `LMAX` replaces hard-coded `8` | Root default stays CC; old files load unchanged. |
| Headcount (`hc`) with roll-up (`hcOf`) | Editable in both modules; parents show the computed sum. |
| Schema v11: node presentation fields (`hc`, `annot`, `desc`, `dx`, `wp`) + `doc` layer | Validated on load; absent → blank/defaults, so the flow module never depends on them. |
| Landing page + `MOD` dispatch in `renderAll` / `select` / `refreshView` | One tree, two modules; the org-tree mutators are shared unchanged. |
| Chart-layout module (`11-doc.js`) | SVG page in mm; header / document-code block / notes / legend / badges / headcount / descriptions; shelf rows with drag-to-reorder + guides; fixed box height with shrinking text; two connector styles (spread / stacked group); universal box width; auto page height; smooth zoom + pan; print via `@page`; vector PDF via jsPDF + svg2pdf with embedded Liberation fonts. |

*Every table above is generated from the current source; each row's line number is verified to start the named function.*

### Restructure + chart-layout module (v11)

| Change | Notes |
|---|---|
| Single file → `css/app.css` + 12 `js/` section files | Pure slicing of the old sections in load order; state stays global, no behaviour change (56 existing checks pass over HTTP). |
| Playwright suites moved into `tests/` | `npm test` runs a static server + Chromium; `PW_MODULE`/`PW_CHROMIUM` point at a pre-installed Playwright. |
| Level `ĐB` above `CC`; `LMAX` replaces hard-coded `8` | Root default stays CC; old files load unchanged. |
| Headcount (`hc`) with roll-up (`hcOf`) | Editable in both modules; parents show the computed sum. |
| Schema v11: node presentation fields (`hc`, `annot`, `desc`, `dx`, `wp`) + `doc` layer | Validated on load; absent → blank/defaults, so the flow module never depends on them. |
| Landing page + `MOD` dispatch in `renderAll` / `select` / `refreshView` | One tree, two modules; the org-tree mutators are shared unchanged. |
| Chart-layout module (`11-doc.js`) | SVG page in mm; header / document-code block / notes / legend / badges / headcount / descriptions; shelf rows with drag-to-reorder + guides; fixed box height with shrinking text; two connector styles (spread / stacked group); SVG logo; auto page height; smooth zoom + pan; print via `@page`; vector PDF via jsPDF + svg2pdf with embedded Liberation fonts. |

*Every table above is generated from the current source; each row's line number is verified to start the named function.*
