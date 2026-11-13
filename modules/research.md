# Research: the evidence behind every claim

The notes are only as good as their sources. Research scales with the level and with how settled the topic is; the
goal is always the same: every non-obvious claim and every number in the notes and figures traces to a source you
actually read.

## Pick a tier

| Tier | When | How |
|---|---|---|
| **Light** | Levels 1-2, settled school science or maths | Do it yourself, ~4-8 lookups: the curriculum's scope for that age, one or two authoritative explanations (open textbook, national curriculum, education body), documented misconceptions about the topic, and a check of every number you will use. |
| **Standard** | Level 3 (including clinical or lab-method topics at level 3, plus the independent claim check), or level 4 on a settled topic | Yourself, or 1-2 researchers in parallel: a recent review or standard text, key numbers with sources, misconceptions, one real-world or clinical hook. |
| **Deep** | Levels 4-5 with mechanism detail; anything clinical, pharmacological or quantitative; recent or debated topics | 3-5 researchers in parallel, one per facet (below), each saving notes to a file. One extra round only if a gap would make a section wrong or empty. |

When subagents aren't available, run the same plan yourself, facet by facet, and keep the notes files anyway: the
figure specs and the final check read them.

## Decompose (deep tier)

Split the topic into facets that don't overlap and together cover the outline. Typical splits:

- **A signalling pathway** (e.g. Gs): (1) structure and activation mechanism, with the geometry a 3D figure needs;
  (2) effectors and downstream signalling, with amplification numbers; (3) switching off: GTPase, RGS proteins,
  GRK/arrestin, phosphodiesterases, desensitisation; (4) drugs, toxins and diseases acting on the pathway;
  (5, level 5) recent structures, biased signalling, open questions.
- **An instrument or method** (e.g. LC-MS/MS for drug screening): (1) physical principle of each stage; (2) how the
  assay is run and validated (calibrators, internal standards, MRM transitions, cut-offs); (3) performance and
  limits (matrix effects, interferences, LOD/LOQ); (4) comparison with alternatives (immunoassay screens).
- **A maths topic** (e.g. Bayes' theorem): (1) definitions and theorems from standard texts; (2) the canonical worked
  examples and where learners go wrong; (3) applications that motivate it at this level.

## Brief each researcher

Spawn all researchers in one turn, each with a narrow, self-contained brief:

```
Research {facet}, for study notes on {topic} written for {audience, level N}.

Objective: {what the notes need from this facet}
Key questions:
- {question}
- {question}
Figure facts needed: {sizes, distances, angles, counts, rates, sequence of steps that the 3D figure must get right, or "none"}
Suggested sources: {from the list below}
Constraints: {date range, region/curriculum, species (human vs model organism), anything from the request}

Save your notes to {absolute path}/research_notes/{facet}.md

First read {skill path}/modules/researcher.md and follow it.
```

## Where to look

Prefer, in order: guidelines and curated databases → systematic reviews and reviews → standard textbooks →
landmark primary papers (for "how we know" and figure geometry) → recent primary papers and preprints (only for
level 5 or when nothing settled exists, and always graded `primary`/`preprint`/`emerging`).

- **Biomedicine and pharmacology**: PubMed (connector if available; use `review[pt]` for reviews), NCBI Bookshelf /
  StatPearls, the IUPHAR/BPS Guide to Pharmacology (receptor and target data, nomenclature, affinities), ChEMBL
  (drug-target bioactivity and mechanism), ClinicalTrials.gov (trial facts), RCSB PDB (structure IDs, distances,
  conformational changes, for figures), bioRxiv/medRxiv (preprints: label them).
- **Analytical chemistry and instruments**: IUPAC terminology (Gold Book), method guidelines (e.g. ICH M10
  bioanalytical method validation, CLSI documents for clinical mass spectrometry, SWGTOX/ANSI-ASB standards for
  forensic toxicology), reviews in analytical and clinical chemistry journals.
- **Physics and chemistry**: OpenStax, NIST reference data, IUPAC.
- **Mathematics, probability, statistics**: standard textbooks (open ones such as Grinstead & Snell, *Introduction to
  Probability*; Blitzstein & Hwang, *Introduction to Probability*; OpenStax *Introductory Statistics*; MIT
  OpenCourseWare notes), the NIST/SEMATECH e-Handbook. Definitions and theorems are stable; cite the text you used.
- **School levels**: the relevant curriculum (e.g. NCERT/CBSE in India, England's National Curriculum, Common Core),
  education-research papers on misconceptions for the topic.
- Encyclopedias and AI summaries are pointers to sources, never the source.

## Grade what you cite

`textbook`, `guideline`, `review`, `database`, `primary`, `preprint`, `emerging` (see `notes-format.md`). When sources
disagree, say so in the notes ("most studies find..., but...") and grade the contested claim `emerging`.
A manufacturer's application note, kit insert or vendor white paper is `primary` with "(vendor)" after the title;
use it for method details (transitions, settings), never as the only source for a general claim.

## Honesty rules (non-negotiable)

- Never invent a citation, a DOI, a number or a URL. If you can't find a source for a claim, drop or soften the claim.
- A number in a figure needs a source like a number in the text. If a figure has to simplify (shapes, relative
  sizes, speeds), the Try-this text says what is schematic.
- Species and context matter: say when data are from rodents, cell lines, or in vitro.
- Medical content is educational: no patient-specific dosing advice; point to guidelines for clinical decisions.
