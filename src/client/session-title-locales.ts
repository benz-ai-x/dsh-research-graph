export const titleZh = {
  'title.generate': '生成标题', 'title.generating': '正在生成标题…', 'title.regenerate': '重新生成标题',
  'title.review': '建议标题', 'title.hint': '可编辑，应用后同步到会话。',
  'title.apply': '应用标题', 'title.saving': '正在应用…', 'title.cancel': '取消', 'title.saved': '标题已更新',
  'title.empty': '暂无可生成标题的对话内容。', 'title.error': '标题生成失败，请重试。',
  'title.errorRoute': '此会话没有可用的模型，请配置兜底模型后重试。',
  'title.errorLimit': '标题生成达到输出上限，请重试或调整插件输出上限。',
  'title.saveError': '标题未确认保存，请重试；建议内容已保留。',
  'title.changed': '会话标题已在其他位置更新，请重新生成后再应用。',
} as const
export type SessionTitleKey = keyof typeof titleZh
export const titleEn: Record<SessionTitleKey, string> = {
  'title.generate': 'Generate title', 'title.generating': 'Generating title…', 'title.regenerate': 'Regenerate title',
  'title.review': 'Suggested title', 'title.hint': 'Edit before applying to the Session.',
  'title.apply': 'Apply title', 'title.saving': 'Applying…', 'title.cancel': 'Cancel', 'title.saved': 'Title updated',
  'title.empty': 'No discussion content to name yet.', 'title.error': 'Could not generate a title. Try again.',
  'title.errorRoute': 'This Session has no usable model. Configure a fallback model and try again.',
  'title.errorLimit': 'Title generation reached the output limit. Retry or adjust the plugin output limit.',
  'title.saveError': 'The title could not be confirmed as saved. Your suggestion is kept; try again.',
  'title.changed': 'The Session title changed elsewhere. Generate a new suggestion before applying.',
}
