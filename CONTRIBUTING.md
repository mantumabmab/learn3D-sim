# Contributing to learn3d-sim

Thank you for helping more people learn science by playing with it. Contributions of every size are welcome.

## Ways to help
- **Add an example.** Generate notes with the skill on a topic not yet in the gallery, check them, and open a pull
  request adding the page to `docs/examples/`, a screenshot to `docs/img/` and a card to `docs/index.html`.
  Topics we would love: electric circuits, DNA replication, black holes, enzyme kinetics, Fourier series, bridges
  and beams, the heart, climate feedbacks.
- **Improve the teaching.** Better register guidance (`references/register.md`), better question styles, new
  reader types, translations.
- **Improve the engines.** New Colorfigures or smooth3d parts, simulator features, accessibility fixes.
- **Report problems.** A wrong fact, a broken figure, a page that scrolls sideways on a phone: open an issue with
  the page, the device and what you expected.

## Standards for an example page
1. **Correct and sourced.** Every number and named fact has a reference; references are graded A/B/C.
2. **Pitched at one reader.** The level is stated at the top and the language stays there.
3. **The figure does the science.** It is driven by the real relations, says what is schematic, and has a
   *Try this* prompt that asks for a prediction.
4. **Questions with answers.** At least three self-test questions with model answers.
5. **Works everywhere.** One self-contained file (or a folder with its own scripts), no JavaScript errors,
   no sideways scrolling at 390 px, works offline.
6. **Educational only.** No dosing, prescribing or patient-specific advice.

## Pull requests
Keep each pull request to one topic. Describe what you changed and how you checked it (for example: opened at
phone and desktop width, ran `python3 scripts/snapshot.py figures <folder>`, checked the numbers against the sources).
