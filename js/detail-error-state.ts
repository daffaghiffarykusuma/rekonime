// @ts-nocheck

const DETAIL_ERROR_MESSAGES = {
  catalog: 'We could not find that anime in the current catalog.',
  deepLink: 'We could not find that anime. The link may be outdated or the catalog may have changed.'
};

const renderDetailErrorState = ({ reason = 'catalog' } = {}) => {
  const message = DETAIL_ERROR_MESSAGES[reason] || DETAIL_ERROR_MESSAGES.catalog;
  return `
    <div class="error-message">
      <h2>That title is not available</h2>
      <p>${message}</p>
      <button class="btn btn-primary detail-close-button" data-action="close-detail">Back to browsing</button>
    </div>
  `;
};

export {
  DETAIL_ERROR_MESSAGES,
  renderDetailErrorState
};
