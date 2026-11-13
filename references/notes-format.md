# The notes source: `notes.md`

One markdown file holds the whole set of notes. `scripts/notes_kit.py` turns it into the study page (`study`),
the editable doc (`doc`) and a quality report (`check`), so write everything here and nowhere else. A complete,
working example is `assets/examples/bimetal-notes.md`: read it once before writing your first set.

## Front matter

```yaml
---
title: How Gs turns adrenaline into cAMP        # the learner-facing title (also the doc's name)
subtitle: GPCR signalling, part 1               # optional, one line
audience: Postgraduate pharmacology students    # who it is for, in plain words (shown on the cover)
level: 4                                        # 1 primary · 2 secondary · 3 undergraduate · 4 postgraduate/professional · 5 doctoral/research
language: en                                    # BCP-47 code of the language the notes are written in
short_title: Gs signalling                      # optional: for the study bar on small screens
page_title: Gs signalling notes                 # optional: 2-4 word name for the published page's tab and gallery
simple_label: Plain words                       # optional: defaults Easy/More detail (levels 1-2), Plain words/Full detail (3-5)
expert_label: Full detail
default_mode: simple                            # which view opens first (simple is the default: gist first)
focus: no                                       # yes only when the focus-aids module is on (focus mode, timer, read-aloud, short-section checks)
summary_label: In short                         # optional: label of the :::bigidea box (default "In short" at levels 3-5, "Big idea" at 1-2 or with focus aids)
---
```

## Structure

- Before the first section: a `:::goals` block (2-4 "By the end you can..." lines, each a verb a learner can check:
  explain, predict, calculate, compare, design). Optional short intro paragraph.
- `## Heading` starts a section. How long a section is and how it is built follow the level's register
  (`register.md`, section 3). The checker warns above 220 / 350 / 700 / 900 / 1100 words for levels 1-5 in standard
  notes, and above 220 / 300 / 380 / 450 / 500 with `focus: yes`.
- Headings: precise topic headings at levels 3-5 ("Activation of Gαs and stimulation of adenylyl cyclase"); with
  focus aids, or at levels 1-2, a heading can state the claim ("Gαs swaps GDP for GTP and lets go").
- `###` sub-headings inside a section, as a textbook uses them.
- Every section opens with `:::bigidea` (its one- or two-sentence summary) and usually ends with `:::keypoints`.
  `:::check` questions: after every section with focus aids or at levels 1-3; at levels 4-5 they may be gathered
  at the end of a section or of the chapter as self-assessment.
- `:::simple` / `:::expert` only when two depths were asked for (always with focus aids).

## Directives

Fenced with `:::name attributes` on its own line and a bare `:::` to close. They do not nest. Markdown, maths,
glossary terms and citations work inside all of them.

| Directive | What it is | Notes |
|---|---|---|
| `:::bigidea` | The section's point in 1-2 sentences | First thing in every section. Shown highlighted. |
| `:::simple` / `:::expert` | Two versions of the same explanation | The Simple/Expert switch shows one. Text outside them shows in both. Use both or neither. |
| `:::figure id=... title="..." engine=colorfigure\|smooth3d\|math3d\|sim height=620` | An interactive 3D figure | Body = the **Try this** prompts (the figure page itself shows no instructions). `id` must match `figures/<id>.html`. |
| `:::check` | Recall questions | See below. 1-3 per section. |
| `:::example title="..."` | Worked example, revealed one step at a time | Steps separated by a line containing only `---`. |
| `:::analogy` | "Picture it" box | Always add one sentence saying where the picture stops matching reality. |
| `:::pitfall` | "Common mix-up" box | A real, documented misconception and the correction. |
| `:::keypoints` | "Lock it in" bullets | 2-4 bullets. Collected again on the wrap-up page. |
| `:::goals` | Cover page goals | Before the first section only. |
| `:::note label="..."` | Any other aside | Use rarely. |
| `:::references` | The source list | Anywhere (end is usual). See below. |

### Recall questions

```
:::check
Q: Which subunit carries the GTP?
- [ ] Gβ
- [x] Gαs
- [ ] Gγ
A: Gα is the GTPase; Gβγ stays a tight dimer and never binds nucleotide.

Q: In your own words, why does cholera toxin cause a flood of cAMP?
A: It ADP-ribosylates Gαs so it cannot hydrolyse GTP, which locks it "on" [@cassel1977].
:::
```

- Multiple choice: options `- [ ]`, exactly one `- [x]`. Free recall: no options. Every question has an `A:`
  explanation (shown after answering): why the right answer is right, and for MCQs why the tempting wrong one is wrong.
- Prefer free recall (harder retrieval, stronger learning); use MCQ for discriminating look-alikes. Wrong options are
  real misconceptions, never jokes.

### Glossary terms

`{{GPCR|G-protein-coupled receptor: a membrane receptor with seven helices that activates G proteins.}}` shows the
term with a dotted underline; tapping it shows the definition in place (no leaving the page), and every term is
collected into the glossary. Define a term the first time it appears; one definition, one or two plain sentences.

### Citations and references

Cite inline with `[@key]` or `[@a; @b]`; numbers are assigned in order of first use. Define every key once:

```
:::references
[@rasmussen2011] Rasmussen SGF, et al. (2011). Crystal structure of the β2 adrenergic receptor-Gs protein complex. Nature 477:549-555. https://doi.org/10.1038/nature10361 {grade=primary}
[@iuphar-b2] β2-adrenoceptor. IUPHAR/BPS Guide to Pharmacology. https://www.guidetopharmacology.org/... {grade=database}
:::
```

`grade` tells the learner how settled a claim is, shown as a small badge: `textbook`, `guideline`, `review`,
`primary` (one peer-reviewed study), `database` (curated database entry), `preprint`, `emerging` (debated or new).
Only cite what you actually read (see `research.md`). Every URL must be one you saw.

### Maths

`$...$` inline and `$$...$$` display, in TeX. The study page renders MathML (works offline); the doc gets a
`latex` block for display maths and plain text for inline maths. Keep inline formulas short; give every symbol a
meaning in words the first time.

### Diagrams that are not 3D

A flat flow (a signalling cascade overview, a decision path) can be a ```` ```mermaid ```` block: the published
study page renders it natively. Do not use one where a 3D figure already shows the same thing.

## What the builder adds for you (don't write these)

Cover page with goals, time estimate, counts and a start button; the section list; per-section time and read-aloud
button; Mark-as-done and progress; the wrap-up page (all key points, an interleaved mixed review drawn from every
section, the learner's "revisit these" list, a spacing reminder, glossary, sources with grade badges); the doc's
answer key, glossary table and numbered sources.


**Each figure appears once.** Two `:::figure` blocks cannot share an id. To show the same model again in another state (a pizza already cut in 4), build a second page from the same source with a different start state, or point to the first figure in the Try-this text.
