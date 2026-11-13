---
name: learn3d-sim
description: High-standard, evidence-based study notes on any science, maths, pharmacy or medical topic, written in the register of the reader, from a child (simple, playful) to an undergraduate, postgraduate or PhD researcher (standard scientific language, nomenclature, equations, graded citations), with interactive 3D figures, a "what if" simulator and focus aids for ADHD-like attention difficulties added as modules when needed or asked. Confirms the requirements first, then delivers an editable doc, a study page, a PDF and a cheat sheet. Use whenever someone asks for notes, a study guide, revision notes, a lesson, a chapter or an explainer on a scientific concept (e.g. "Gs pathway notes for M.Pharm", "explain LC-MS/MS for drug screening", "teach me Bayes' theorem", "fractions for my 9-year-old"), even if they don't name this skill.
---

# learn3d-sim: high-standard science notes with 3D and simulation

Write notes a good textbook author would be proud of: **correct, sourced and pitched exactly at the reader**. A
child gets a story and a game; a graduate gets standard scientific prose with the field's nomenclature, numbers and
citations. Everything else (3D figures, a simulator, focus aids, exports) is a **module** that runs only when the
topic needs it or the person asks for it.

## Modules

| Module | File | Runs when |
|---|---|---|
| Register (always) | `references/register.md` | Every set: how language, notation, evidence and structure change with the level |
| Notes format (always) | `references/notes-format.md` | Every set: how to write `notes.md` |
| Research (always) | `modules/research.md` (+ `modules/researcher.md`) | Every set; depth scales with the level |
| 3D figures | `modules/figures-3d.md` (+ `modules/colorfigures-engine.md`) | The person asked for 3D, a model, interactive or visual; or a structure or process in the topic is far easier to see than read and the person didn't say "text only" |
| Simulator / game | `modules/simulator.md` | Asked for (simulator, game, "what if", "play with"); or the topic is a system to perturb and it was confirmed; usually for children |
| Focus aids | `modules/focus-aids.md` | **Only when asked**: ADHD, attention, focus, "I get distracted", short chunks; or chosen at the confirm step |
| Exports and delivery | `modules/exports.md` | Every set: doc, study page, PDF, cheat sheet, as confirmed |

## Bundled tools

| Path | What it does |
|---|---|
| `scripts/notes_kit.py` | `check` validates notes.md; `study` builds the study page; `doc` exports the doc sections; `print` makes notes.pdf + the cheat sheet |
| `scripts/build_figure.py`, `assets/colorfigures/` (+ `biokit.js`) | Colorfigures: hand-inked interactive 3D for instruments, machines, cell scenes and physical models |
| `scripts/build_page.py`, `assets/smooth3d/` | smooth3d (three.js, bundled): smooth-shaded molecules, helices, ball-and-stick, anatomy |
| `scripts/build_math3d.py`, `assets/math3d/` | math3d: surfaces, joint distributions, vectors, planes, 2D plots with sliders |
| `scripts/build_page.py`, `assets/simulator/` | simulator: switches, sliders, live chart or bars, a scored game mode |
| `scripts/snapshot.py` | screenshots and error checks for figures and the study page |
| `assets/examples/` | `bimetal-notes.md`, a complete notes.md to copy the format from |

All build scripts take `--kid` (48 px buttons) for levels 1-2. Run scripts with `python3 <skill folder>/scripts/<name>.py`;
they need Python 3 with `markdown` (`latex2mathml` installs itself); `snapshot.py` and `print` need Playwright.

## Workflow

Create a task list from these steps. Read each module when its step comes up, not before.

### 1. Read the request

Decide from the request what you can: the **level** (cues in `references/register.md`), the scope, the language,
and which modules are wanted or implied. Note what is still open.

### 2. Confirm the requirements

Before any research, confirm what you'll make in **one** question round (the question tool, up to 4 questions,
each with your recommended option first). Ask only what the request leaves open:

- **Reader and level**, if unclear ("M.Pharm student · standard postgraduate notes" vs "first-year · undergraduate").
- **Scope and depth**: the subtopics you plan to cover and roughly how long (e.g. "6 sections, ~40 min: receptor,
  Gs cycle, adenylyl cyclase/cAMP, PKA and Epac, termination and RGS, drugs and toxins, beyond the basics").
- **Extras** (multi-select): 3D figures (say which, e.g. "receptor activation, cAMP cascade"), a simulator or game,
  focus aids, cheat sheet.
- **Output** only if it matters: editable doc + study page + PDF (default), or a named format they asked for.

When the request already settles everything, or the person said "just make it", skip the question and state the
plan in one line before starting. When nobody is there to answer (a scheduled or unattended run), take the
recommended options and state them at the top of the notes.

### 3. Plan

Write a short `plan.md` in a new working folder (layout in `modules/exports.md`): goals (2-4 "By the end you
can..." lines), the section outline in teaching order, the figures and engines (`modules/figures-3d.md`), the
simulator if confirmed, and the research tier (`modules/research.md`). Then create the editable doc's skeleton
(`modules/exports.md`, step 1), so the person sees the outline.

### 4. Research

Follow `modules/research.md`. The tier scales with the level; clinical, pharmacological and quantitative topics
always get their numbers checked against sources. Collect the facts the figures need (geometry, order of events,
numbers) along with the teaching content.

### 5. Figures and simulator (if confirmed)

Write each figure spec and build it as `modules/figures-3d.md` says (in parallel with writing, if you can spawn
helpers); the simulator follows `modules/simulator.md`.

### 6. Write `notes.md`

Read `references/register.md` and write the whole set in the level's register, in the format of
`references/notes-format.md`. With focus aids on, also follow `modules/focus-aids.md`. In every case:

- Every claim and number traces to a source you read; cite with `[@key]` and grade every reference.
- Simplify by leaving out, never by bending: a simple sentence must still be true; what is debated is labelled.
- Each figure sits in the section whose idea it shows, with **Try this** prompts that ask for a prediction.
- Levels 4-5 include a short *Beyond the basics* section.

Run `python3 scripts/notes_kit.py check notes.md --figures figures` and fix every ERROR and the WARNs that matter.

### 7. Verify

Check each figure with `scripts/snapshot.py figures figures --views` and look at the shots. Re-read the notes
against the research notes: numbers, names, citations, and that the register stayed at the reader's level from
start to finish. For clinical, pharmacological or other high-stakes notes, have a separate agent that didn't write
them check the claims against the sources when you can spawn one.

### 8. Deliver

Follow `modules/exports.md`: publish the figure pages, build and publish the study page, fill the doc section by
section, then make the PDF and cheat sheet. Reply in two or three lines: what was made, the level and register
used, one real next step.

## Principles

- **Write for the reader you have.** A graduate is never talked down to; a child is never handed jargon.
- **Evidence first.** No source, no claim. Grade what you cite; say what is uncertain.
- **Every element earns its place.** A figure, a box or a fact that neither explains nor engages is cut.
- **Modules on demand.** Add 3D, simulators and focus aids where they help this reader, not by habit.
- **Educational, not clinical advice.** Mechanisms and evidence; no patient-specific dosing.

## Credits

Colorfigures by April Zhu (MIT licence, https://april-zhu.com/colorfigures), built on ISO-GLOW and iso-figure: keep
`assets/colorfigures/LICENSE` and the credit link on figure pages. smooth3d runs on three.js r128 (MIT,
`assets/smooth3d/LICENSE-three.txt`).
