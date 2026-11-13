# Module: exports and delivery

Everything comes from one `notes.md`. Deliver **what was confirmed** at the confirm step; the default set is:

| Output | Default | Made by |
|---|---|---|
| **Editable doc** (master copy; downloads as Word/PDF) | yes | `notes_kit.py doc`, then the doc tool |
| **Study page** (the notes with figures embedded, self-check questions; focus tools only if the focus module is on) | yes when there are figures or questions | `notes_kit.py study` |
| **One page per figure** (and the simulator, if any) | yes when there are figures | the build scripts |
| **PDF** of the full notes | yes | `notes_kit.py print` |
| **One-page cheat sheet** (PDF + picture) | yes for revision notes; ask otherwise | `notes_kit.py print` |
| **Word file** (.docx) | only when asked, or no doc tool exists | pandoc on `doc.md` |

Text-only notes (the person said no figures) skip the figure pages; the study page is then optional.

## Working folder

```
<slug>/
  plan.md                 outline, level, tier, figure list
  research_notes/*.md     one file per facet
  notes.md                the single source
  figures/src/<id>/       figure working files
  figures/<id>.html       built figures (+ <id>.png, <id>-xr.png snapshots)
  figures.json            {id: published URL}
  study.html              built study page
  doc.json, doc.md        doc export
  notes.pdf               full notes as a PDF (both depths, figure pictures, answer key, glossary, sources)
  cheatsheet.html/.pdf/.png   one A4 page: each section's big idea + key points + key words
```

## Order of work

1. **Doc skeleton early.** As soon as the outline is settled, create the doc with the editable-doc tool your session
   offers (for example the Claude Docs connector or a Docs artifact type): the title, then one placeholder per
   section whose intent is that section's big idea, plus placeholders for the answer key, glossary and sources.
   Open it so the person can watch it fill. **That tool's own instructions on how to create, open and fill a doc take
   precedence over anything here**; load its guide first if the session tells you to.
2. **Publish each figure** once it is built and verified: one Artifact publish per `figures/<id>.html` (icon: a
   generic word such as `cube`; description: one sentence on what the figure shows). Record each URL in
   `figures.json` as `{"<id>": "<url>"}`.
3. **Build and check the study page**:
   `python3 scripts/notes_kit.py study notes.md --figures figures --figure-urls figures.json --out study.html`, then
   `python3 scripts/snapshot.py page study.html --out shots` and look at the shots (one pass of fixes). Publish
   `study.html` as an Artifact (icon `book`). Its `<title>` comes from `page_title:` in the front matter if set, else
   `title:`; give `page_title` a 2-4 word name when the title is long.
4. **Fill the doc** from `python3 scripts/notes_kit.py doc notes.md --figures figures --figure-urls figures.json
   --study-url <study page URL> --out-dir .` → `doc.json`:
   - `lead` goes under the title (it links the study page),
   - each `sections[i].markdown` replaces that section's placeholder, **one section per call**,
   - then `answer_key`, `glossary`, `references` into their placeholders.
   - Figure snapshots (`figures[id].snapshot`) can be uploaded and placed under the figure's line using the doc
     tool's upload flow; if that isn't available, the link is enough.
   - Display maths arrives as ```` ```latex ```` blocks, which the doc renders as formulas.

5. **Print the PDF and the cheat sheet** (when confirmed):
   `python3 scripts/notes_kit.py print notes.md --figures figures --figure-urls figures.json --study-url <URL> --out-dir .`
   writes `notes.pdf`, `cheatsheet.pdf` and `cheatsheet.png`. Look at `cheatsheet.png`: it must fit one page (the
   script shrinks the print to fit and warns if it can't; then shorten the key points). Send `notes.pdf` and
   `cheatsheet.pdf` with the file-sending tool, and add both to the doc's lead line ("PDF and cheat sheet: sent in
   the chat"). The simulator is already a figure: it is published and embedded with the others.

## When a tool is missing

- **No editable-doc tool**: convert `doc.md` (which already embeds the figure snapshots) to Word with
  `pandoc doc.md -o "<title>.docx" --resource-path=.` (or with the docx skill), and send it.
- **No Artifact tool**: send `study.html` (self-contained: figures, maths and focus aids all work offline; only the
  web fonts need a connection) and the figure files with the file-sending tool; build the study page without
  `--figure-urls`.
- **The person asked for a specific format** (PDF, Word, a Notion page, slides): honour it, and still offer the
  study page, because that is where the interactivity lives.

## Final reply

Two or three lines: what was made and for whom (state the level you assumed), the doc link if the doc tool asks you
to give it, and one real next step (for example a version for a different level, or more practice questions on the
weakest section). Don't recap the notes; they are in front of the person.
