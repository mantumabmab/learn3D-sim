# Module: 3D figures

**When this module runs:** whenever the confirmed plan includes figures: the person asked for 3D, a model,
interactive or visual, or the topic passes the test below and the person did not say "text only". A figure is the
most expensive part of a set of notes, so each one must earn its place: after playing with it, the learner can
predict something they couldn't predict from the text alone. Budget per level: 1-2 figures at levels 1-2, 2-3 at
level 3, 2-4 at level 4, 2-5 at level 5 (or what the person asked for).

At levels 3-5 the figure is a scientific figure: numbered caption, correct names and proportions, labels in the
field's nomenclature, and a Try-this text written in the same register as the notes.

## When a concept earns a 3D figure

- **Spatial**: where things are relative to each other (a receptor across a membrane, an instrument's stages, a
  crystal lattice, the chambers of the heart).
- **A process where things move or change state in order** (the G-protein cycle, an ion's path through a mass
  spectrometer, a reflex arc, a titration).
- **Maths in more than one variable** (a function z = f(x, y), a joint distribution, vectors and planes, a sample cloud).
- **A physical model of an abstract idea** (dice, urns and a Galton board for probability; fraction tiles or a pizza
  for fractions; a balance for equations).

Not for lists, definitions, history, or a one-variable relationship (a sentence, a table or a mermaid flow is better).
The figure budget per level is at the top of this file. Put each figure in the section whose idea it shows, after the text that
names the parts, before the check (so the check can ask about it).

## Choose the engine by topic

Three engines, one look (paper background, ink, the same buttons, See-through, Labels and stats). Pick by what
the figure shows, not by taste:

| The figure shows | Engine | Why | Build |
|---|---|---|---|
| An **instrument, machine or lab method** (LC-MS/MS, a centrifuge, a titration rig, an ECG lead set) | **Colorfigures** (`assets/colorfigures/`) | hand-inked objects with see-through stages read like a textbook cutaway | `scripts/build_figure.py figure.html figures/<id>.html` |
| A **cell or membrane scene** with several actors moving through steps (G-protein cycle, cAMP-PKA cascade, synapse, transporter) | **Colorfigures + biokit** | many parts and a story; depth-sorted layers keep each actor readable | same |
| A **physical model for a child or a maths idea** (pizza/fraction bars, dice, urns, Galton board, balance) | **Colorfigures** | toy-like, friendly, tappable on a tablet | same |
| A **molecule or structure** where shape is the point (receptor helices and pocket, ligand fit, enzyme active site, ball-and-stick drug, DNA, crystal lattice, orbitals) | **smooth3d** (`assets/smooth3d/`, three.js) | smooth shading reads curvature and depth; ball-and-stick and helices look like the real thing | `scripts/build_page.py figure.html figures/<id>.html` |
| **Anatomy** (heart chambers, nephron, eye) | **smooth3d** | rounded organs need smooth shading | same |
| The **maths object itself** (surface, joint distribution, vectors, planes, sample cloud; a 2D plot with sliders) | **math3d** (`assets/math3d/`) | exact axes, ticks and slicing planes | `scripts/build_math3d.py figure.html figures/<id>.html` |

A set of notes can mix engines (a Gs set might use smooth3d for the receptor pocket and Colorfigures for the
G-protein cycle); keep the colour key the same across all of them.

## Write a figure spec before any geometry

Put it at the top of the figure script as a comment, and use it to brief whoever builds the figure:

```
FIGURE {id}: {title}             engine: colorfigure | smooth3d | math3d | sim        level: N
TEACHES: {one sentence: what the learner can predict after playing}
STEPS (= buttons, in the order a learner presses them):
  1. {label} -> {what moves from where to where; what changes state}
  2. ...
PARTS (grouped, each with what it is attached to): ...
FACTS (numbers, geometry, order of events, each with its source key): ...
SCHEMATIC (what is simplified; the Try-this text says so): ...
SEE-THROUGH shows: ...            LABELS: SHORT CAPS NAMES
STATS: {readouts, e.g. CAMP MADE, M/Z} (sourced or "illustrative")
COLOUR KEY (shared by every figure in the set): {thing -> colour}
OUT-OF-ORDER presses: {what happens}      URL PARAMS: {for screenshots}
```

