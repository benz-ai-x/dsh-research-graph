import type { KnowledgeRevision } from './knowledge.ts'

export interface KnowledgeExportRequest { readonly cardIds: readonly string[] }
export interface KnowledgeExportResult {
  readonly filename: string
  readonly markdown: string
  readonly cards: readonly { readonly cardId: string; readonly revisionId: string; readonly number: number; readonly title: string }[]
}
export type ExportSourceStatus = 'available' | 'unavailable' | 'incomplete' | 'changed'
export interface ExportCard {
  readonly cardId: string
  readonly revision: KnowledgeRevision
  readonly sourceStatuses: readonly ExportSourceStatus[]
}

const SOURCE_STATUS: Record<ExportSourceStatus, string> = {
  available: 'Original verified / 原文范围已核对',
  unavailable: 'Original unavailable / 原文缺失或无法读取',
  incomplete: 'Original range incomplete / 原文范围不完整',
  changed: 'Original differs from saved source / 原文与保存来源不同',
}
const KINDS = { conclusion: 'Conclusion / 结论', method: 'Method / 方法', hypothesis: 'Hypothesis / 假设', question: 'Question / 问题' }
const inline = (text: string): string => text.replace(/\s+/gu, ' ').replace(/[\\`*_[\]<>#|]/gu, '\\$&')
// A longer fence preserves arbitrary multiline text, including unfinished code blocks.
const block = (text: string): string => {
  if (text === '') return '_Not recorded / 未填写_'
  let length = 3
  for (const match of text.matchAll(/`+/gu)) length = Math.max(length, match[0].length + 1)
  const fence = '`'.repeat(length)
  return `${fence}text\n${text}\n${fence}`
}
const time = (value: number): string => new Date(value).toISOString()

