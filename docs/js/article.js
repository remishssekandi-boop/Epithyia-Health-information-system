(() => {
  const Api = window.EpithyiaApi;
  const host = document.querySelector('#article-content');
  if (!host) return;

  function text(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  async function loadArticle() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^\d+$/.test(id)) {
      host.replaceChildren(text('p', 'empty-state', 'Choose a topic from the health information library to read its guide.'));
      return;
    }
    try {
      const response = await Api.request(`/health/articles/${encodeURIComponent(id)}`);
      const article = response.data.article;
      const heading = document.createElement('header');
      heading.append(text('p', 'article-category', article.category_name));
      heading.append(text('h1', '', article.title));
      heading.append(text('p', 'article-summary', article.summary));
      const date = article.published_at ? new Date(article.published_at).toLocaleDateString() : '';
      const meta = document.createElement('div');
      meta.className = 'article-meta';
      if (date) meta.append(text('span', '', `Published ${date}`));
      if (article.language) meta.append(text('span', '', `Language: ${article.language}`));
      if (article.created_by_name) meta.append(text('span', '', `Shared by ${article.created_by_name}`));
      const body = text('div', 'article-body', article.content);
      host.replaceChildren(heading, meta, body);
      document.title = `${article.title} — EPITHYIA GROUP`;
    } catch (error) {
      host.replaceChildren(text('p', 'empty-state', error.status === 404
        ? 'This article is not available. It may not be published yet.'
        : error.message));
    }
  }

  document.addEventListener('DOMContentLoaded', loadArticle);
})();
