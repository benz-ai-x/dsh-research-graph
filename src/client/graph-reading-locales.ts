/** Labels for reading Session relationships without changing their retained history. */
export const graphReadingZh = {
  'node.branch': '分支',
  'node.merge': '汇聚 · {count} 来源',
  'node.identity': '讨论标识：{id}',
  'node.viewed': '输入会话',
  'cluster.summary': '分支簇 · {count}',
  'legend.cluster': '圆点：分支簇配色',
  'legend.clusterHint': '分支簇共用配色，独立讨论使用中性色；颜色可能重复，请结合分组和关系辨认。运行状态在详情中单独显示。',
  'panel.inheritedMergeSources': '继承的汇聚来源 · {count}',
  'panel.inheritedMergeHint': '这些来源快照随分支历史继承。直接汇聚关系归属于原始汇聚会话。',
  'panel.subagentSummary': '{count} 个子代理 · {running} 个运行中',
  'panel.subagentHint': '子代理任务折叠在所属讨论下。选择一项可打开其会话查看执行过程。',
  'panel.subagentOpenError': '暂时无法打开子代理，请重试；也可打开所属会话查看任务。',
  'panel.unnamedSubagent': '未命名子代理',
  'panel.subagentIdle': '当前未运行',
  'toolbar.relayoutHint': '按来源、汇聚和分支收拢排列，保留折叠状态；可撤销。',
} as const

export type GraphReadingKey = keyof typeof graphReadingZh

export const graphReadingEn: Record<GraphReadingKey, string> = {
  'node.branch': 'Branch',
  'node.merge': 'Merge · {count} sources',
  'node.identity': 'Discussion ID: {id}',
  'node.viewed': 'Input session',
  'cluster.summary': 'Branch · {count}',
  'legend.cluster': 'Dots: Branch cluster colors',
  'legend.clusterHint': 'Branch clusters share a color; independent discussions are neutral. Colors may repeat, so use groups and relations to identify them. Activity is shown separately in details.',
  'panel.inheritedMergeSources': 'Inherited Merge sources · {count}',
  'panel.inheritedMergeHint': 'These source snapshots were inherited with Branch history. Direct Merge Relations belong to the original Merge Session.',
  'panel.subagentSummary': '{count} subagents · {running} running',
  'panel.subagentHint': 'Delegated tasks stay folded under their discussion. Choose one to open its session and inspect its work.',
  'panel.subagentOpenError': 'Unable to open this subagent. Retry, or open its parent discussion to inspect the task.',
  'panel.unnamedSubagent': 'Untitled subagent',
  'panel.subagentIdle': 'Not running',
  'toolbar.relayoutHint': 'Arrange sources, Merges, and Branches compactly, preserving collapsed clusters. Can be undone.',
}
