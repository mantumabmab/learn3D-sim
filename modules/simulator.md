# Module: simulator

**When this module runs:** the person asked for a simulator, a game, "what if", or something to play with; or the
topic is a system the learner can perturb (a pathway with drugs, pharmacokinetics, enzyme kinetics, Bayes with
priors, a titration, a population) and the plan at the confirm step included it. For a child (levels 1-2) the
simulator is the **game**, and it is usually worth including.

One simulator per set at most: **one "what if" simulator** (`assets/simulator/sim.js`, built with
`scripts/build_page.py`): switches for drugs or conditions, sliders for doses, rates or probabilities, a live chart
and readouts, and one live sentence saying what the learner is looking at. It is where the learner tests their own
predictions after the figures have shown the mechanism. It goes in `notes.md` as an ordinary `:::figure` (it is
embedded and published the same way) in the section where all the parts are known, usually the second-last, with a
**Predict first** prompt ("Before you switch on cholera toxin, will cAMP go up, down or stay?").

- `chart:'time'` steps a small model live (pathways, pharmacokinetics, enzyme kinetics, a titration, a population).
  `chart:'bars'` recomputes bars from the inputs (Bayes: prior / likelihood / posterior; fractions: which is bigger;
  a confusion matrix; dose-response at chosen doses).
- **Honesty:** the directions and shapes must be right and cited in the notes; the numbers are usually
  illustrative, and the simulator's `note` and the notes say so. Write the model equations in the spec comment.
- Level 1-2: make it a game with `game:{rounds, ask}` and build it with `--kid` (scored rounds, big buttons, stars, the chart hidden until
  the child answers, a kind reason after every answer) and at most 2 controls. At levels 3-5 a short `game` is a good
  self-test too. Level 3-5: 2-5
  switches and 1-2 sliders.
- Example: `assets/simulator/examples/gs-pathway-sim.html` (agonist dose, propranolol, cholera toxin, forskolin,
  PDE inhibitor → active Gαs, cAMP, PKA).

Build: `python3 scripts/build_page.py sim.html figures/<id>.html` (add `--kid` at levels 1-2), then verify with
`scripts/snapshot.py figures figures` like any figure. The API is in the comment at the top of
`assets/simulator/sim.js`.
