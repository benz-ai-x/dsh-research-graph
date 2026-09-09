import { DatabaseSync, type StatementSync } from 'node:sqlite'

const MATCH_START = '\uFDD0'

/** Verify one original text at a time using the matching Harness's FTS rules. */
export class DiscussionTextMatcher {
  private readonly database = new DatabaseSync(':memory:')
  private readonly insert: StatementSync
  private readonly clear: StatementSync
  private readonly search: StatementSync
  private readonly phrase: string

  constructor(query: string) {
    this.phrase = `"${query.replaceAll('"', '""')}"`
    try {
      this.database.exec("CREATE VIRTUAL TABLE discussion USING fts5(text, tokenize = 'unicode61')")
      this.insert = this.database.prepare('INSERT INTO discussion(text) VALUES (?)')
      this.clear = this.database.prepare('DELETE FROM discussion')
      this.search = this.database.prepare('SELECT highlight(discussion, 0, ?, ?) AS marked FROM discussion WHERE discussion MATCH ?')
    } catch (error) {
      this.database.close()
      throw error
    }
  }

  /** UTF-16 position of the first matched phrase, without indexing excluded blocks. */
  find(text: string): number | undefined {
    this.clear.run()
    this.insert.run(text.replaceAll(MATCH_START, '\uFFFD'))
    const row = this.search.get(MATCH_START, '', this.phrase)
    if (typeof row?.marked !== 'string') return undefined
    const start = row.marked.indexOf(MATCH_START)
    return start < 0 ? undefined : start
  }

  dispose(): void {
    this.database.close()
  }
}
