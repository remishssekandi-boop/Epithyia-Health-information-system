(() => {
  const Api = window.EpithyiaApi;
  const host = document.querySelector('#hospital-results');
  if (!host) return;

  const query = document.querySelector('#hospital-query');
  const count = document.querySelector('#hospital-count');
  const searchButton = document.querySelector('#hospital-search-button');

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  }

  function makeHospitalImage(hospital) {
    const figure = document.createElement('figure');
    figure.className = 'hospital-image';
    const image = document.createElement('img');
    image.src = hospital.image_path;
    image.alt = `Hospital image for ${hospital.name}`;
    image.loading = 'lazy';
    image.width = 960;
    image.height = 540;
    figure.append(image);
    return figure;
  }

  function appendContact(copy, label, value) {
    if (value) copy.append(element('p', 'hospital-card-detail', `${label}: ${value}`));
  }

  function hospitalCard(hospital) {
    const card = document.createElement('article');
    card.className = 'hospital-card';
    const copy = document.createElement('div');
    copy.className = 'hospital-card-copy';
    copy.append(element('h2', '', hospital.name));
    copy.append(element('p', 'hospital-location', hospital.location || 'Location unavailable'));
    if (!hospital.is_verified) {
      copy.append(element('p', 'hospital-card-detail', 'Directory listing; contact the hospital to confirm details and availability.'));
    }
    if (hospital.google_maps_url) {
      const directions = element('a', 'text-link', 'Directions and map →');
      directions.href = hospital.google_maps_url;
      directions.target = '_blank';
      directions.rel = 'noopener noreferrer';
      copy.append(directions);
    }
    appendContact(copy, 'Address', hospital.address);
    appendContact(copy, 'Telephone', hospital.phone);
    copy.append(element('p', '', hospital.description));
    if (hospital.services.length) {
      copy.append(element('p', 'hospital-card-detail', `${hospital.services.length} services listed by the hospital or KCCA`));
    }
    const link = element('a', 'button button-outline hospital-detail-link', 'View hospital profile →');
    link.href = `/hospital.php?slug=${encodeURIComponent(hospital.slug)}`;
    copy.append(link);
    card.append(makeHospitalImage(hospital), copy);
    return card;
  }

  async function loadHospitals() {
    const term = query.value.trim();
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    searchButton.disabled = true;
    count.textContent = 'Searching hospitals…';
    host.replaceChildren(element('p', 'loading-note', 'Loading the directory…'));
    try {
      const result = await Api.request(`/hospitals${params.size ? `?${params}` : ''}`);
      const hospitals = result.data.hospitals;
      host.replaceChildren(...hospitals.map(hospitalCard));
      count.textContent = `${hospitals.length} ${hospitals.length === 1 ? 'hospital' : 'hospitals'} listed`;
      if (hospitals.length === 0) host.append(element('p', 'empty-state', 'No hospitals match that search.'));
    } catch (error) {
      host.replaceChildren(element('p', 'empty-state', error.message));
      count.textContent = 'The hospital directory could not be loaded.';
    } finally {
      searchButton.disabled = false;
    }
  }

  searchButton.addEventListener('click', loadHospitals);
  query.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadHospitals();
    }
  });
  loadHospitals();
})();
