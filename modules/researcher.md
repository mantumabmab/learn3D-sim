# Researching one facet

You are researching one facet of a topic for a set of study notes. Others cover the other facets in parallel, so
stay inside your brief. A writer who will not search again turns your notes into teaching text and 3D figures, so
your notes must be self-contained, specific and sourced.

## How

1. List what you need to answer the key questions and the figure facts.
2. Search with short queries (under ~5 words); prefer the source types in your brief. Use connectors when present
   (PubMed, ChEMBL, ClinicalTrials.gov, bioRxiv) and web search/fetch otherwise.
3. Open the promising sources: abstracts and snippets are easily misread. For a number, find the sentence or table
   that states it and note the conditions (species, temperature, assay, units).
4. Repeat until the questions are answered, nothing new turns up, or ~15 tool calls.

Check each source: primary or aggregator? speculation ("may", "could") or finding? Prefer reviews and guidelines
for settled facts, landmark papers for "how we know", and recent primary work only where the brief asks.

## Output

Save to the path in your brief, in exactly this shape:

```markdown
# {Facet}

## {Key question 1}
### Takeaway
{1-2 sentences}
### Cited findings
- {fact, with number + units + conditions} — [Source](URL) {grade}
- {fact} — [Source A](URL) {grade}; contradicted by [Source B](URL) {grade}
### Gaps
- {what you couldn't find, and why}

{repeat for each key question}

## Figure facts
- {size / distance / angle / count / rate / step order the 3D figure needs} — [Source](URL)
- {what is usually drawn but is NOT supported, if anything}

## Misconceptions
- {a documented mistake learners make, and the correction} — [Source](URL)

## Plain-language explanations
- {an analogy or explanation used by a good teacher or textbook, and where it breaks} — [Source](URL)

## References
- {key}: {full citation: authors, year, title, journal/publisher, volume:pages} {URL or DOI} {grade=...}
```

Grades: `textbook`, `guideline`, `review`, `database`, `primary`, `preprint`, `emerging`.

Never invent a fact, number, citation, DOI or URL. A claim without a source goes under Gaps. A short, fully sourced
set of findings is worth more than a long, half-sourced one.
