// @ts-nocheck

const createWatchlistAiringDashboardAdapter = ({
  cancelTask = null,
  controllerOptions = {},
  logger = null,
  loadDashboardFactory = async () => import('./airing-dashboard.ts')
    .then((module) => module.createAiringDashboardController),
  queueTask,
  windowRef = typeof window !== 'undefined' ? window : null
}) => {
  let dashboardModulePromise = null;
  let dashboardControllerPromise = null;
  let dashboardUpdateHandle = null;

  const cancelScheduledUpdate = () => {
    if (!dashboardUpdateHandle) return;
    if (cancelTask) {
      cancelTask(dashboardUpdateHandle);
    } else if (
      windowRef
      && 'cancelIdleCallback' in windowRef
      && typeof dashboardUpdateHandle === 'number'
    ) {
      windowRef.cancelIdleCallback(dashboardUpdateHandle);
    } else {
      clearTimeout(dashboardUpdateHandle);
    }
    dashboardUpdateHandle = null;
  };

  const loadAiringDashboardFactory = async () => {
    if (dashboardModulePromise) return dashboardModulePromise;
    dashboardModulePromise = loadDashboardFactory()
      .catch((error) => {
        dashboardModulePromise = null;
        throw error;
      });
    return dashboardModulePromise;
  };

  const getAiringDashboardController = async () => {
    if (dashboardControllerPromise) return dashboardControllerPromise;
    dashboardControllerPromise = loadAiringDashboardFactory()
      .then((createAiringDashboardController) => createAiringDashboardController({
        sectionId: 'airing-dashboard-section',
        subtitleId: 'airing-dashboard-subtitle',
        summaryId: 'airing-dashboard-summary',
        gridId: 'airing-dashboard-grid',
        emptyId: 'airing-dashboard-empty',
        hideWhenNoEntries: true,
        ...controllerOptions
      }))
      .catch((error) => {
        dashboardControllerPromise = null;
        throw error;
      });
    return dashboardControllerPromise;
  };

  const resolveScheduledValue = (value) => (
    typeof value === 'function' ? value() : value
  );

  const scheduleUpdate = (entries, animeItems, { timeout = 2500 } = {}) => {
    cancelScheduledUpdate();

    dashboardUpdateHandle = queueTask(async () => {
      dashboardUpdateHandle = null;
      try {
        const controller = await getAiringDashboardController();
        await controller.update({
          entries: resolveScheduledValue(entries),
          animeItems: resolveScheduledValue(animeItems)
        });
      } catch (error) {
        logger?.warn?.('Failed to update airing dashboard', { error });
      }
    }, timeout);

    return dashboardUpdateHandle;
  };

  return {
    cancelScheduledUpdate,
    getAiringDashboardController,
    loadAiringDashboardFactory,
    scheduleUpdate
  };
};

export { createWatchlistAiringDashboardAdapter };
