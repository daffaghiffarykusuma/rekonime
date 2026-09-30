import { CacheManager } from '../../shared/services/cache-manager.ts';

const BACKUP_EXPORT_KEY = 'rekonime.lastBackupExport';
const updateBackupStatus = () => {
  const timestamp = CacheManager.getJSON(BACKUP_EXPORT_KEY, { fallback: null });
  const label = typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0
    ? `Last export requested: ${new Date(timestamp).toLocaleString()}. Keep the downloaded file somewhere safe.`
    : 'No backup export recorded in this browser.';
  const documentRef = (globalThis as any).document;
  documentRef?.querySelectorAll('[data-backup-status]').forEach((element: any) => { element.textContent = label; });
};
const recordBackupExport = () => {
  CacheManager.setJSON(BACKUP_EXPORT_KEY, Date.now());
  updateBackupStatus();
};
export { recordBackupExport, updateBackupStatus };
