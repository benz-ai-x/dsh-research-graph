import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import {
  Button, fileSizeText, IconChevronDownOutlineRegular, IconFolderCloseRegular,
  IconUploadOutlineMedium, IconUploadOutlineRegular, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { HocShare, InjectFace, PropsLocale, PropsRenderFactories, PropsRuntime, SlotMap } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-remote-access/client'
import type { SessionBackupFailureReason, SessionBackupResult } from '../session-backup.ts'
import type { SessionBackupUploadProgress } from './session-backup-upload.ts'
import type { SessionBackupKey } from './session-backup-locales.ts'
import css from './SessionBackup.module.css'

export type SessionBackupOutcome =
  | { readonly ok: true; readonly result: SessionBackupResult }
  | {
    readonly ok: false
    readonly reason: SessionBackupFailureReason | 'upload-failed' | 'unknown'
    readonly message: string
    readonly limit?: number
  }

export interface SessionBackupInjected {
  readonly importArchive: (
    file: File,
    workspaceId: WorkspaceId,
    onProgress: (progress: SessionBackupUploadProgress) => void,
    signal: AbortSignal,
  ) => Promise<SessionBackupOutcome>
  readonly openSession: (sessionId: SessionId) => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    sessionBackup: SessionBackupKey
  }
}

export type SessionBackupActionProps =
  PropsRuntime<'sidebar.session.action'>
  & HocShare<SlotMap['sidebar.session.action']>
  & PropsRenderFactories
  & InjectFace<SessionBackupInjected>
  & PropsLocale<'sessionBackup'>

type Translate = SessionBackupActionProps['t']

export function SessionBackupAction(props: SessionBackupActionProps) {
  const { wide, useRemoteAccess, t, children } = props
  const allowed = useRemoteAccess('sessionGraphBackup/limits')
  const [open, setOpen] = useState(false)
  if (!allowed) return children
  return (
    <>
      {children}
      <Tooltip label={t('action.label')} delayMs={500} side={wide ? 'bottom' : 'right'}>
        <button
          type="button"
          className={clsx(css.trigger, wide && css.wide)}
          aria-label={t('action.label')}
          onClick={() => { setOpen(true) }}
        >
          {wide ? <IconUploadOutlineMedium size={14} /> : <IconUploadOutlineRegular size={18} />}
        </button>
      </Tooltip>
      {open && <SessionBackupDialog {...props} onClose={() => { setOpen(false) }} />}
    </>
  )
}

type DialogState =
  | { readonly phase: 'editing'; readonly error: string | null }
  | { readonly phase: 'running'; readonly progress: SessionBackupUploadProgress }
  | { readonly phase: 'done'; readonly result: SessionBackupResult; readonly workspace: string }

