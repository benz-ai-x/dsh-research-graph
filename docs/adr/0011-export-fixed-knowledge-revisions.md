# Export fixed Knowledge Card revisions as standalone Markdown

An explicit export preview captures every selected card's latest saved revision before asynchronous source checks. The result owns the complete Markdown bytes and filename. Download uses this result without rereading cards or sources; only a new preview adopts later revisions. No export record or model request is created.

The Host checks original availability through Session Controller, while the file always includes the immutable source excerpt attached to the chosen revision. Missing/unreadable originals, incomplete ranges, or changed text receive distinct annotations. Session identity, title, exact event range, discussion time, and source-to-card relations remain readable without app navigation or canvas geometry. Unselected cards and complete Session archives are outside the export.

Every user-authored field is enclosed in a fence longer than its embedded backtick runs so multiline content and code fragments cannot break document structure. Metadata headings and filenames are normalized separately. A preview accepts 1–50 unique cards and at most 8 MB; errors and cancellation preserve the user's selection. The export overlay retains the underlying editor, including other unsaved extraction drafts.
