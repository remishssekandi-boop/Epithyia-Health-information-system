(() => {
  const Api = window.EpithyiaApi;
  const host = document.querySelector('#hospital-profile');
  if (!host) return;

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  }

  function fact(label, value) {
    const item = element('div', 'hospital-fact', '');
    item.append(element('strong', '', label), element('span', '', value || 'Not verified'));
    return item;
  }

  function makeHospitalImage(hospital) {
    const figure = document.createElement('figure');
    figure.className = 'hospital-image hospital-profile-image';
    const image = document.createElement('img');
    image.src = hospital.image_path;
    image.alt = `Hospital image for ${hospital.name}`;
    image.width = 960;
    image.height = 540;
    image.fetchPriority = 'high';
    figure.append(image);
    return figure;
  }

  function sourceLink(source) {
    const link = element('a', '', source.label);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  async function loadProfile() {
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) {
      host.replaceChildren(element('p', 'empty-state', 'Choose a hospital from the directory to view its profile.'));
      return;
    }
    try {
      const response = await Api.request(`/hospitals/${encodeURIComponent(slug)}`);
      const hospital = response.data.hospital;
      const copy = element('div', 'hospital-profile-copy', '');
      copy.append(element('h1', '', hospital.name));
      copy.append(element('p', '', hospital.description));
      if (!hospital.is_verified) {
        copy.append(element('p', 'content-notice', 'This directory listing has not been independently verified. Contact the hospital to confirm its details and services.'));
      }
      if (hospital.google_maps_url) {
        const directions = element('a', 'text-link', 'Directions and map →');
        directions.href = hospital.google_maps_url;
        directions.target = '_blank';
        directions.rel = 'noopener noreferrer';
        copy.append(directions);
      }

      const facts = element('div', 'hospital-facts', '');
      facts.append(
        fact('Location', hospital.location),
        fact('Physical address', hospital.address),
        fact('Telephone', hospital.phone),
        fact('Hours and operating information', hospital.operating_info),
        fact('Emergency contact', hospital.emergency_contact),
      );
      copy.append(facts);
      copy.append(element('h2', '', 'Services listed by the hospital or KCCA'));
      if (hospital.services.length) {
        const services = element('ul', 'hospital-services', '');
        for (const service of hospital.services) services.append(element('li', '', service.name));
        copy.append(services);
      } else {
        copy.append(element('p', '', hospital.is_verified
          ? 'No services are listed in the sources checked.'
          : 'No services have been independently confirmed for this directory listing.'));
      }

      const sourcesSection = element('section', 'hospital-source-section', '');
      sourcesSection.append(element('h2', '', 'Information sources'));
      sourcesSection.append(element('p', '', 'Use published sources where available. Confirm details by phone before travelling.'));
      const sources = element('ul', 'hospital-sources', '');
      const hospitalSources = hospital.sources || [];
      for (const source of hospitalSources) {
        const item = element('li', '', '');
        item.append(sourceLink(source));
        sources.append(item);
      }
      if (hospitalSources.length === 0 && !hospital.services.some((service) => service.source)) {
        sources.append(element('p', '', 'No independent sources are listed for this directory entry.'));
      }
      const serviceSources = new Map();
      for (const service of hospital.services) {
        if (service.source) serviceSources.set(service.source, service.source);
      }
      for (const [url] of serviceSources) {
        if (hospitalSources.some((source) => source.url === url)) continue;
        const item = element('li', '', '');
        item.append(sourceLink({ label: 'Published service list', url }));
        sources.append(item);
      }
      sourcesSection.append(sources);

      host.replaceChildren(makeHospitalImage(hospital), copy, sourcesSection);
      document.title = `${hospital.name} — Hospital directory`;
    } catch (error) {
      host.replaceChildren(element('p', 'empty-state', error.status === 404
        ? 'This hospital is not in the directory.'
        : error.message));
    }
  }

  loadProfile();
})();
