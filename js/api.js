/**
 * StreamFlow – API Integration
 * Fetches live data from the backend and replaces static HTML content.
 * Runs after DOM is ready; does not touch nav.js / faq.js / animations.js.
 */

const API_BASE = '';   // same origin – server serves both frontend and API

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

function starRating(r) { return `★ ${r.toFixed(1)}`; }

// ─── Stats strip ──────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const { data } = await apiFetch('/api/stats');
    const items = document.querySelectorAll('.stats__item');
    if (!items.length) return;

    const values = [
      { number: Number(data.total_titles).toLocaleString('pl-PL') + '+', label: 'Tytułów' },
      { number: data.quality,   label: 'Jakość obrazu' },
      { number: data.profiles,  label: 'Profili w planie' },
      { number: data.support,   label: 'Wsparcie techniczne' },
    ];

    items.forEach((el, i) => {
      if (!values[i]) return;
      el.querySelector('.stats__number').textContent = values[i].number;
      el.querySelector('.stats__label').textContent  = values[i].label;
    });
  } catch (e) {
    console.warn('Stats load failed:', e);
  }
}

// ─── Card builder ─────────────────────────────────────────────────────────────

function buildCard(movie, { showRank = false } = {}) {
  const rank    = showRank && movie.rank_pos ? `<span class="card__rank" aria-label="Pozycja ${movie.rank_pos}">#${movie.rank_pos}</span>` : '';
  const badge   = movie.badge ? `<span class="card__badge${movie.is_new ? ' card__badge--new' : ''}">${movie.badge}</span>` : '';
  const tags    = `<span class="tag">${movie.category}</span>`;

  const article = document.createElement('article');
  article.className = 'card'; article.dataset.movieId = movie.id;
  article.setAttribute('role', 'listitem');
  article.setAttribute('tabindex', '0');
  article.setAttribute('aria-label', `${movie.title} – ${movie.category}`);

  article.innerHTML = `
    <div class="card__poster">
      <div class="poster-placeholder ${movie.poster_css}">
        <span class="poster-icon">${movie.poster_icon}</span>
      </div>
      <div class="card__overlay" aria-hidden="true">
        <button class="card__play" aria-label="Odtwórz ${movie.title}" tabindex="-1">▶</button>
      </div>
      ${rank}
      ${badge}
    </div>
    <div class="card__info">
      <div class="card__tags">${tags}</div>
      <h3 class="card__title">${movie.title}</h3>
      <p class="card__meta">${movie.year} · ${movie.duration} · ${starRating(movie.rating)}</p>
    </div>
  `;
  return article;
}

// ─── Trending section ─────────────────────────────────────────────────────────

async function loadTrending() {
  try {
    const { data } = await apiFetch('/api/movies?trending=1');
    const container = document.querySelector('#trending .cards-row');
    if (!container || !data.length) return;

    container.innerHTML = '';
    // sort by rank_pos, then rating
    data
      .sort((a, b) => (a.rank_pos ?? 9999) - (b.rank_pos ?? 9999) || b.rating - a.rating)
      .forEach(movie => container.appendChild(buildCard(movie, { showRank: true })));
  } catch (e) {
    console.warn('Trending load failed:', e);
  }
}

// ─── New releases section ─────────────────────────────────────────────────────

async function loadNewReleases() {
  try {
    const { data } = await apiFetch('/api/movies?new=1');
    const container = document.querySelector('#new .cards-row');
    if (!container || !data.length) return;

    container.innerHTML = '';
    data.forEach(movie => container.appendChild(buildCard(movie)));
  } catch (e) {
    console.warn('New releases load failed:', e);
  }
}

// ─── Categories section ───────────────────────────────────────────────────────

async function loadCategories() {
  try {
    const { data } = await apiFetch('/api/categories');
    const grid = document.querySelector('.categories-grid');
    if (!grid || !data.length) return;

    // Map category name → existing BEM modifier (keeps CSS working)
    const modifierMap = {
      'Akcja':    'action',
      'Dramat':   'drama',
      'Komedia':  'comedy',
      'Sci-Fi':   'scifi',
      'Horror':   'horror',
      'Dokumenty':'doc',
    };

    grid.innerHTML = '';
    data.forEach(cat => {
      const mod = modifierMap[cat.name] || cat.name.toLowerCase();
      const count = Number(cat.count).toLocaleString('pl-PL');
      const a = document.createElement('a');
      a.href = `#trending`;
      a.className = `category-card category-card--${mod}`;
      a.setAttribute('role', 'listitem');
      a.setAttribute('aria-label', cat.name);
      a.innerHTML = `
        <span class="category-card__icon" aria-hidden="true">${cat.icon}</span>
        <span class="category-card__name">${cat.name}</span>
        <span class="category-card__count">${count} tytułów</span>
      `;
      grid.appendChild(a);
    });
  } catch (e) {
    console.warn('Categories load failed:', e);
  }
}

// ─── Pricing section ──────────────────────────────────────────────────────────

async function loadPlans() {
  try {
    const { data } = await apiFetch('/api/plans');
    const grid = document.querySelector('.pricing-grid');
    if (!grid || !data.length) return;

    grid.innerHTML = '';
    data.forEach(plan => {
      const isFeatured = plan.featured === 1;
      const article = document.createElement('article');
      article.className = `pricing-card${isFeatured ? ' pricing-card--featured' : ''}`;
      article.setAttribute('role', 'listitem');
      article.setAttribute('aria-label', `Plan ${plan.name}${isFeatured ? ' – polecany' : ''}`);

      const ribbon = isFeatured
        ? `<div class="pricing-card__ribbon" aria-label="Polecany plan">Najpopularniejszy</div>` : '';

      const featuresHtml = plan.features.map(f => `
        <li class="feature feature--${f.included ? 'yes' : 'no'}">${f.text}</li>
      `).join('');

      const btnClass = isFeatured ? 'btn--primary' : 'btn--outline';

      article.innerHTML = `
        ${ribbon}
        <div class="pricing-card__header">
          <h3 class="pricing-card__name">${plan.name}</h3>
          <div class="pricing-card__price">
            <span class="pricing-card__amount">${plan.price}</span>
            <span class="pricing-card__currency">zł/mies.</span>
          </div>
        </div>
        <ul class="pricing-card__features" role="list" aria-label="Funkcje planu ${plan.name}">
          ${featuresHtml}
        </ul>
        <a href="#" class="btn ${btnClass} btn--block">Wybierz plan</a>
      `;
      grid.appendChild(article);
    });
  } catch (e) {
    console.warn('Plans load failed:', e);
  }
}

// ─── Hero featured movie ──────────────────────────────────────────────────────

async function loadHeroMovie() {
  try {
    // fetch the hero movie (id=11 = "Ostatni Sygnał" in seed data, rank_pos=null but poster--hero)
    const { data } = await apiFetch('/api/movies?q=Ostatni Sygnał');
    const movie = data?.[0];
    if (!movie) return;

    const heroCard = document.querySelector('.hero__featured-card');
    if (!heroCard) return;

    heroCard.querySelector('.poster-placeholder').className = `poster-placeholder ${movie.poster_css}`;
    heroCard.querySelector('.poster-icon').textContent      = movie.poster_icon;
    heroCard.querySelector('.tag').textContent              = movie.category;
    heroCard.querySelector('h3').textContent                = movie.title;
    heroCard.querySelector('p').textContent                 = `${movie.year} · ${movie.duration} · ${starRating(movie.rating)}`;
  } catch (e) {
    console.warn('Hero movie load failed:', e);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadTrending();
  loadNewReleases();
  loadCategories();
  loadPlans();
  loadHeroMovie();
});