## Science scenes in Colorfigures

Colorfigures was made for everyday objects. Read `colorfigures-engine.md` for the engine itself (its depth-sorting
rules are what keep a figure correct from every angle); these conventions extend it to science.

### Molecules, membranes and cells

**Start from the kit, not from scratch.** `assets/colorfigures/biokit.js` (load it after `core.js`; the build inlines
it) has everything a cell or molecule scene keeps needing: the membrane slab with head-group bands and lipid heads,
helix rods split automatically where they cross the membrane, rounded globular domains, loops and tails, lipid
anchors, nucleotides and other small molecules (`atp adp amp camp gtp gdp cgmp pi ppi`), a helix-bundle placer, a
three-layer depth sort (cytoplasm / membrane / outside) and a step-animation runner. Its API is in the comment at
the top of the file. `assets/colorfigures/examples/gpcr-gs-receptor.html` is a complete, verified molecular scene
built with it (β2 receptor + Gs: agonist binding, docking, GDP/GTP exchange, two off-switch routes, cholera toxin,
see-through labels), and its spec block is the model to copy. Read it before your first molecular figure.

- **Keep the actor visible.** In the closed view the membrane is translucent (the kit draws it at 0.55 opacity over
  the helices inside it), so a receptor is never hidden inside an opaque slab; See-through ghosts it further.
- **Scale**: model molecular scenes at 1 unit = 1 Å (a receptor-G-protein scene is roughly 120-200 units across).
  Say in the Try-this text that shapes are simplified and sizes roughly to scale.
- **Orientation**: outside of the cell up, cytoplasm down, and say so.
- **Membrane** = the scene's board: a slab about 40 Å thick (check the value for the membrane you draw) with lighter
  head-group bands top and bottom and a darker core; a single row of small lipid heads along the near edges for
  texture, nothing more. Draw it first. Anything crossing it is split into above / within / below pieces so the
  sort works (engine rule 5).
- **Proteins**: α-helices as `rod`s of radius ~5 Å placed by the real topology from the structure your research
  found (number of helices, their order around the bundle, tilt); globular domains as rounded lofts sized from the
  structure; β-sheets as flat plates. Label domains, not atoms.
- **Small molecules** as beads, with chemically meaningful differences made visible (GDP two phosphate beads, GTP
  three; a ligand that fits its pocket).
- **Conformational change**: interpolate between two real states with `ease()`, driven by a button, using the
  measured movement (for example, coupling to Gs moves the cytoplasmic end of TM6 of the β2-adrenergic receptor
  outward by about 14 Å [Rasmussen et al. 2011, Nature 477:549]).
- **Binding, release, diffusion**: things travel along real paths (Gαs-GTP slides along the membrane's inner face to
  adenylyl cyclase; it does not leave the membrane). Second messengers are particles made by the enzyme; a stat
  counts them. If the rate is not a sourced number, the Try-this text calls it illustrative.
- **See-through** ghosts the membrane or a protein's surface to show a pocket, a bound nucleotide or the inside of a
  cell; Labels name the parts that are working right now.
- **One colour per molecule across the whole set**, so the learner recognises it in every figure.

### Instruments and lab methods

This is Colorfigures' home ground: the instrument is a machine. The closed view is the real instrument; See-through
shows each stage along the real path (for LC-MS/MS: column → ESI needle → quadrupole Q1 → collision cell → Q3 →
detector). Buttons are the run steps, a picker chooses the sample or analyte, stats show measured quantities
(retention time, selected m/z, counts). Aim for the engine's 30-60 real parts at levels 4-5, fewer below.

### Physical models for maths and probability

