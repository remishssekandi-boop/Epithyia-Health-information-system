<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Search published health information by topic.">
  <title>Health information — EPITHYIA GROUP</title>
  <link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/content.css">
  <script src="/js/api.js" defer></script><script src="/js/site.js" defer></script><script src="/js/health.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><a class="brand" href="/" aria-label="EPITHYIA GROUP home"><span class="brand-mark" aria-hidden="true">E</span><span>EPITHYIA <strong>GROUP</strong></span></a><nav class="main-nav" aria-label="Main navigation"><a href="/">Home</a><a class="active" href="/health-information.php">Health information</a><a href="/about.php">About</a><a href="/contact.php">Contact</a></nav><div class="header-actions"><div class="auth-entry"><a class="button button-quiet" href="/login.php">Log in</a><a class="button button-small" href="/register.php">Join</a></div><div class="auth-session" hidden><span class="welcome-label">Hello, <strong data-user-name></strong></span><button class="button button-quiet" type="button" data-logout>Log out</button></div></div></header>
  <main id="main" class="page-shell">
    <section class="page-intro"><p class="eyebrow">Health guide</p><h1>Understand your health.<br><em>Know when to seek care.</em></h1><p>Browse published topics on maternal and child health, nutrition, malaria, HIV, immunization, prevention, and emergency information.</p></section>
    <section class="search-panel" aria-label="Search health information"><form id="health-search" class="search-form"><label class="search-field"><span>Search topics or keywords</span><input id="search-query" name="q" type="search" maxlength="120" placeholder="Try a topic or keyword"></label><label class="search-field"><span>Topic</span><select id="category-filter" name="category_id"><option value="">All topics</option></select></label><label class="search-field"><span>Sort by</span><select id="sort-order" name="sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title A–Z</option></select></label><button class="button search-button" type="submit">Search <span aria-hidden="true">→</span></button></form></section>
    <div class="results-heading"><p id="results-count" aria-live="polite">Loading articles…</p><p class="micro-note">Public library shows published articles only.</p></div>
    <div id="health-results" class="article-grid article-grid-wide" aria-live="polite"><p class="loading-note">Connecting to the health information service…</p></div>
    <div class="pagination-row"><button id="load-more" class="button button-outline" type="button" hidden>Load more</button></div>
    <p class="content-notice notice-wide">Health information on this platform is for general educational purposes. Seek guidance from a qualified health professional where appropriate.</p>
  </main>
  <footer class="site-footer"><a class="brand brand-footer" href="/">EPITHYIA <strong>GROUP</strong></a><p>Practical hospital and health information for Kampala communities.</p><span>© <span data-current-year></span> EPITHYIA GROUP</span></footer>
</body>
</html>
