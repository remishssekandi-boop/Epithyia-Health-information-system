(() => {
  const Api = window.EpithyiaApi;
  const text = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  };

  function showLoggedOut() {
    document.querySelectorAll('.auth-entry').forEach((element) => { element.hidden = false; });
    document.querySelectorAll('.auth-session').forEach((element) => { element.hidden = true; });
  }

  function showLoggedIn(user) {
    document.querySelectorAll('.auth-entry').forEach((element) => { element.hidden = true; });
    document.querySelectorAll('.auth-session').forEach((element) => { element.hidden = false; });
    document.querySelectorAll('[data-user-name]').forEach((element) => { element.textContent = user.name; });
    document.querySelectorAll('.auth-session').forEach((element) => {
      if (element.querySelector('a[href="dashboard.html"]')) return;
      const link = document.createElement('a');
      link.className = 'button button-small';
      link.href = Api.siteUrl('dashboard.html');
      link.textContent = 'Dashboard';
      element.prepend(link);
    });
  }

  function setupNavigationLinks() {
    const navigation = document.querySelector('.main-nav');
    if (!navigation) return;

    for (const [label, path] of [
      ['Hospitals', 'hospitals.html'],
      ['USSD simulator', 'ussd.html'],
    ]) {
      const href = Api.siteUrl(path);
      if (navigation.querySelector(`a[href="${path}"]`)) continue;
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      if (window.location.pathname.endsWith(`/${path}`)) {
        link.className = 'active';
        link.setAttribute('aria-current', 'page');
      }
      navigation.append(link);
    }
  }

  async function setupSession() {
    if (!Api.getToken()) {
      showLoggedOut();
      return;
    }
    try {
      const result = await Api.request('/auth/me', { auth: true });
      showLoggedIn(result.data.user);
    } catch {
      showLoggedOut();
    }
  }

  function makeTopicCard(category) {
    const link = document.createElement('a');
    link.className = 'topic-card';
    link.href = Api.siteUrl(`health-information.html?category_id=${encodeURIComponent(category.id)}`);
    const icon = text('span', 'topic-icon', '✳');
    icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.append(text('strong', '', category.name));
    copy.append(text('small', '', `${Number(category.published_article_count) || 0} published articles`));
    link.append(icon, copy, text('span', 'card-arrow', '→'));
    return link;
  }

  function makeArticleCard(article) {
    const link = document.createElement('a');
    link.className = 'article-card';
    link.href = Api.siteUrl(`article.html?id=${encodeURIComponent(article.id)}`);
    link.append(text('span', 'article-category', article.category_name || 'Health information'));
    link.append(text('h3', '', article.title));
    link.append(text('p', '', article.summary));
    const published = article.published_at ? new Date(article.published_at).toLocaleDateString() : '';
    link.append(text('span', 'article-link', published ? `Read article · ${published} →` : 'Read article →'));
    return link;
  }

  async function loadHomeContent() {
    const categoriesHost = document.querySelector('#home-categories');
    const articlesHost = document.querySelector('#home-articles');
    if (categoriesHost) {
      try {
        const result = await Api.request('/health/categories');
        categoriesHost.replaceChildren(...result.data.categories.slice(0, 6).map(makeTopicCard));
        if (result.data.categories.length === 0) categoriesHost.append(text('p', 'empty-state', 'No active health categories have been published yet.'));
      } catch (error) {
        categoriesHost.replaceChildren(text('p', 'empty-state', error.message));
      }
    }
    if (articlesHost) {
      try {
        const result = await Api.request('/health/articles?limit=3&sort=newest');
        articlesHost.replaceChildren(...result.data.articles.map(makeArticleCard));
        if (result.data.articles.length === 0) {
          articlesHost.append(text('p', 'empty-state', 'No public health guides have been published yet.'));
        }
      } catch (error) {
        articlesHost.replaceChildren(text('p', 'empty-state', error.message));
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNavigationLinks();
    document.querySelectorAll('[data-current-year]').forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
    setupSession();
    loadHomeContent();
    document.querySelectorAll('[data-logout]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await Api.logout(); } catch { /* The token is removed locally even if the API is unavailable. */ }
        window.location.assign(Api.siteUrl('index.html'));
      });
    });
    document.addEventListener('epithyia:session-expired', showLoggedOut);
    document.addEventListener('epithyia:logged-out', showLoggedOut);
  });
})();
