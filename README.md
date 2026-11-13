# learn3d-sim: a Claude skill for 3D, simulation-based, high-standard science notes

Evidence-based study notes on any science, maths, pharmacy or medical topic, written in the reader's register:
a child gets a story and a game; an undergraduate, postgraduate or PhD reader gets standard scientific prose with
nomenclature, equations and graded citations. Before writing, the skill confirms the level, scope and extras.

**Modules (used only when needed or asked for):** interactive 3D figures (Colorfigures for instruments and cell
scenes, smooth3d/three.js for molecules and anatomy, math3d for maths), a "what if" simulator or game, focus aids
for ADHD-like attention difficulties, and exports (editable doc, study page, PDF, one-page cheat sheet).

## Install
- **Claude app:** download this repo as a zip (Code → Download ZIP), then Settings → Capabilities → Skills →
  Upload skill. The `learn3d-sim` folder must contain `SKILL.md` at its top level.
- **Claude Code:** copy the folder to `~/.claude/skills/learn3d-sim/`.

Then ask, for example: "Make M.Pharm notes on the Gs pathway with 3D figures."

## Layout
`SKILL.md` (core workflow) · `references/` (register by level, notes format) · `modules/` (research, 3D figures,
simulator, focus aids, exports) · `scripts/` (notes kit, figure builders, snapshot checker) · `assets/` (engines,
templates, examples) · `evals/` (test prompts and graders).

## Credits and licences
Colorfigures by April Zhu (MIT, https://april-zhu.com/colorfigures), see `assets/colorfigures/LICENSE`.
three.js r128 (MIT), see `assets/smooth3d/LICENSE-three.txt`.
