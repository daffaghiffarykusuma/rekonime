// @ts-nocheck
import { setHTML } from './security/trusted-types.js';

const renderUnavailableReviews = () => `
  <div class="community-reviews">
    <h3>Community Reviews</h3>
    <p class="no-reviews">Reviews are unavailable for this title.</p>
  </div>
`;

const renderFailedReviews = () => `
  <div class="community-reviews">
    <h3>Community Reviews</h3>
    <p class="no-reviews">Failed to load community reviews.</p>
  </div>
`;

const createDetailReviewsAdapter = ({
  getCurrentAnimeId,
  getLogger,
  loadReviewsService,
  renderSynopsis,
  updateMetaForAnime
}) => {
  const updateSynopsis = (synopsisSection, reviewsService, description, fallbackSynopsis = '') => {
    if (!synopsisSection) return;
    if (description) {
      setHTML(synopsisSection, reviewsService.renderSynopsis(description));
    } else if (fallbackSynopsis) {
      setHTML(synopsisSection, reviewsService.renderSynopsis(fallbackSynopsis));
    } else {
      synopsisSection.replaceChildren();
    }
  };

  const load = async (anime, fallbackSynopsis = '') => {
    const reviewsSection = document.getElementById('community-reviews-section');
    const synopsisSection = document.getElementById('synopsis-section');
    const parsedMalId = Number.parseInt(anime?.malId, 10);

    if (!Number.isFinite(parsedMalId)) {
      if (synopsisSection) {
        if (fallbackSynopsis) {
          setHTML(synopsisSection, renderSynopsis(fallbackSynopsis));
        } else {
          synopsisSection.replaceChildren();
        }
      }
      if (reviewsSection) {
        setHTML(reviewsSection, renderUnavailableReviews());
      }
      return;
    }

    try {
      const reviewsService = await loadReviewsService();
      const data = await reviewsService.fetchReviews(parsedMalId, anime.title);

      if (getCurrentAnimeId() !== anime.id) {
        return;
      }

      updateSynopsis(synopsisSection, reviewsService, data.description, fallbackSynopsis);

      if (reviewsSection) {
        setHTML(reviewsSection, reviewsService.renderReviewsSection(data, 'positive'));
        reviewsService.initTabSwitching(data);
      }

      if (data.description) {
        updateMetaForAnime(anime, data.description);
      }
    } catch (error) {
      const logger = getLogger();
      if (logger?.error) {
        logger.error('Failed to load reviews', { error });
      } else {
        console.error('Failed to load reviews:', error);
      }

      if (synopsisSection && !fallbackSynopsis) {
        synopsisSection.replaceChildren();
      }

      if (reviewsSection) {
        let errorMarkup = renderFailedReviews();
        try {
          const reviewsService = await loadReviewsService();
          errorMarkup = reviewsService.renderReviewsSection(
            { positive: [], neutral: [], negative: [], description: '', error: true },
            'positive'
          );
        } catch (loadError) {
          // Keep generic markup.
        }
        setHTML(reviewsSection, errorMarkup);
      }
    }
  };

  return { load };
};

export {
  createDetailReviewsAdapter,
  renderFailedReviews,
  renderUnavailableReviews
};
