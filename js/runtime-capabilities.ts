// @ts-nocheck
const DEFAULT_MODAL_ORDER = ['settings-modal', 'filter-modal', 'detail-modal'];

const createRuntimeCapabilities = ({
  modalFocusState = { activeId: null, lastFocused: null, handler: null },
  modalOrder = DEFAULT_MODAL_ORDER,
  closeModalById = () => false
} = {}) => {
  const queueIdleTask = (callback, { timeout = 1500 } = {}) => {
    if (typeof callback !== 'function') return null;
    if (typeof window === 'undefined') {
      callback();
      return null;
    }
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, { timeout });
    }
    return window.setTimeout(callback, 0);
  };

  const cancelIdleTask = (handle) => {
    if (typeof window === 'undefined' || handle === null || typeof handle === 'undefined') return;
    if ('cancelIdleCallback' in window && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(handle);
      return;
    }
    clearTimeout(handle);
  };

  const getModalElement = (modalId) => {
    if (!modalId || typeof document === 'undefined') return null;
    return document.getElementById(modalId);
  };

  const getModalContent = (modal) => {
    if (!modal) return null;
    return modal.querySelector('.modal-content') || modal;
  };

  const isModalVisible = (modalId) => {
    const modal = getModalElement(modalId);
    return Boolean(modal && modal.classList.contains('visible'));
  };

  const getOpenModalId = () => {
    const openId = modalOrder.find(id => isModalVisible(id));
    return openId || '';
  };

  const updateBodyScrollLock = () => {
    if (typeof document === 'undefined') return;
    const hasOpenModal = Boolean(document.querySelector('.modal-overlay.visible'));
    document.body.classList.toggle('is-scroll-locked', hasOpenModal);
  };

  const isElementVisible = (element) => {
    if (!element) return false;
    return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  };

  const getFocusableElements = (container) => {
    if (!container) return [];
    const selectors = [
      'a[href]',
      'area[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'iframe',
      'object',
      'embed',
      '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    return Array.from(container.querySelectorAll(selectors.join(',')))
      .filter(element => {
        if (!isElementVisible(element)) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        return element.tabIndex >= 0;
      });
  };

  const activateModalFocus = (modalId, { initialFocusSelector } = {}) => {
    const modal = getModalElement(modalId);
    if (!modal) return;
    const content = getModalContent(modal);
    if (!content) return;

    if (modalFocusState.activeId && modalFocusState.activeId !== modalId) {
      deactivateModalFocus(modalFocusState.activeId, { returnFocus: false });
    }

    modalFocusState.activeId = modalId;
    modalFocusState.lastFocused = document.activeElement && typeof document.activeElement.focus === 'function'
      ? document.activeElement
      : null;

    if (!content.hasAttribute('tabindex')) {
      content.setAttribute('tabindex', '-1');
    }

    const preferred = initialFocusSelector ? content.querySelector(initialFocusSelector) : null;
    const focusables = getFocusableElements(content);
    const target = preferred || focusables[0] || content;

    requestAnimationFrame(() => {
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    });

    const handler = (event) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(content);
      if (focusable.length === 0) {
        event.preventDefault();
        content.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!content.contains(active)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    modal.addEventListener('keydown', handler);
    modalFocusState.handler = handler;
  };

  const deactivateModalFocus = (modalId, { returnFocus = true } = {}) => {
    const targetId = modalId || modalFocusState.activeId;
    if (!targetId) return;
    const modal = getModalElement(targetId);

    if (modal && modalFocusState.handler) {
      modal.removeEventListener('keydown', modalFocusState.handler);
    }

    const lastFocused = modalFocusState.lastFocused;
    if (targetId === modalFocusState.activeId) {
      modalFocusState.activeId = null;
      modalFocusState.lastFocused = null;
    }
    modalFocusState.handler = null;

    if (returnFocus && lastFocused && document.contains(lastFocused) && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
  };

  const setModalVisibility = (modalId, isOpen, { initialFocusSelector, returnFocus = true } = {}) => {
    const modal = getModalElement(modalId);
    if (!modal) return;

    modal.classList.toggle('visible', isOpen);
    modal.toggleAttribute('hidden', !isOpen);
    modal.toggleAttribute('inert', !isOpen);

    if (isOpen) {
      activateModalFocus(modalId, { initialFocusSelector });
    } else {
      deactivateModalFocus(modalId, { returnFocus });
    }

    updateBodyScrollLock();
  };

  const handleGlobalEscape = (event) => {
    if (!event || event.key !== 'Escape') return false;
    const openId = getOpenModalId();
    if (!openId) return false;
    return Boolean(closeModalById(openId));
  };

  return {
    queueIdleTask,
    cancelIdleTask,
    getModalElement,
    getModalContent,
    isModalVisible,
    getOpenModalId,
    updateBodyScrollLock,
    isElementVisible,
    getFocusableElements,
    activateModalFocus,
    deactivateModalFocus,
    setModalVisibility,
    handleGlobalEscape
  };
};

export { createRuntimeCapabilities };
