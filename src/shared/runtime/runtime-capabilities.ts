// @ts-nocheck
const DEFAULT_MODAL_ORDER = ['settings-modal', 'filter-modal', 'detail-modal', 'metric-help-modal'];

const queueIdleTask = (callback, { timeout = 1500 } = {}) => {
  if (typeof callback !== 'function') return null;
  if (typeof window === 'undefined') {
    callback();
    return null;
  }
  return 'requestIdleCallback' in window
    ? window.requestIdleCallback(callback, { timeout })
    : window.setTimeout(callback, 0);
};

const cancelIdleTask = (handle) => {
  if (typeof window === 'undefined' || handle == null) return;
  if ('cancelIdleCallback' in window) window.cancelIdleCallback(handle);
  else clearTimeout(handle);
};

const createRuntimeCapabilities = ({
  modalOrder = DEFAULT_MODAL_ORDER,
  closeModalById = () => false
} = {}) => {
  const getModalElement = (modalId) => (
    modalId && typeof document !== 'undefined' ? document.getElementById(modalId) : null
  );

  const isModalVisible = (modalId) => {
    const modal = getModalElement(modalId);
    return Boolean(modal?.open || modal?.classList.contains('visible'));
  };

  const getOpenModalId = () => modalOrder.find(isModalVisible) || '';

  const updateBodyScrollLock = () => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('is-scroll-locked', Boolean(document.querySelector('dialog[open], .modal-overlay.visible')));
  };

  const setModalVisibility = (modalId, isOpen, { initialFocusSelector } = {}) => {
    const modal = getModalElement(modalId);
    if (!modal) return;

    if (isOpen) {
      modal.removeAttribute('hidden');
      modal.removeAttribute('inert');
      if (typeof modal.showModal === 'function' && !modal.open) modal.showModal();
      else modal.setAttribute('open', '');
      modal.classList.add('visible');
      const target = initialFocusSelector && modal.querySelector(initialFocusSelector);
      target?.focus?.({ preventScroll: true });
    } else {
      if (typeof modal.close === 'function' && modal.open) modal.close();
      else modal.removeAttribute('open');
      modal.classList.remove('visible');
      modal.setAttribute('hidden', '');
      modal.setAttribute('inert', '');
    }
    updateBodyScrollLock();
  };

  const handleGlobalEscape = (event) => {
    if (event?.key !== 'Escape') return false;
    const openId = getOpenModalId();
    return openId ? Boolean(closeModalById(openId)) : false;
  };

  return {
    queueIdleTask,
    cancelIdleTask,
    getModalElement,
    isModalVisible,
    getOpenModalId,
    updateBodyScrollLock,
    setModalVisibility,
    handleGlobalEscape
  };
};

export { cancelIdleTask, createRuntimeCapabilities, queueIdleTask };
