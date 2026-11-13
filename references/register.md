# Register: write for the reader in front of you

The same topic is written differently for a child, a student and a researcher. The difference isn't only
difficulty. Vocabulary, notation, how claims are supported, how a section is built and what counts as an
explanation all change. Pick the level, then write the whole set in that level's register. Don't drift down
into a child's voice for a graduate, and don't drift up into jargon for a child.

## 1. Pick the level

| Level | Reader | Typical cues |
|---|---|---|
| 1 | Child (about 6-11) | "my 8-year-old", "class 4", "KS2", "for kids", times tables, fractions |
| 2 | Secondary school (about 11-18) | "GCSE", "class 10", "CBSE/ICSE", "A-level", "NEET/JEE basics", "high school" |
| 3 | Undergraduate, early professional, curious adult | "B.Pharm", "MBBS year 1", "first-year", "I'm new to this", no other cue |
| 4 | Postgraduate or professional | "M.Pharm", "MSc", "for pharmacologists", "clinician", a named job in the field |
| 5 | Doctoral / research | "PhD", "thesis", "research-level", "current debates", "for a lab meeting" |

- The topic alone does not set the level: "probability for a 10-year-old" is 1, "measure-theoretic probability" is 5.
- No cue: use 3, and say so at the confirm step.
- Write in the language the person wrote in unless asked otherwise (`language:` in the front matter).

## 2. The register at each level

| | 1 · Child | 2 · School | 3 · Undergraduate | 4 · Postgraduate / professional | 5 · Doctoral / research |
|---|---|---|---|---|---|
| **Voice** | Warm, spoken, to "you"; a story or a game | Friendly teacher; "you" | Textbook: clear, neutral, third person mostly | Standard scientific prose, as in a review article or graduate text | Scholarly, as in a review in the field's journals |
| **Sentences** | ≤ 10-12 words, one idea each | ≤ 16 | ≤ 22, varied | Full academic sentences; precise subordinate clauses where they carry logic | Same; hedged where evidence is incomplete |
| **Terms** | Everyday words; one maths/science word at a time, shown before named | Curriculum terms, each defined in a box | Field terms defined at first use, then used consistently | Standard nomenclature used without apology (IUPHAR receptor names, IUPAC, gene/protein symbols, SI); define only specialist terms | Full technical vocabulary; define terms that are contested or used differently between groups |
| **Notation** | Pictures and numbers, no symbols | Simple formulas, every symbol explained | Standard notation, units throughout | Full notation, equations numbered and referred to; derivations where they explain | Formal statements, assumptions explicit; proofs or derivation sketches |
| **Numbers** | Everyday sizes ("as thick as a hair") | With units | With units and a source | Quantitative constants (Kd, EC50, kcat, m/z, p-values) with conditions and source | Values with spread, method and context; disagreements between datasets noted |
| **Evidence** | Sources listed for the adult only | A few sources | Key claims cited | Every non-obvious claim cited; graded evidence | Primary literature; how we know (key experiments); open questions and competing models |
| **Explanation** | Concrete → picture → name it | Concrete → rule → example | Concept → mechanism → example → significance | Mechanism at molecular/formal level → regulation and exceptions → clinical / applied relevance | Model → evidence for and against → limits → what an experiment would decide |
| **Analogies** | Freely, from the child's world | Often, each with its limit | Sparingly, for a hard step, with where it breaks | Rarely; prefer the real mechanism, a schematic or an equation | Almost never |
| **Examples** | Pizza, sweets, toys, pets | Daily life, simple lab | Textbook cases, worked problems | Named drugs, toxins, assays, clinical cases, datasets | Landmark and recent studies, methods papers |
| **Questions** | Tap the picture; which is bigger? | Recall and apply | Apply and explain | Apply to a case; interpret data; predict a drug's effect | Critique a study; design a control; predict an experiment's result |

## 3. What a section looks like

**Levels 3-5 (standard notes):** a textbook or review chapter, not a worksheet.
- Heading that states the topic precisely ("Activation of Gαs and stimulation of adenylyl cyclase").
- An *In short* line (`:::bigidea`, one or two sentences) summarising the section, as a review's key-point box does.
- The body in continuous, well-structured paragraphs (typically 120-200 words each), in teaching order: definition →
  mechanism → regulation/exceptions → significance. Subheadings (`###`) inside long sections.
- Equations displayed and numbered; tables for comparisons (receptor subtypes, drug classes, assay parameters).
- Figures with numbered captions ("Figure 2. ...") and **Try this** prompts.
- Boxes used sparingly: `:::example` (worked example), `:::pitfall` (a common error or exam trap), `:::note` (clinical
  or applied relevance).
- Self-assessment questions at the end of the section or of the chapter (`:::check`), at the level in the table.
- Sections can be long (600-1100 words at level 4-5) when the topic needs it; split only when the idea changes.
- Two depths (`:::simple` / `:::expert`) only when the person asked for an easier path, or the audience is mixed.

**Levels 1-2:** a play page.
- 3-4 short sections (under ~150 words at level 1, ~300 at level 2), each built around something to tap or do.
- Big idea first, in the child's words; new word shown, then named; a game at the end; sources for the adult.

**Levels 4-5, always:** one section near the end, *Beyond the basics*, with the extensions and traps an expert
would expect (Bayes: colliders, selection bias, explaining away; a GPCR pathway: biased agonism, compartmentalised
cAMP signalling), each in 2-5 sentences with a source.

## 4. One idea at five levels (calibration)

Gαs activation by an agonist-bound receptor:

1. **Child:** "A message from outside knocks on the cell. A helper inside wakes up and runs to a machine. The
   machine starts making little signal balls."
2. **School:** "Adrenaline binds to a receptor in the cell membrane. This switches on a G protein inside the
   cell, which turns on an enzyme that makes a messenger molecule called cyclic AMP (cAMP)."
3. **Undergraduate:** "Agonist binding stabilises an active receptor conformation that catalyses GDP release from
   the α subunit of the heterotrimeric Gs protein. GTP then binds, Gαs-GTP dissociates from Gβγ and stimulates
   adenylyl cyclase, increasing intracellular cAMP."
4. **Postgraduate:** "Agonist occupancy of the β2-adrenoceptor stabilises an outward displacement of TM6 (~14 Å
   at its cytoplasmic end), creating a cavity that engages the α5 helix of Gαs; this separates the Ras-like and
   helical domains and lowers the affinity for GDP [Rasmussen 2011]. GTP binding promotes dissociation of
   Gαs-GTP from Gβγ and activation of membrane-bound adenylyl cyclase isoforms; signal termination depends on the
   intrinsic GTPase of Gαs, which RGS proteins accelerate only weakly for this family."
5. **Doctoral:** as 4, plus the evidence and its limits: what DEER, HDX-MS and MD studies show about the kinetic
   order of these events, where the crystal structures may not represent physiological states, and what remains
   debated.

Level 4 is not level 3 with more words: it names structures and numbers, cites them, and states exceptions.

## 5. Voice rules for every level

- Simplify by leaving out, never by bending. A simple sentence must still be true.
- Lead with what happens, then how, then why it matters.
- No filler, no hype, no "Let's dive in", no exclamation marks above level 2.
- Never label the reader ("for ADHD people", "for slow learners") in the notes.
- Pharmacology and medicine are educational: mechanisms and evidence, no patient-specific dosing.