Objects that produce outcomes: dice, coins, urns, spinners, a Galton board, a balance, fraction tiles. A "Run 100"
button animates trials; stats show counts and observed vs theoretical frequency, so convergence is visible.

## smooth3d

The API is in the comment at the top of `assets/smooth3d/smooth3d.js`; a complete, verified figure is
`assets/smooth3d/examples/receptor-pocket.html` (β2 receptor helices in a membrane, a drug picker, Bind and
Activate buttons, TM6 swinging out ~14 Å). Copy `three.min.js`, `OrbitControls.js` and `smooth3d.js` next to your
`figure.html` while working, then build. Conventions: 1 unit = 1 Å for molecules (state another unit for anatomy);
outside of the cell up; `K.helix` rods for α-helices, `K.blob` for globular domains, `K.molecule` for ball-and-stick
(CPK colours, with the drug's carbons in the set's drug colour so it reads through the membrane); `K.membrane` is
translucent and ghosts further in See-through; labels only on the parts that matter in the current step (`when`).
**Camera:** set `yaw` so the part that moves is seen side-on (a swing toward the camera is invisible).

## math3d

The API is in the comment at the top of `assets/math3d/math3d.js`; a complete figure is
`assets/math3d/examples/bivariate-normal.html` (correlation slider, a slicing plane for a conditional distribution,
sampling). Copy `math3d.js` next to your `figure.html` while working, then build. Conventions: data units in
`domain`; ticks at meaningful values; 1-3 sliders that change the concept's parameters; buttons for sampling,
slicing or animating; stats for the quantities the notes discuss; `top:true` on marks the learner must always see;
URL parameters for screenshot states.

## Build in parallel

If you can spawn subagents, start one per figure as soon as its spec and facts exist, and write `notes.md` while
they work. Brief:

```
Build the 3D figure "{title}" for study notes on {topic} ({audience}, level N).
SPEC:
{the figure spec, with the facts and their sources}
Read first: {skill}/modules/figures-3d.md, then {Colorfigures: {skill}/modules/colorfigures-engine.md and the
examples it names | smooth3d / simulator / math3d: the header of the engine file in {skill}/assets/ and its example}.
Work in {abs}/figures/src/{id}/. Build the single file {abs}/figures/{id}.html with {skill}/scripts/{build_figure.py | build_page.py | build_math3d.py}.
Set fig:'{NN}' to its order in the notes. Keep the Colorfigures credit link.
Verify: python3 {skill}/scripts/snapshot.py figures {abs}/figures --views (and --press "Label@300,..."), then look
at the shots; at most 3 fix rounds. Do not publish anything.
Reply with: each button's exact label and what it does, what See-through shows, what is schematic, any fact you
could not honour.
```

Without subagents, build them one after another once the notes are drafted, and stay inside the level's budget.

## Children (levels 1-2)

Build every figure (and a simulator, if there is one) with `--kid` (all three build scripts take it): 48 px buttons and big sliders
for small fingers on a tablet. A child must reach the first thing to tap without scrolling.

## Verify every figure

Common faults found in testing: label code that runs on an empty state during the first render (positions become
NaN, mostly at phone width): guard it; label leader lines crossing when many labels sit in one column: show fewer
labels at once (only the parts that are working in the current step); a stats readout whose name differs from the
word the notes use for it.

- **Readable at 100%:** in the default view, without zooming, the learner can see the moving parts and read the
  labels at phone width. A long instrument shown whole is too small: frame the stage that matters (and let the
  buttons move the view along it), or split it into an overview and a close-up.
- `python3 scripts/snapshot.py figures figures/ --views`: look at the default view, See-through with Labels, one back
  view, the press sequence and the phone shot. It must report no errors and no NaN.
- Truth check against the spec: every labelled part exists in the sources; directions and order of motion are
  right; numbers in stats match the notes.
- The figure's `<id>.png` (closed view) and `<id>-xr.png` (see-through) are reused in the doc.
- The Try-this text in `notes.md` names the buttons exactly as they appear on the figure.
