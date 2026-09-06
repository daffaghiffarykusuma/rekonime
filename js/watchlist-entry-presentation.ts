// @ts-nocheck
import {
  buildWatchlistControlModel,
  shouldShowWatchProgress
} from './watchlist-state.js';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const escapeAttr = (value) => escapeHtml(value);

const buildWatchlistEntryPresentationModel = (entry, {
  anime = null,
  episodeCount = null
} = {}) => buildWatchlistControlModel(entry, { anime, episodeCount });

const renderWatchlistControlsHtml = (entry, {
  anime,
  episodeCount,
  escapeHtml: html = escapeHtml,
  escapeAttr: attr = escapeAttr
} = {}) => {
  if (!anime) return '';
  const model = buildWatchlistEntryPresentationModel(entry, { anime, episodeCount });
  const safeId = attr(anime.id);
  const maxAttr = model.inputMax ? `max="${attr(model.inputMax)}"` : '';
  const optionsHtml = model.options.map((option) => {
    const selected = option.selected ? 'selected' : '';
    return `<option value="${attr(option.value)}" ${selected}>${html(option.label)}</option>`;
  }).join('');

  return `
      <div class="detail-watchlist">
        <div class="detail-watchlist-label">
          <span class="detail-watchlist-title">Your watch status</span>
          <span class="detail-watchlist-subtitle">Save progress and pick up where you left off</span>
        </div>
        <div class="detail-watchlist-controls">
          <label class="watchlist-select-wrapper">
            <span class="visually-hidden">Choose your watch status</span>
            <select class="watchlist-select" id="watchlist-select" data-action="watch-status" data-anime-id="${safeId}">
              ${optionsHtml}
            </select>
          </label>
          <div class="watchlist-progress ${model.showProgress ? '' : 'is-hidden'}" id="watchlist-progress">
            <span class="watchlist-progress-label">Episodes watched</span>
            <div class="watchlist-progress-stepper">
              <button class="watchlist-stepper" type="button" data-action="watch-progress-dec" data-anime-id="${safeId}" aria-label="Decrease watched episodes">
                <span aria-hidden="true">-</span>
              </button>
              <input class="watchlist-progress-input" id="watchlist-progress-input" type="number" min="0" step="1" ${maxAttr}
                value="${attr(String(model.progress))}" data-action="watch-progress" data-anime-id="${safeId}" inputmode="numeric" aria-label="Episodes watched">
              <span class="watchlist-progress-total" id="watchlist-progress-total">${html(model.totalText)}</span>
              <button class="watchlist-stepper" type="button" data-action="watch-progress-inc" data-anime-id="${safeId}" aria-label="Increase watched episodes">
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>
          <button class="watchlist-loved-toggle ${model.showLoved ? '' : 'is-hidden'}" type="button"
            data-action="watch-loved" data-anime-id="${safeId}" aria-pressed="${model.loved ? 'true' : 'false'}">
            ${model.loved ? 'Loved it' : 'Mark loved'}
          </button>
        </div>
      </div>
    `;
};

