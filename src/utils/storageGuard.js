const QUOTA_WARN_THRESHOLD = 0.8;

export async function requestPersistentStorage(addToast) {
  if (!navigator.storage) return;

  const isPersisted = await navigator.storage.persisted();
  if (isPersisted) return;

  const granted = await navigator.storage.persist();
  if (!granted) {
    addToast({
      type: 'warning',
      title: 'Dữ liệu có thể bị mất',
      message: 'Trình duyệt có thể tự xóa dữ liệu cuộc họp khi thiếu dung lượng. Hãy bookmark trang này để bảo vệ dữ liệu.',
      duration: 10000,
    });
  }
}

export async function checkStorageQuota(addToast) {
  if (!navigator.storage?.estimate) return;

  const { quota, usage } = await navigator.storage.estimate();
  if (!quota) return;

  const percent = usage / quota;
  if (percent >= QUOTA_WARN_THRESHOLD) {
    const usedMB = Math.round(usage / 1024 / 1024);
    const totalMB = Math.round(quota / 1024 / 1024);
    addToast({
      type: 'warning',
      title: 'Dung lượng sắp đầy',
      message: `Đang dùng ${usedMB}MB / ${totalMB}MB (${Math.round(percent * 100)}%). Hãy xóa bớt cuộc họp cũ để tránh mất dữ liệu.`,
      duration: 12000,
    });
  }
}
