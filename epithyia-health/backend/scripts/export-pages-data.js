const fs = require('node:fs/promises');
const path = require('node:path');

const apiBase = (process.env.API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const frontendDataPath = path.resolve(__dirname, '..', '..', 'frontend', 'data', 'site-data.json');

async function getPublicData(endpoint) {
  const response = await fetch(`${apiBase}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Could not export ${endpoint}: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.success !== true) {
    throw new Error(`Could not export ${endpoint}: ${payload.message || 'unexpected API response'}`);
  }
  return payload.data;
}

async function getAllPublishedArticles() {
  const pageSize = 100;
  const articles = [];
  let total = 0;
  do {
    const data = await getPublicData(`/health/articles?limit=${pageSize}&offset=${articles.length}&sort=newest`);
    if (!Array.isArray(data.articles) || !Number.isInteger(data.pagination?.total)) {
      throw new Error('Public articles response is missing its list or pagination total.');
    }
    if (data.articles.length === 0 && articles.length < data.pagination.total) {
      throw new Error('Public articles pagination stopped before all articles were exported.');
    }
    articles.push(...data.articles);
    total = data.pagination.total;
  } while (articles.length < total);
  return articles;
}

async function main() {
  const [categoryData, articles, hospitalData] = await Promise.all([
    getPublicData('/health/categories'),
    getAllPublishedArticles(),
    getPublicData('/hospitals'),
  ]);
  if (![categoryData.categories, hospitalData.hospitals].every(Array.isArray)) {
    throw new Error('Public API response is missing categories, articles, or hospitals.');
  }

  const snapshot = {
    categories: categoryData.categories
      .filter((category) => category.status === 'ACTIVE')
      .map(({ id, name, description, status, published_article_count }) => ({
        id, name, description, status, published_article_count,
      })),
    articles: articles
      .filter((article) => article.status === 'PUBLISHED')
      .map((article) => ({
        id: article.id,
        category_id: article.category_id,
        category_name: article.category_name,
        title: article.title,
        summary: article.summary,
        content: article.content,
        language: article.language,
        status: article.status,
        created_at: article.created_at,
        published_at: article.published_at,
      })),
    hospitals: hospitalData.hospitals
      .filter((hospital) => hospital.status === 'ACTIVE')
      .map((hospital) => ({
        id: hospital.id,
        slug: hospital.slug,
        name: hospital.name,
        location: hospital.location,
        address: hospital.address,
        phone: hospital.phone,
        description: hospital.description,
        operating_info: hospital.operating_info,
        emergency_contact: hospital.emergency_contact,
        status: hospital.status,
        image_path: hospital.image_path,
        is_verified: Boolean(hospital.is_verified),
        services: (hospital.services || []).map(({ name, source }) => ({ name, source })),
        sources: hospital.sources || [],
        sources_checked_on: hospital.sources_checked_on,
        google_maps_url: hospital.google_maps_url,
      })),
  };
  if (snapshot.categories.length === 0 || snapshot.articles.length === 0 || snapshot.hospitals.length === 0) {
    throw new Error('The public API returned an empty content section; refusing to replace the existing site snapshot.');
  }

  await fs.mkdir(path.dirname(frontendDataPath), { recursive: true });
  await fs.writeFile(frontendDataPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Exported ${snapshot.categories.length} categories, ${snapshot.articles.length} articles, and ${snapshot.hospitals.length} hospitals.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