const getEpisodeCountFromItem = (item) => {
  const raw = item?.stats?.episodeCount ?? item?.episodeCount;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const getEpisodeCountFromCard = (card) => {
  if (!card) return null;
  const parsed = Number(card.dataset.episodeCount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const appendOptions = (select, options, status) => {
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === status) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
};

const createWatchlistControlsElement = (item, entry, {
  episodeCount = getEpisodeCountFromItem(item)
} = {}) => {
  const model = buildWatchlistEntryPresentationModel(entry, { anime: item, episodeCount });
  const wrapper = document.createElement('div');
  wrapper.className = 'watchlist-controls';
  wrapper.setAttribute('data-watchlist', 'true');

  const label = document.createElement('div');
  label.className = 'watchlist-controls-label';
  label.textContent = 'Your watch status';
  wrapper.appendChild(label);

  const select = document.createElement('select');
  select.className = 'watchlist-controls-select';
  select.setAttribute('aria-label', `Your watch status for ${item.title}`);
  select.setAttribute('data-action', 'watch-status');
  select.setAttribute('data-anime-id', item.id);
  appendOptions(select, model.options, model.status);
  wrapper.appendChild(select);

  const progressWrap = document.createElement('div');
  progressWrap.className = 'watchlist-controls-progress';
  if (!shouldShowWatchProgress(model.status)) {
    progressWrap.classList.add('is-hidden');
  }

  const progressLabel = document.createElement('span');
  progressLabel.className = 'watchlist-controls-progress-label';
  progressLabel.textContent = 'Episodes watched';
  progressWrap.appendChild(progressLabel);

  const stepper = document.createElement('div');
  stepper.className = 'watchlist-controls-stepper';

  const dec = document.createElement('button');
  dec.type = 'button';
  dec.className = 'watchlist-controls-stepper-btn';
  dec.setAttribute('data-action', 'watch-progress-dec');
  dec.setAttribute('data-anime-id', item.id);
  dec.setAttribute('aria-label', 'Decrease watched episodes');
  dec.textContent = '-';

  const input = document.createElement('input');
  input.className = 'watchlist-controls-input';
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.setAttribute('data-action', 'watch-progress');
  input.setAttribute('data-anime-id', item.id);
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('aria-label', 'Episodes watched');
  input.value = String(model.progress);

  const total = document.createElement('span');
  total.className = 'watchlist-controls-total';

  if (model.episodeCount) {
    input.max = model.inputMax;
    total.textContent = model.totalText;
  }

  const inc = document.createElement('button');
  inc.type = 'button';
  inc.className = 'watchlist-controls-stepper-btn';
  inc.setAttribute('data-action', 'watch-progress-inc');
  inc.setAttribute('data-anime-id', item.id);
  inc.setAttribute('aria-label', 'Increase watched episodes');
  inc.textContent = '+';

  stepper.appendChild(dec);
  stepper.appendChild(input);
  stepper.appendChild(total);
  stepper.appendChild(inc);
  progressWrap.appendChild(stepper);
  wrapper.appendChild(progressWrap);

  const loved = document.createElement('button');
  loved.type = 'button';
  loved.className = 'watchlist-loved-toggle';
  if (!model.showLoved) {
    loved.classList.add('is-hidden');
  }
  loved.setAttribute('data-action', 'watch-loved');
  loved.setAttribute('data-anime-id', item.id);
  loved.setAttribute('aria-pressed', model.loved ? 'true' : 'false');
  loved.textContent = model.loved ? 'Loved it' : 'Mark loved';
  wrapper.appendChild(loved);

  return wrapper;
};

const updateWatchlistControlsElement = (root, entry, {
  anime = null,
  episodeCount = null
} = {}) => {
  if (!root) return false;
  const select = root.querySelector('.watchlist-controls-select, #watchlist-select');
  const progressWrap = root.querySelector('.watchlist-controls-progress, #watchlist-progress');
  const input = root.querySelector('.watchlist-controls-input, #watchlist-progress-input');
  const total = root.querySelector('.watchlist-controls-total, #watchlist-progress-total');
  const loved = root.querySelector('.watchlist-loved-toggle');
  if (!select || !progressWrap || !input) return false;

  const model = buildWatchlistEntryPresentationModel(entry, { anime, episodeCount });
  select.value = model.status;
  progressWrap.classList.toggle('is-hidden', !model.showProgress);
  input.value = String(model.progress);

  if (model.episodeCount) {
    input.setAttribute('max', model.inputMax);
    if (total) total.textContent = model.totalText;
  } else {
    input.removeAttribute('max');
    if (total) total.textContent = '';
  }
  if (loved) {
    loved.classList.toggle('is-hidden', !model.showLoved);
    loved.setAttribute('aria-pressed', model.loved ? 'true' : 'false');
    loved.textContent = model.loved ? 'Loved it' : 'Mark loved';
  }
  return true;
};

export {
  buildWatchlistEntryPresentationModel,
  renderWatchlistControlsHtml,
  createWatchlistControlsElement,
  updateWatchlistControlsElement,
  getEpisodeCountFromItem,
  getEpisodeCountFromCard
};
