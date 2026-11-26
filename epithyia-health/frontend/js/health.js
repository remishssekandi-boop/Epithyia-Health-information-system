(() => {
  const Api = window.EpithyiaApi;
  const form = document.querySelector('#health-search');
  if (!form) return;

  const categoriesSelect = document.querySelector('#category-filter');
  const resultsHost = document.querySelector('#health-results');
  const resultCount = document.querySelector('#results-count');
  const loadMoreButton = document.querySelector('#load-more');
  const pageSize = 12;
  let currentOffset = 0;
  let currentTotal = 0;

  function makeText(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function makeArticleCard(article) {
    const link = document.createElement('a');
    link.className = 'article-card';
    link.href = `/article.php?id=${encodeURIComponent(article.id)}`;
    link.append(makeText('span', 'article-category', article.category_name || 'Health information'));
    link.append(makeText('h3', '', article.title));
    link.append(makeText('p', '', article.summary));
    const date = article.published_at ? new Date(article.published_at).toLocaleDateString() : '';
    link.append(makeText('span', 'article-link', date ? `Read article · ${date} →` : 'Read article →'));
    return link;
  }

  async function loadCategories() {
    try {
      const response = await Api.request('/health/categories');
      for (const category of response.data.categories) {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categoriesSelect.append(option);
      }
      const queryCategory = new URLSearchParams(window.location.search).get('category_id');
      if (queryCategory && [...categoriesSelect.options].some((option) => option.value === queryCategory)) {
        categoriesSelect.value = queryCategory;
      }
    } catch (error) {
      const status = document.createElement('option');
      status.value = '';
      status.textContent = 'Topics unavailable';
      categoriesSelect.append(status);
      categoriesSelect.disabled = true;
      resultCount.textContent = error.message;
    }
  }

  async function loadArticles({ append = false } = {}) {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(currentOffset), sort: document.querySelector('#sort-order').value });
    const query = document.querySelector('#search-query').value.trim();
    if (query) params.set('q', query);
    if (categoriesSelect.value) params.set('category_id', categoriesSelect.value);

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = 'Loading…';
    if (!append) resultsHost.replaceChildren(makeText('p', 'loading-note', 'Searching published information…'));
    try {
      const response = await Api.request(`/health/articles?${params.toString()}`);
      const articles = response.data.articles;
      currentTotal = response.data.pagination.total;
      if (!append) resultsHost.replaceChildren();
      resultsHost.append(...articles.map(makeArticleCard));
      if (currentOffset === 0 && articles.length === 0) {
        resultsHost.append(makeText('p', 'empty-state', 'No health guides match this search. Try another keyword or browse all topics.'));
      }
      const shown = Math.min(currentOffset + articles.length, currentTotal);
      resultCount.textContent = `${currentTotal} ${currentTotal === 1 ? 'article' : 'articles'} found · showing ${shown}`;
      loadMoreButton.hidden = shown >= currentTotal;
      currentOffset = shown;
    } catch (error) {
      if (!append) resultsHost.replaceChildren();
      resultsHost.append(makeText('p', 'empty-state', error.message));
      resultCount.textContent = 'Articles could not be loaded.';
      loadMoreButton.hidden = true;
    } finally {
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = 'Load more';
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    currentOffset = 0;
    loadArticles();
  });
  loadMoreButton.addEventListener('click', () => loadArticles({ append: true }));
  categoriesSelect.addEventListener('change', () => {
    currentOffset = 0;
    loadArticles();
  });
  loadCategories().then(() => loadArticles());
})();
