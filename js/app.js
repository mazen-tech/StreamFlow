/**
 * StreamFlow – app.js
 * Enhances the landing page with:
 *  • Search overlay (live API search)
 *  • Movie detail modal (fetches /api/movies/<id> or uses card data)
 *  • Fake video player overlay (realistic UI)
 *  • Login / Register modal
 *  • My List (localStorage watchlist)
 *  • Card click → detail modal (all .card elements)
 *  • Hash routing: #watch/ID opens player directly
 *  • Toast notifications
 */

(function () {
  'use strict';

  /* ─── State ────────────────────────────────────────────────────────────── */
  let myList    = JSON.parse(localStorage.getItem('sf_mylist') || '[]');
  let playerTimer = null;
  let playerSeconds = 0;
  let playerDuration = 0;
  let playerPaused = false;
  let currentMovie = null;

  // User session – persisted in localStorage
  let currentUser = JSON.parse(localStorage.getItem('sf_user') || 'null');

  // Avatar colour palette – deterministic from name
  const AVATAR_COLORS = [
    ['#e50914','#ff6b6b'], ['#7c3aed','#c084fc'],
    ['#0369a1','#38bdf8'], ['#065f46','#34d399'],
    ['#92400e','#fbbf24'], ['#be185d','#f472b6'],
  ];
  function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function initials(name) {
    return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0,2).join('');
  }

  // Fallback descriptions for movies loaded from static HTML (no API description)
  const DESCRIPTIONS = {
    'Cień Północy':    'W mrocznym mieście detektyw Marek Wiśniewski odkrywa spisek sięgający najwyższych szczebli władzy. Serial nagrodzony za reżyserię i zdjęcia.',
    'Głębina':         'Ekipa badaczy morskich odnajduje na dnie oceanu sygnał nieznanego pochodzenia. Napięcie rośnie z każdą minutą tego trzymającego w napięciu thrillera Sci-Fi.',
    'Rok Wilka':       'Powieść inicjacyjna o grupie przyjaciół, których życie zmienia jedno lato na mazurskiej wsi. Dramat nagrodzony na festiwalu w Gdyni.',
    'Poza Zasięgiem':  'Agent wywiadu traci łączność podczas misji w Azji Centralnej. Musi przeżyć samotnie, ścigany przez dwie strony konfliktu.',
    'Kod Zero':        'Hakerzy wykrywają lukę w systemach krytycznej infrastruktury. Wyścig z czasem zanim ktoś ją wykorzysta. Serial technologiczny roku 2024.',
    'Burza Doskonała': 'Gdy huragan uderza w małe miasteczko, mieszkańcy muszą stawić czoła nie tylko żywiołowi, ale i własnym sekretom.',
    'Widmo Miasta':    'Komisarz Nowak bada serię zbrodni w Warszawie, które łączy jedna litera zostawiana na miejscu każdego zdarzenia.',
    'Milczące Wody':   'Pisarka wyjeżdża nad jezioro, by skończyć powieść. Zamiast tego wplątuje się w historię, której finał jeszcze się nie napisał.',
    'Piąty Element':   'Dokument o badaczach, którzy poświęcili życie odkrywaniu piątego stanu materii. Fascynujące połączenie nauki i ludzkiej pasji.',
    'Ostatnie Słowa':  'Komedia o trzech przyjaciołach, którzy zakładają podcast o kulturze śmierci i przypadkowo stają się influencerami.',
    'Ostatni Sygnał':  'Astronautka odbiera sygnał, który nie powinien istnieć. Thriller kosmiczny utrzymujący w napięciu do ostatniej sekundy.',
  };

  /* ─── Helpers ──────────────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }

  function showToast(msg, type = '') {
    const t = $('toast');
    t.textContent = msg;
    t.className   = 'toast' + (type ? ' ' + type : '');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }

  function lockScroll()   { document.body.style.overflow = 'hidden'; }
  function unlockScroll() { document.body.style.overflow = ''; }

  function fmtTime(secs) {
    const m = Math.floor(secs / 60);
    const s = String(Math.floor(secs % 60)).padStart(2, '0');
    return `${m}:${s}`;
  }

  /* ─── My List ──────────────────────────────────────────────────────────── */
  function saveList() {
    localStorage.setItem('sf_mylist', JSON.stringify(myList));
    updateListCount();
    renderListPanel();
    // refresh dropdown badge if visible
    const badge = document.querySelector('.sf-dropdown__count');
    if (badge) badge.textContent = myList.length;
  }

  function updateListCount() {
    $('myListCount').textContent = myList.length;
  }

  function isInList(id) {
    return myList.some(m => m.id === id);
  }

  function toggleList(movie) {
    if (isInList(movie.id)) {
      myList = myList.filter(m => m.id !== movie.id);
      showToast(`Usunięto z listy: ${movie.title}`);
    } else {
      myList.push(movie);
      showToast(`Dodano do listy: ${movie.title}`, 'success');
    }
    saveList();
    // Update modal button if open
    if (currentMovie && currentMovie.id === movie.id) {
      updateModalListBtn(movie.id);
    }
  }

  function updateModalListBtn(id) {
    const btn = $('modalListBtn');
    if (!btn) return;
    if (isInList(id)) {
      btn.textContent = '✓ W mojej liście';
      btn.classList.add('added');
    } else {
      btn.textContent = '＋ Moja lista';
      btn.classList.remove('added');
    }
  }

  function renderListPanel() {
    const body = $('myListBody');
    if (!myList.length) {
      body.innerHTML = '<p class="mylist-panel__empty">Lista jest pusta.<br/>Dodaj tytuły klikając ＋ Moja lista.</p>';
      return;
    }
    body.innerHTML = myList.map(m => `
      <div class="mylist-item" data-id="${m.id}" tabindex="0" role="button" aria-label="Otwórz ${m.title}">
        <span class="mylist-item__icon">${m.poster_icon || '🎬'}</span>
        <div class="mylist-item__info">
          <div class="mylist-item__title">${m.title}</div>
          <div class="mylist-item__meta">${m.year || ''} · ${m.category || ''} · ★ ${m.rating || ''}</div>
        </div>
        <button class="mylist-item__remove" data-id="${m.id}" aria-label="Usuń ${m.title}">✕</button>
      </div>
    `).join('');

    // click to open detail
    body.querySelectorAll('.mylist-item').forEach(el => {
      el.addEventListener('click', function(e) {
        if (e.target.classList.contains('mylist-item__remove')) return;
        const id = this.dataset.id;
        const m  = myList.find(x => String(x.id) === String(id));
        if (m) {
          closeListPanel();
          openMovieModal(m);
        }
      });
    });

    // remove buttons
    body.querySelectorAll('.mylist-item__remove').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const m  = myList.find(x => String(x.id) === String(id));
        if (m) toggleList(m);
      });
    });
  }

  /* My List Panel */
  $('myListBtn').addEventListener('click', () => {
    $('myListPanel').classList.add('open');
    lockScroll();
  });
  function closeListPanel() {
    $('myListPanel').classList.remove('open');
    unlockScroll();
  }
  $('myListClose').addEventListener('click', closeListPanel);

  /* ─── Search Overlay ────────────────────────────────────────────────────── */
  function openSearch() {
    $('searchOverlay').classList.add('open');
    lockScroll();
    setTimeout(() => $('searchInput').focus(), 120);
  }
  function closeSearch() {
    $('searchOverlay').classList.remove('open');
    unlockScroll();
    $('searchResults').innerHTML = '';
    $('searchInput').value = '';
  }

  $('searchOpenBtn').addEventListener('click', openSearch);
  $('searchCloseBtn').addEventListener('click', closeSearch);
  $('heroWatchBtn')  && $('heroWatchBtn').addEventListener('click', () => { openSearch(); });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if ($('playerOverlay').classList.contains('open')) { closePlayer(); return; }
      if ($('movieModalBackdrop').classList.contains('open')) { closeMovieModal(); return; }
      if ($('loginModalBackdrop').classList.contains('open')) { closeLogin(); return; }
      if ($('searchOverlay').classList.contains('open')) { closeSearch(); return; }
      if ($('myListPanel').classList.contains('open')) { closeListPanel(); return; }
    }
  });

  let searchDebounce = null;
  $('searchInput').addEventListener('input', function() {
    clearTimeout(searchDebounce);
    const q = this.value.trim();
    if (!q) { $('searchResults').innerHTML = ''; return; }
    searchDebounce = setTimeout(() => doSearch(q), 380);
  });

  $('searchSubmitBtn').addEventListener('click', function() {
    doSearch($('searchInput').value.trim());
  });

  $('searchInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doSearch(this.value.trim());
  });

  async function doSearch(q) {
    if (!q) return;
    const container = $('searchResults');
    container.innerHTML = '<div class="search-results__loading">Szukam…</div>';
    try {
      const res = await fetch(`/api/movies?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('API error');
      const { data } = await res.json();
      renderSearchResults(data, q);
    } catch (e) {
      // API unreachable (dev without server) – show fallback
      renderSearchResults([], q, true);
    }
  }

  function renderSearchResults(movies, q, error = false) {
    const container = $('searchResults');
    if (error) {
      container.innerHTML = `<div class="search-results__empty">Nie można połączyć z serwerem API.<br/>Uruchom <code>python3 server.py</code> i spróbuj ponownie.</div>`;
      return;
    }
    if (!movies.length) {
      container.innerHTML = `<div class="search-results__empty">Brak wyników dla „${q}"</div>`;
      return;
    }
    container.innerHTML = '';
    movies.forEach(m => {
      const card = document.createElement('div');
      card.className = 'mini-card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', m.title);
      card.innerHTML = `
        <div class="mini-card__poster">${m.poster_icon || '🎬'}</div>
        <div class="mini-card__info">
          <div class="mini-card__title">${m.title}</div>
          <div class="mini-card__meta">${m.year} · ★ ${m.rating}</div>
        </div>
      `;
      card.addEventListener('click', () => { closeSearch(); openMovieModal(m); });
      card.addEventListener('keydown', e => { if (e.key === 'Enter') { closeSearch(); openMovieModal(m); } });
      container.appendChild(card);
    });
  }

  /* ─── Movie Detail Modal ────────────────────────────────────────────────── */
  function openMovieModal(movie) {
    currentMovie = movie;

    // Hero poster
    const hero = $('movieModalHero');
    // Remove old poster
    hero.querySelectorAll('.poster-placeholder').forEach(el => el.remove());
    const poster = document.createElement('div');
    poster.className = `poster-placeholder ${movie.poster_css || 'poster--dark'}`;
    poster.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:5rem;';
    poster.textContent = movie.poster_icon || '🎬';
    hero.insertBefore(poster, hero.firstChild);

    $('modalTitle').textContent  = movie.title;
    $('modalRating').textContent = `★ ${Number(movie.rating).toFixed(1)}`;

    // Meta
    const metaEl = $('modalMeta');
    metaEl.innerHTML = [
      movie.year      ? `<span>📅 ${movie.year}</span>`          : '',
      movie.duration  ? `<span>⏱ ${movie.duration}</span>`       : '',
      movie.category  ? `<span>🎭 ${movie.category}</span>`      : '',
      movie.badge     ? `<span>🏷 ${movie.badge}</span>`         : '',
    ].join('');

    // Tags
    const tagsEl = $('modalTags');
    tagsEl.innerHTML = '';
    const cats = [movie.category, movie.badge].filter(Boolean);
    cats.forEach(c => {
      const span = document.createElement('span');
      span.className = 'movie-modal__tag';
      span.textContent = c;
      tagsEl.appendChild(span);
    });

    // Description
    $('modalDesc').textContent = movie.description
      || DESCRIPTIONS[movie.title]
      || 'Odkryj wyjątkowy tytuł w bibliotece StreamFlow. Dostępny w jakości 4K z polskim lektorem lub napisami.';

    updateModalListBtn(movie.id);

    $('movieModalBackdrop').classList.add('open');
    lockScroll();

    // Push URL hash for routing
    if (movie.id) {
      history.pushState({ movieId: movie.id }, '', `#movie/${movie.id}`);
    }
  }

  function closeMovieModal() {
    $('movieModalBackdrop').classList.remove('open');
    unlockScroll();
    currentMovie = null;
    history.pushState({}, '', '#');
  }

  $('movieModalClose').addEventListener('click', closeMovieModal);
  $('modalCloseBtn2').addEventListener('click', closeMovieModal);
  $('movieModalBackdrop').addEventListener('click', function(e) {
    if (e.target === this) closeMovieModal();
  });

  $('modalListBtn').addEventListener('click', function() {
    if (currentMovie) toggleList(currentMovie);
  });

  $('modalWatchBtn').addEventListener('click', function() {
    if (currentMovie) { closeMovieModal(); openPlayer(currentMovie); }
  });

  $('modalPlayBtn').addEventListener('click', function() {
    if (currentMovie) { closeMovieModal(); openPlayer(currentMovie); }
  });

  /* ─── Player ────────────────────────────────────────────────────────────── */
  function openPlayer(movie) {
    $('playerIcon').textContent      = movie.poster_icon || '🎬';
    $('playerTitle').textContent     = movie.title;
    $('playerBarTitle').textContent  = movie.title;
    $('playerOverlay').classList.add('open');
    lockScroll();

    // Parse duration to seconds for progress bar
    playerDuration = parseDuration(movie.duration);
    playerSeconds  = 0;
    playerPaused   = false;
    $('playerFill').style.width = '0%';
    $('playerTime').textContent = `0:00 / ${fmtTime(playerDuration)}`;
    $('playerPause').textContent = '⏸';

    clearInterval(playerTimer);
    playerTimer = setInterval(tickPlayer, 1000);

    history.pushState({ watching: movie.id }, '', `#watch/${movie.id}`);
  }

  function parseDuration(dur) {
    if (!dur) return 5400; // default 90min
    const mSeason = dur.match(/Sezon/);
    if (mSeason) return 2700; // 45min episode
    const mH = dur.match(/(\d+)h/);
    const mM = dur.match(/(\d+)min/);
    return ((mH ? parseInt(mH[1]) : 0) * 3600) + ((mM ? parseInt(mM[1]) : 0) * 60);
  }

  function tickPlayer() {
    if (playerPaused) return;
    playerSeconds++;
    const pct = Math.min((playerSeconds / playerDuration) * 100, 100);
    $('playerFill').style.width = pct + '%';
    $('playerTime').textContent = `${fmtTime(playerSeconds)} / ${fmtTime(playerDuration)}`;
    if (playerSeconds >= playerDuration) {
      clearInterval(playerTimer);
      closePlayer();
      showToast('Zakończono odtwarzanie. Miłego seansu! 🎬', 'success');
    }
  }

  function closePlayer() {
    clearInterval(playerTimer);
    $('playerOverlay').classList.remove('open');
    unlockScroll();
    history.pushState({}, '', '#');
  }

  $('playerClose').addEventListener('click', closePlayer);

  $('playerPause').addEventListener('click', function() {
    playerPaused = !playerPaused;
    this.textContent = playerPaused ? '▶' : '⏸';
  });

  let muted = false;
  $('playerMute').addEventListener('click', function() {
    muted = !muted;
    this.textContent = muted ? '🔇' : '🔊';
  });

  $('playerProgress').addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    playerSeconds = Math.floor(pct * playerDuration);
  });

  /* ─── Login Modal ───────────────────────────────────────────────────────── */
  function openLogin() {
    $('loginModalBackdrop').classList.add('open');
    lockScroll();
  }
  function closeLogin() {
    $('loginModalBackdrop').classList.remove('open');
    unlockScroll();
  }
  window.SF = { openLogin };

  // loginOpenBtn is now injected dynamically by renderNavAuth()
  // Mobile menu login button
  const loginMobile = $('loginOpenBtnMobile');
  if (loginMobile) loginMobile.addEventListener('click', openLogin);

  $('loginModalClose').addEventListener('click', closeLogin);
  $('loginModalBackdrop').addEventListener('click', function(e) {
    if (e.target === this) closeLogin();
  });

  // Tab switching
  $('tabLogin').addEventListener('click', function() {
    this.classList.add('active');
    $('tabRegister').classList.remove('active');
    $('loginForm').style.display    = 'block';
    $('registerForm').style.display = 'none';
    $('loginTitle').textContent     = 'Witaj z powrotem';
    $('loginSub').textContent       = 'Zaloguj się, aby kontynuować oglądanie';
  });
  $('tabRegister').addEventListener('click', function() {
    this.classList.add('active');
    $('tabLogin').classList.remove('active');
    $('loginForm').style.display    = 'none';
    $('registerForm').style.display = 'block';
    $('loginTitle').textContent     = 'Dołącz do StreamFlow';
    $('loginSub').textContent       = 'Pierwszy miesiąc za darmo. Bez karty kredytowej.';
  });

  $('switchToRegister').addEventListener('click', e => { e.preventDefault(); $('tabRegister').click(); });
  $('switchToLogin').addEventListener('click',    e => { e.preventDefault(); $('tabLogin').click(); });

  $('loginSubmit').addEventListener('click', function() {
    const email = $('loginEmail').value.trim();
    const pass  = $('loginPass').value;
    if (!email || !pass) { showToast('Wypełnij wszystkie pola'); return; }
    const name = email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g, c => c.toUpperCase());
    loginUser({ name, email, plan: 'Standard' });
    closeLogin();
    showToast(`Witaj, ${name}! 👋`, 'success');
  });

  $('registerSubmit').addEventListener('click', function() {
    const name  = $('regName').value.trim();
    const email = $('regEmail').value.trim();
    const pass  = $('regPass').value;
    if (!name || !email || !pass) { showToast('Wypełnij wszystkie pola'); return; }
    if (pass.length < 8) { showToast('Hasło musi mieć min. 8 znaków'); return; }
    loginUser({ name, email, plan: 'Podstawowy' });
    closeLogin();
    showToast(`Konto utworzone. Witaj, ${name}! 🎉`, 'success');
  });

  /* ─── Auth State Management ─────────────────────────────────────────────── */
  function loginUser(user) {
    currentUser = user;
    localStorage.setItem('sf_user', JSON.stringify(user));
    renderNavAuth();
  }

  function logoutUser() {
    currentUser = null;
    localStorage.removeItem('sf_user');
    renderNavAuth();
    closeAvatarDropdown();
    showToast('Wylogowano pomyślnie. Do zobaczenia! 👋');
  }

  function renderNavAuth() {
    const actions = document.querySelector('.nav__actions');
    if (!actions) return;

    // Remove existing avatar or login buttons (keep search btn)
    actions.querySelectorAll('.sf-auth').forEach(el => el.remove());

    if (currentUser) {
      const [bg, fg] = avatarColor(currentUser.name);
      const inits    = initials(currentUser.name);

      const wrapper = document.createElement('div');
      wrapper.className = 'sf-auth sf-avatar-wrapper';
      wrapper.innerHTML = `
        <button class="sf-avatar-btn" id="avatarBtn" aria-label="Menu profilu" aria-expanded="false" aria-haspopup="true">
          <span class="sf-avatar" style="background:linear-gradient(135deg,${bg},${fg})" aria-hidden="true">${inits}</span>
          <span class="sf-avatar-chevron" aria-hidden="true">▾</span>
        </button>
        <div class="sf-dropdown" id="avatarDropdown" role="menu" aria-label="Menu użytkownika" hidden>
          <div class="sf-dropdown__header">
            <span class="sf-dropdown__avatar" style="background:linear-gradient(135deg,${bg},${fg})">${inits}</span>
            <div class="sf-dropdown__info">
              <strong class="sf-dropdown__name">${currentUser.name}</strong>
              <span class="sf-dropdown__email">${currentUser.email}</span>
            </div>
          </div>
          <div class="sf-dropdown__plan">
            <span class="sf-dropdown__plan-badge">▶ ${currentUser.plan}</span>
          </div>
          <ul class="sf-dropdown__menu" role="list">
            <li><button class="sf-dropdown__item" id="ddMyList" role="menuitem">📋 Moja lista <span class="sf-dropdown__count">${myList.length}</span></button></li>
            <li><button class="sf-dropdown__item" id="ddSettings" role="menuitem">⚙️ Ustawienia konta</button></li>
            <li><button class="sf-dropdown__item" id="ddManage" role="menuitem">💳 Zarządzaj planem</button></li>
            <li class="sf-dropdown__divider" role="separator"></li>
            <li><button class="sf-dropdown__item sf-dropdown__item--danger" id="ddLogout" role="menuitem">⎋ Wyloguj się</button></li>
          </ul>
        </div>
      `;
      actions.appendChild(wrapper);

      $('avatarBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleAvatarDropdown();
      });
      $('ddLogout').addEventListener('click', logoutUser);
      $('ddMyList').addEventListener('click', () => { closeAvatarDropdown(); $('myListBtn').click(); });
      $('ddSettings').addEventListener('click', () => { closeAvatarDropdown(); showToast('Ustawienia konta – wkrótce dostępne'); });
      $('ddManage').addEventListener('click', () => { closeAvatarDropdown(); document.querySelector('#pricing').scrollIntoView({ behavior: 'smooth' }); });

    } else {
      // Show login + CTA
      const loginBtn = document.createElement('button');
      loginBtn.className = 'btn btn--outline btn--sm sf-auth';
      loginBtn.style.cssText = 'background:none;cursor:pointer;border:1.5px solid rgba(255,255,255,0.2);color:inherit;font-family:inherit';
      loginBtn.textContent = 'Zaloguj się';
      loginBtn.addEventListener('click', openLogin);

      const ctaBtn = document.createElement('a');
      ctaBtn.className = 'btn btn--primary btn--sm sf-auth';
      ctaBtn.href = '#pricing';
      ctaBtn.textContent = 'Wypróbuj za darmo';

      actions.appendChild(loginBtn);
      actions.appendChild(ctaBtn);
    }
  }

  function toggleAvatarDropdown() {
    const dd  = $('avatarDropdown');
    const btn = $('avatarBtn');
    if (!dd || !btn) return;
    const isOpen = !dd.hidden;
    if (isOpen) {
      closeAvatarDropdown();
    } else {
      dd.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  function closeAvatarDropdown() {
    const dd  = $('avatarDropdown');
    const btn = $('avatarBtn');
    if (dd)  dd.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  // Close dropdown on outside click
  document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.sf-avatar-wrapper');
    if (wrapper && !wrapper.contains(e.target)) closeAvatarDropdown();
  });

  // Update dropdown list count whenever list changes
  const _origSaveList = saveList;
  // (we'll call updateDropdownCount directly after saveList)
  function updateDropdownCount() {
    const badge = document.querySelector('.sf-dropdown__count');
    if (badge) badge.textContent = myList.length;
  }

  /* ─── Card Click → Movie Modal ──────────────────────────────────────────── */
  function attachCardListeners() {
    document.querySelectorAll('.card').forEach(card => {
      // avoid double-attaching
      if (card.dataset.sfBound) return;
      card.dataset.sfBound = '1';

      card.addEventListener('click', async function() {
        // If card was built by api.js, fetch full details
        const apiId = this.dataset.movieId;
        if (apiId && !String(apiId).startsWith('static')) {
          try {
            const res = await fetch(`/api/movies/${apiId}`);
            if (res.ok) {
              const { data } = await res.json();
              if (data) { openMovieModal(data); return; }
            }
          } catch(e) { /* fallback to DOM below */ }
        }

        // Extract data from DOM if not from API
        const title    = this.querySelector('.card__title')?.textContent  || '';
        const meta     = this.querySelector('.card__meta')?.textContent   || '';
        const tagEl    = this.querySelector('.card__tags .tag');
        const category = tagEl ? tagEl.textContent : '';
        const iconEl   = this.querySelector('.poster-icon');
        const icon     = iconEl ? iconEl.textContent : '🎬';
        const cssEl    = this.querySelector('.poster-placeholder');
        const css      = cssEl ? Array.from(cssEl.classList).find(c => c.startsWith('poster--')) || 'poster--dark' : 'poster--dark';
        const rankEl   = this.querySelector('.card__rank');
        const badgeEl  = this.querySelector('.card__badge');

        // Parse meta: "2024 · 1h 52min · ★ 8.4"
        const metaParts = meta.split('·').map(s => s.trim());
        const year     = metaParts[0] || '';
        const duration = metaParts[1] || '';
        const ratingStr= metaParts[2] || '★ 0';
        const rating   = parseFloat(ratingStr.replace('★','').trim()) || 0;

        const movie = {
          id:         this.dataset.movieId || `static-${encodeURIComponent(title)}`,
          title,
          year,
          duration,
          rating,
          category,
          poster_icon: icon,
          poster_css:  css,
          badge:       badgeEl ? badgeEl.textContent : '',
          rank_pos:    rankEl  ? parseInt(rankEl.textContent.replace('#','')) : null,
        };

        openMovieModal(movie);
      });

      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
    });
  }

  // Hero featured card
  const heroCard = document.getElementById('heroFeaturedCard');
  if (heroCard) {
    heroCard.addEventListener('click', function() {
      const movie = {
        id: 'hero-featured',
        title: 'Ostatni Sygnał',
        year: '2024',
        duration: '1h 52min',
        rating: 8.4,
        category: 'Thriller',
        poster_icon: '🎬',
        poster_css: 'poster--dark',
        badge: 'HD',
      };
      openMovieModal(movie);
    });
  }

  // Run now + after API fills cards
  attachCardListeners();

  // Also re-attach after api.js runs (api.js replaces card HTML)
  const observer = new MutationObserver(() => attachCardListeners());
  document.querySelectorAll('.cards-row, .categories-grid').forEach(el => {
    observer.observe(el, { childList: true });
  });

  // Category cards → search
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', function(e) {
      e.preventDefault();
      const name = this.querySelector('.category-card__name')?.textContent || '';
      openSearch();
      setTimeout(() => {
        $('searchInput').value = name;
        doSearch(name);
      }, 150);
    });
  });

  /* ─── Hash Routing ──────────────────────────────────────────────────────── */
  async function handleHash() {
    const hash = location.hash;

    const watchMatch = hash.match(/^#watch\/(\d+)$/);
    if (watchMatch) {
      const id = parseInt(watchMatch[1]);
      try {
        const res  = await fetch(`/api/movies/${id}`);
        const { data } = await res.json();
        if (data) openPlayer(data);
      } catch (e) { /* server offline */ }
      return;
    }

    const movieMatch = hash.match(/^#movie\/([^/]+)$/);
    if (movieMatch) {
      const id = movieMatch[1];
      if (!id.startsWith('static')) {
        try {
          const res  = await fetch(`/api/movies/${id}`);
          const { data } = await res.json();
          if (data) openMovieModal(data);
        } catch (e) { /* server offline */ }
      }
    }
  }

  window.addEventListener('popstate', handleHash);
  handleHash();

  /* ─── api.js hook: enrich cards with movie IDs after load ──────────────── */
  // Patch api.js buildCard to set data-movie-id on articles
  const _origBuildCard = window.buildCard;
  // api.js doesn't expose buildCard globally, so we intercept via MutationObserver
  // and read data from already-rendered cards (id is embedded as aria-label pattern)
  // Instead, api.js cards come from the API data — we re-attach listeners after mutation

  /* ─── Init ──────────────────────────────────────────────────────────────── */
  updateListCount();
  renderListPanel();
  renderNavAuth();  // restore session on page load

  // Welcome toast after slight delay
  setTimeout(() => {
    const seen = sessionStorage.getItem('sf_greeted');
    if (!seen) {
      showToast('Witaj w StreamFlow! Kliknij dowolny film, aby zobaczyć szczegóły. 🎬');
      sessionStorage.setItem('sf_greeted', '1');
    }
  }, 1800);

})();