// Local delta vs upstream: native Session ZIP download with a Workspace-aware backup filename.
import { IconDownloadOutlineRegular, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import type { BackupSessionInjected, SessionMenuItemProps } from '../contract/slots.ts'

export function BackupSessionMenuItem({
  sessionId, displayTitle, useMenuOpenState, downloadBackup, t,
}: SessionMenuItemProps<BackupSessionInjected>) {
  const [, setMenuOpen] = useMenuOpenState()
  return (
    <MenuItemButton
      icon={<IconDownloadOutlineRegular />}
      onSelect={() => {
        setMenuOpen(false)
        downloadBackup(sessionId, displayTitle)
      }}
    >
      {t('menu.backupSession')}
    </MenuItemButton>
  )
}
