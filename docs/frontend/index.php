<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f5f8f5">
  <meta name="description" content="EPITHYIA GROUP connects communities with reviewed health information through accessible digital channels.">
  <title>EPITHYIA GROUP — Health information within reach</title>
  <link rel="stylesheet" href="/css/style.css">
  <script src="/js/api.js" defer></script>
  <script src="/js/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="EPITHYIA GROUP home"><span class="brand-mark" aria-hidden="true">E</span><span>EPITHYIA <strong>GROUP</strong></span></a>
    <nav class="main-nav" aria-label="Main navigation">
      <a class="active" href="/">Home</a><a href="/health-information.php">Health information</a><a href="/about.php">About</a><a href="/contact.php">Contact</a>
    </nav>
    <div class="header-actions">
      <div class="auth-entry"><a class="button button-quiet" href="/login.php">Log in</a><a class="button button-small" href="/register.php">Join</a></div>
      <div class="auth-session" hidden><span class="welcome-label">Hello, <strong data-user-name></strong></span><button class="button button-quiet" type="button" data-logout>Log out</button></div>
    </div>
  </header>

  <main id="main">
    <section class="hero-wrap">
      <div class="hero-copy">
        <p class="eyebrow"><span class="status-dot"></span> Health information for Kampala communities</p>
        <h1>Find care.<br><em>Know where to go.</em></h1>
        <p class="hero-lede">Locate Kampala hospitals, check their published services and contact details, and read practical health information before you seek care.</p>
        <div class="hero-actions"><a class="button" href="/health-information.php">Explore health information <span aria-hidden="true">↗</span></a><a class="text-link" href="/hospitals.php">Find a hospital <span aria-hidden="true">→</span></a><a class="text-link" href="/ussd.php">Explore mobile access <span aria-hidden="true">→</span></a></div>
        <p class="micro-note">General health information is not a diagnosis. For symptoms or urgent concerns, contact a qualified health professional.</p>
      </div>
      <aside class="hero-art" aria-label="Illustration of connected community care">
        <div class="sun-orbit"></div><div class="art-card art-card-main"><span class="art-icon" aria-hidden="true">✳</span><span>Hospitals<br>and health services</span></div>
        <div class="art-card art-card-small"><span class="pulse-line" aria-hidden="true">⌁</span><span>People<br>and communities</span></div>
        <div class="art-leaf leaf-one" aria-hidden="true"></div><div class="art-leaf leaf-two" aria-hidden="true"></div>
        <span class="art-label">UGANDA · DIGITAL ACCESS</span>
      </aside>
    </section>

    <section class="section section-soft" aria-labelledby="topics-title">
      <div class="section-heading"><div><p class="eyebrow">Browse by topic</p><h2 id="topics-title">Practical health information</h2></div><a class="text-link" href="/health-information.php">All health information <span aria-hidden="true">→</span></a></div>
      <div id="home-categories" class="topic-grid" aria-live="polite"><p class="loading-note">Loading available topics…</p></div>
      <p class="content-notice">Health information is for general educational purposes and is not a substitute for professional medical advice.</p>
    </section>

    <section class="section" aria-labelledby="latest-title">
      <div class="section-heading"><div><p class="eyebrow">Health guides</p><h2 id="latest-title">Recently published information</h2></div><a class="text-link" href="/health-information.php">Browse all <span aria-hidden="true">→</span></a></div>
      <div id="home-articles" class="article-grid" aria-live="polite"><p class="loading-note">Loading published articles…</p></div>
    </section>

    <section class="section section-soft" aria-labelledby="access-title">
      <div class="section-heading"><div><p class="eyebrow">Plan your next step</p><h2 id="access-title">Hospital directory and mobile guide</h2></div></div>
      <div class="topic-grid">
        <a class="topic-card" href="/hospitals.php"><span class="topic-icon" aria-hidden="true">+</span><span><strong>Hospital directory</strong><small>Compare locations, services, telephone numbers, hours, and emergency contacts.</small></span><span class="card-arrow" aria-hidden="true">→</span></a>
        <a class="topic-card" href="/ussd.php"><span class="topic-icon" aria-hidden="true">#</span><span><strong>Mobile information guide</strong><small>Practice finding hospital addresses, services, and emergency numbers by menu.</small></span><span class="card-arrow" aria-hidden="true">→</span></a>
      </div>
    </section>

    <section class="closing-banner"><div><p class="eyebrow">Start with what you need</p><h2>Learn, find a facility, and call ahead.</h2><p>Published guides and hospital details help you prepare before seeking care.</p></div><a class="button button-light" href="/health-information.php">Browse health information <span aria-hidden="true">↗</span></a></section>
  </main>
  <footer class="site-footer"><a class="brand brand-footer" href="/">EPITHYIA <strong>GROUP</strong></a><p>Practical hospital and health information for Kampala communities.</p><span>© <span data-current-year></span> EPITHYIA GROUP</span></footer>
</body>
</html>