function SessionBackupDialog({
  importArchive, openSession, renderFactorySlot, useSessions, useWorkspaces, onClose, t,
}: SessionBackupActionProps & { readonly onClose: () => void }) {
  const workspaces = useWorkspaces(state => state.items)
  const currentSessionId = useSessions(state => Object.values(state.byId)
    .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id)
  const [file, setFile] = useState<File | null>(null)
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | undefined>(
    () => workspaces.find(workspace => currentSessionId !== undefined && workspace.sessionIds.includes(currentSessionId))?.workspaceId as WorkspaceId | undefined,
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [state, setState] = useState<DialogState>({ phase: 'editing', error: null })
  const fileInput = useRef<HTMLInputElement>(null)
  const workspaceButton = useRef<HTMLButtonElement>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])
  const workspace = workspaces.find(item => item.workspaceId === workspaceId)
  const running = state.phase === 'running'
  const close = () => {
    request.current?.abort()
    onClose()
  }
  const submit = (chosen: File, target: (typeof workspaces)[number]) => {
    const controller = new AbortController()
    request.current = controller
    setState({ phase: 'running', progress: { phase: 'uploading', fraction: 0 } })
    void importArchive(chosen, target.workspaceId as WorkspaceId, progress => {
      if (!controller.signal.aborted) setState({ phase: 'running', progress })
    }, controller.signal).then(outcome => {
      if (controller.signal.aborted) return
      setState(outcome.ok
        ? { phase: 'done', result: outcome.result, workspace: target.title }
        : { phase: 'editing', error: failureText(outcome, t) })
    }, (error: unknown) => {
      if (controller.signal.aborted) return
      setState({ phase: 'editing', error: t('error.unknown', { message: error instanceof Error ? error.message : String(error) }) })
    })
  }
  if (state.phase === 'done') {
    const { result } = state
    return (
      <Modal
        open
        onClose={close}
        closeLabel={t('dialog.close')}
        title={t('dialog.title')}
        footer={(
          <>
            <Button variant="outline" onClick={close}>{t('dialog.done')}</Button>
            <Button variant="primary" onClick={() => { openSession(result.rootSessionId as SessionId); close() }}>
              {t('dialog.open')}
            </Button>
          </>
        )}
      >
        <div className={css.summary} role="status">
          <p>{t('result.restored', { count: String(result.importedSessionIds.length), name: state.workspace, attachments: String(result.attachmentCount) })}</p>
          {result.existingSessionIds.length > 0 && <p>{t('result.existing', { count: String(result.existingSessionIds.length) })}</p>}
          {result.partial && <p className={css.partial}>{t('result.partial', { message: result.error ?? '' })}</p>}
        </div>
      </Modal>
    )
  }
  const progressText = state.phase === 'running' ? runningText(state.progress, t) : t('dialog.import')
  return (
    <Modal
      open
      onClose={close}
      closeLabel={t('dialog.close')}
      title={t('dialog.title')}
      description={t('dialog.description')}
      footer={(
        <>
          <Button variant="outline" onClick={close}>{t('dialog.cancel')}</Button>
          <Button
            variant="primary"
            disabled={running || file === null || workspace === undefined}
            onClick={() => {
              if (!running && file !== null && workspace !== undefined) submit(file, workspace)
            }}
          >
            {progressText}
          </Button>
        </>
      )}
    >
      <div className={css.fields}>
        <div className={css.field}>
          <span className={css.label}>{t('dialog.file')}</span>
          <div className={css.value}>
            {file !== null && <span className={css.fileName} title={file.name}>{file.name}</span>}
            {file !== null && <span className={css.fileSize}>{fileSizeText(file.size)}</span>}
            <Button
              variant="outline"
              disabled={running}
              data-modal-autofocus
              onClick={() => { fileInput.current?.click() }}
            >
              {file === null ? t('dialog.chooseFile') : t('dialog.changeFile')}
            </Button>
            <input
              ref={fileInput}
              className={css.hiddenInput}
              type="file"
              accept=".zip,application/zip"
              aria-label={t('dialog.file')}
              tabIndex={-1}
              onChange={event => {
                const chosen = event.target.files?.[0]
                if (chosen !== undefined) {
                  setFile(chosen)
                  setState({ phase: 'editing', error: null })
                }
                event.target.value = ''
              }}
            />
          </div>
        </div>
        <div className={css.field}>
          <span className={css.label}>{t('dialog.workspace')}</span>
          <div className={css.value}>
            <button
              ref={workspaceButton}
              type="button"
              className={css.workspaceButton}
              disabled={running}
              aria-haspopup="menu"
              aria-expanded={pickerOpen}
              title={workspace?.path}
              onClick={() => { setPickerOpen(open => !open) }}
            >
              <IconFolderCloseRegular size={16} />
              <span className={css.workspaceTitle}>{workspace?.title ?? t('dialog.chooseWorkspace')}</span>
              <IconChevronDownOutlineRegular size={14} />
            </button>
            {renderFactorySlot('workspace.picker', {
              open: pickerOpen,
              anchorRef: workspaceButton,
              selectedId: workspaceId,
              onPick: id => {
                setWorkspaceId(id as WorkspaceId)
                setPickerOpen(false)
                setState({ phase: 'editing', error: null })
              },
              onClose: () => { setPickerOpen(false) },
            })}
          </div>
        </div>
      </div>
      {state.phase === 'running' && <ProgressBar progress={state.progress} label={progressText} />}
      {state.phase === 'editing' && state.error !== null && <div className={css.error} role="alert">{state.error}</div>}
    </Modal>
  )
}

function runningText(progress: SessionBackupUploadProgress, t: Translate): string {
  switch (progress.phase) {
    case 'uploading': return t('dialog.uploading', { percent: String(Math.floor(progress.fraction * 100)) })
    case 'reading': return t('dialog.reading')
    case 'writing': return t('dialog.writing', { done: String(progress.done), total: String(progress.total) })
  }
}

function ProgressBar({ progress, label }: { readonly progress: SessionBackupUploadProgress; readonly label: string }) {
  const value = progress.phase === 'uploading'
    ? { value: progress.fraction, max: 1 }
    : progress.phase === 'writing' ? { value: progress.done, max: progress.total } : {}
  return <progress className={css.progress} aria-label={label} {...value} />
}

function failureText(outcome: Extract<SessionBackupOutcome, { ok: false }>, t: Translate): string {
  if (outcome.reason === 'unknown' || outcome.reason === 'upload-failed') {
    return t(outcome.reason === 'unknown' ? 'error.unknown' : 'error.upload-failed', { message: outcome.message })
  }
  return t(`error.${outcome.reason}`, { message: outcome.message, limit: outcome.limit === undefined ? '' : fileSizeText(outcome.limit) })
}