/** Serializes a fixed selection; the download has no dependence on canvas geometry or live records. */
export function renderKnowledgeExport(cards: readonly ExportCard[]): KnowledgeExportResult {
  const parts = ['# Research export / 研究成果', 'Saved card revisions and retained discussion excerpts. / 已保存的卡片修订与讨论摘录。']
  const relations: string[] = []
  cards.forEach(({ cardId, revision, sourceStatuses }, index) => {
    const label = `C${index + 1}`
    parts.push(`## ${label} · ${inline(revision.content.title)}`,
      `- Card / 卡片: ${inline(cardId)}\n- Revision / 修订: ${revision.number} (${inline(revision.revisionId)})\n- Saved / 保存时间: ${time(revision.savedAt)}\n- Status / 状态: ${revision.content.status === 'draft' ? 'Draft / 草稿' : 'Confirmed / 已确认'}\n- Kind / 类型: ${KINDS[revision.content.kind]}`)
    for (const [field, title] of [['question', 'Core question / 核心问题'], ['conclusion', 'Conclusion / 结论'],
      ['rationale', 'Reasons and conditions / 理由与适用条件'], ['openQuestions', 'Open questions / 待验证事项']] as const) {
      parts.push(`### ${title}`, block(revision.content[field]))
    }
    parts.push('### Sources / 来源')
    if (revision.sources.length === 0 && !revision.synthesis?.claims.some(claim => claim.citations.length > 0)) parts.push('No verified sources. Needs manual verification. / 没有已核验来源，需人工验证。')
    revision.sources.forEach((source, sourceIndex) => {
      const sourceLabel = `${label}-S${sourceIndex + 1}`
      parts.push(`#### ${sourceLabel} · ${inline(source.title)}`,
        `- Session / 会话: ${inline(source.sessionId)}\n- Directory / 目录: ${inline(source.cwd ?? '(not recorded / 未记录)')}\n- Events / 事件范围: ${source.source.startSeq}–${source.source.endSeq}\n- ${SOURCE_STATUS[sourceStatuses[sourceIndex] ?? 'unavailable']}\n- Retained excerpt / 保存的来源摘录; only this selected range, not the complete Session / 仅此选定范围，非完整会话。`)
      for (const turn of source.source.turns) {
        parts.push(`##### Turn / 轮次 ${turn.turn} · ${time(turn.startedAt)} · ${turn.startSeq}–${turn.endSeq ?? '?'}`)
        if (turn.endSeq === null) parts.push('Incomplete turn / 轮次不完整。')
        for (const message of turn.messages) parts.push(`**${message.role === 'user' ? 'User / 用户' : 'Assistant / 助手'}** · Event / 事件 ${message.seq}`, block(message.text))
      }
      relations.push(`- ${sourceLabel}: Session ${inline(source.sessionId)} [${source.source.startSeq}–${source.source.endSeq}] → ${label}: Card ${cardId}, revision ${revision.number} (${revision.revisionId}).`)
    })
    if (revision.synthesis !== undefined) {
      parts.push('### Synthesis citations / 综合引用', 'Quotes refer to the frozen material below. Source labels do not include original discussion text. / 引用对应下方冻结材料；来源说明不包含讨论全文。')
      const cited = new Set<number>()
      revision.synthesis.claims.forEach((claim, claimIndex) => {
        parts.push(`#### ${label}-Q${claimIndex + 1} · ${inline(claim.category)}`, block(claim.text))
        if (claim.citations.length === 0) parts.push('Needs verification; no source relation. / 待验证；未建立来源关系。')
        for (const citation of claim.citations) {
          cited.add(citation.materialIndex)
          parts.push(`Quote / 引用 → ${label}-M${citation.materialIndex + 1}`, block(citation.quote))
        }
      })
      parts.push('### Frozen synthesis materials / 冻结的综合材料', 'Later source revisions do not replace these inputs. Uncited inputs do not establish provenance. / 来源后续修订不会替换这些材料；未被引用的输入不建立来源关系。')
      revision.synthesis.materials.forEach((material, materialIndex) => {
        const materialLabel = `${label}-M${materialIndex + 1}`
        if (material.kind === 'card') {
          parts.push(`#### ${materialLabel} · ${inline(material.content.title)}`,
            `- Card / 卡片: ${material.cardId}\n- Revision / 修订: ${material.revisionNumber} (${material.revisionId})\n- Saved / 保存时间: ${time(material.savedAt)}\n- Frozen card text only / 仅此修订的卡片正文。`)
          for (const [field, title] of [['question', 'Core question / 核心问题'], ['conclusion', 'Conclusion / 结论'],
            ['rationale', 'Conditions and evidence / 条件与依据'], ['openQuestions', 'Open questions / 待验证事项']] as const) {
            parts.push(`##### ${title}`, block(material.content[field]))
          }
          if (material.sources.length > 0) parts.push('Source labels only / 仅来源说明', ...material.sources.map(source =>
            `- ${inline(source.title)} · Session ${inline(source.sessionId)} · ${source.startSeq}–${source.endSeq}`))
          if (cited.has(materialIndex)) relations.push(`- ${materialLabel}: Card ${material.cardId}, revision ${material.revisionNumber} (${material.revisionId}) → ${label}: Card ${cardId}. Synthesized from / 综合自。`)
        } else {
          const source = material.source
          parts.push(`#### ${materialLabel} · ${inline(source.title)}`,
            `- Session / 会话: ${inline(source.sessionId)}\n- Events / 事件范围: ${source.source.startSeq}–${source.source.endSeq}\n- Retained selected range, not the complete Session / 冻结的选定范围，非完整会话。`)
          for (const turn of source.source.turns) {
            parts.push(`##### Turn / 轮次 ${turn.turn} · ${turn.startSeq}–${turn.endSeq}`)
            for (const message of turn.messages) parts.push(`**${message.role === 'user' ? 'User / 用户' : 'Assistant / 助手'}**`, block(message.text))
          }
        }
      })
    }
  })
  parts.push('## Source relations / 来源关系', relations.length === 0 ? 'No source relations / 无来源关系。' : relations.join('\n'))
  const title = cards.length === 1 ? Array.from(cards[0]!.revision.content.title.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/gu, '-').replace(/\s*-\s*/gu, '-').replace(/\s+/gu, '-').replace(/^[. -]+|[. -]+$/gu, '')).slice(0, 96).join('') : ''
  return {
    filename: `${title || `research-cards-${cards.length}-${cards[0]!.cardId.slice(0, 8)}`}.md`,
    markdown: `${parts.join('\n\n')}\n`,
    cards: cards.map(({ cardId, revision }) => ({ cardId, revisionId: revision.revisionId, number: revision.number, title: revision.content.title })),
  }
}
