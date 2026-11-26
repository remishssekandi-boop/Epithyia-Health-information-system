(() => {
  const TOKEN_KEY = 'epithyia.jwt';
  const apiMeta = document.querySelector('meta[name="api-base"]');
  const staticMode = document.querySelector('meta[name="api-mode"]')?.content === 'static'
    || new URLSearchParams(window.location.search).get('static-preview') === '1';
  const apiBase = (apiMeta?.content || '/api').replace(/\/$/, '');
  let siteDataPromise;
  const staticSessions = new Map();
  const ussdHospitalOrder = [
    'mengo-hospital',
    'rubaga-hospital',
    'old-kampala-hospital',
    'kibuli-hospital',
    'mulago-hospital',
    'nakasero-hospital',
  ];

  class ApiError extends Error {
    constructor(message, status, errors = []) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.errors = errors;
    }
  }

  function siteUrl(path) {
    return new URL(String(path).replace(/^\/+/, ''), new URL('.', document.baseURI)).href;
  }

  async function getSiteData() {
    if (!siteDataPromise) {
      siteDataPromise = fetch(siteUrl('data/site-data.json'))
        .then(async (response) => {
          if (!response.ok) throw new ApiError('Published site content could not be loaded.', response.status);
          return response.json();
        })
        .catch((error) => {
          siteDataPromise = null;
          if (error instanceof ApiError) throw error;
          throw new ApiError('Published site content could not be loaded.', 0);
        });
    }
    return siteDataPromise;
  }

  function staticResult(data) {
    return { success: true, data };
  }

  function staticError(message, status = 400) {
    throw new ApiError(message, status);
  }

  function staticHospitals(data) {
    const active = data.hospitals.filter((hospital) => hospital.status === 'ACTIVE');
    return ussdHospitalOrder
      .map((slug) => active.find((hospital) => hospital.slug === slug))
      .filter(Boolean);
  }

  function staticHospitalList(data, term) {
    const query = term.trim().toLocaleLowerCase();
    return staticHospitals(data).filter((hospital) => !query
      || [hospital.name, hospital.location, hospital.address, hospital.description]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query)));
  }

  function staticUssdMenu() {
    return [
      'EPITHYIA HEALTH DIRECTORY',
      '1. Hospital directory',
      '2. Hospital details',
      '3. Health guides on the website',
      '4. Emergency contacts',
      '5. About this guide',
      '6. Help',
      '0. End',
    ].join('\n');
  }

  function staticUssdHospitalList(hospitals) {
    if (!hospitals.length) return 'No hospitals are currently listed.';
    return [
      'HOSPITALS IN KAMPALA',
      ...hospitals.map((hospital, index) => `${index + 1}. ${hospital.name}`),
      '00. Main menu',
      '9. End session',
    ].join('\n');
  }

  function staticUssdEmergencyList(hospitals) {
    if (!hospitals.length) return 'No hospitals are currently listed.';
    return [
      'HOSPITAL EMERGENCY CONTACTS',
      ...hospitals.map((hospital, index) => `${index + 1}. ${hospital.name.replace(/ Hospital.*/, '')}`),
      '0. Main  9. End',
    ].join('\n');
  }

  function shorten(value, maximum = 118) {
    if (value.length <= maximum) return value;
    const shortened = value.slice(0, maximum - 1);
    const wordBoundary = shortened.lastIndexOf(' ');
    return `${shortened.slice(0, wordBoundary > 0 ? wordBoundary : shortened.length)}…`;
  }

  function staticUssdDetail(hospital, selection) {
    let detail;
    if (selection === '1') {
      const numbers = hospital.phone ? hospital.phone.split(';').map((phone) => phone.trim()) : [];
      detail = `Phone: ${numbers[0] || 'Not published'}${numbers.length > 1 ? ` (+${numbers.length - 1} more on website)` : ''}`;
    } else if (selection === '2') detail = `Address: ${hospital.address || 'Not published'}`;
    else if (selection === '3') {
      detail = hospital.services.length
        ? `Services: ${hospital.services.map((service) => service.name).join(', ')}`
        : 'No services are listed in the sources.';
    } else if (selection === '4') detail = `Hours: ${hospital.operating_info || 'Not published'}`;
    else detail = `Emergency: ${hospital.emergency_contact || 'No separate number published; call the main hospital line.'}`;
    return `CON ${hospital.name}\n${shorten(detail, 96)}\n0. Back  00. Main  9. End`;
  }

  async function staticUssdRequest(path, options, data) {
    const url = new URL(path, 'https://static.invalid');
    const body = options.body || {};
    const method = options.method || 'GET';
    const hospitals = staticHospitals(data);

    if (url.pathname === '/ussd/simulator/start' && method === 'POST') {
      if (!/^\+?[0-9\s()-]{7,30}$/.test(body.phoneNumber || '')) {
        staticError('A valid phone number is required.');
      }
      const sessionId = `static-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = `CON ${staticUssdMenu()}`;
      staticSessions.set(sessionId, {
        phoneNumber: body.phoneNumber,
        menu: 'HOME',
        events: [{ selection: '', response, created_at: new Date().toISOString() }],
      });
      return staticResult({ sessionId, response, ended: false });
    }

    const eventsMatch = url.pathname.match(/^\/ussd\/sessions\/([^/]+)\/events$/);
    if (eventsMatch && method === 'GET') {
      const session = staticSessions.get(decodeURIComponent(eventsMatch[1]));
      if (!session) staticError('USSD session not found.', 404);
      return staticResult({ events: session.events });
    }

    if (url.pathname === '/ussd/simulator/continue' && method === 'POST') {
      const session = staticSessions.get(body.sessionId);
      if (!session) staticError('USSD session not found. Start a new session.', 404);
      if (session.phoneNumber !== body.phoneNumber) staticError('The phone number does not match this USSD session.', 403);
      const input = String(body.text || '').trim();
      if (input.length > 182 || !/^[0-9*#\s]*$/.test(input)) {
        staticError('USSD input must contain only menu digits and separators.');
      }

      const selection = input.split('*').pop() || '';
      let menu = session.menu;
      let response = '';
      let ended = false;
      const detailMatch = menu.match(/^HOSPITAL_DETAIL:(.+)$/);
      if (selection === '9') {
        menu = 'ENDED';
        response = 'END Thank you. Session ended.';
        ended = true;
      } else if (selection === '00') {
        menu = 'HOME';
        response = `CON ${staticUssdMenu()}`;
      } else if (selection === '0') {
        if (detailMatch) {
          menu = 'HOSPITALS';
          response = `CON ${staticUssdHospitalList(hospitals)}`;
        } else if (menu === 'HOSPITALS' || menu === 'EMERGENCY_LIST' || menu === 'HELP') {
          menu = 'HOME';
          response = `CON ${staticUssdMenu()}`;
        } else {
          menu = 'ENDED';
          response = 'END Thank you. Session ended.';
          ended = true;
        }
      } else if (menu === 'HOME' && ['1', '2'].includes(selection)) {
        menu = 'HOSPITALS';
        response = `CON ${staticUssdHospitalList(hospitals)}`;
      } else if (menu === 'HOME' && selection === '3') {
        menu = 'ENDED';
        response = 'END Health guides are available on the EPITHYIA website. This phone menu does not replace clinical advice.';
        ended = true;
      } else if (menu === 'HOME' && selection === '4') {
        menu = 'EMERGENCY_LIST';
        response = `CON ${staticUssdEmergencyList(hospitals)}`;
      } else if (menu === 'HOME' && selection === '5') {
        menu = 'ENDED';
        response = 'END This guide lists published hospital information. It cannot make appointments or provide emergency response.';
        ended = true;
      } else if (menu === 'HOME' && selection === '6') {
        menu = 'HELP';
        response = 'CON Enter a menu number to continue.\n0. Main menu  9. End';
      } else if (menu === 'HOME') {
        response = `CON Invalid selection.\n${staticUssdMenu()}`;
      } else if (menu === 'HOSPITALS' && /^[1-6]$/.test(selection) && hospitals[Number(selection) - 1]) {
        const hospital = hospitals[Number(selection) - 1];
        menu = `HOSPITAL_DETAIL:${hospital.slug}`;
        response = `CON ${hospital.name}\n1. Phone  2. Address\n3. Services  4. Hours\n5. Emergency  0. Back  9. End`;
      } else if (detailMatch && /^[1-5]$/.test(selection)) {
        const hospital = hospitals.find((item) => item.slug === detailMatch[1]);
        if (hospital) response = staticUssdDetail(hospital, selection);
        else response = 'END This hospital is no longer listed. Start a new session to continue.';
      } else if (menu === 'EMERGENCY_LIST' && /^[1-6]$/.test(selection) && hospitals[Number(selection) - 1]) {
        const hospital = hospitals[Number(selection) - 1];
        const emergency = hospital.emergency_contact || 'No separate emergency number published; call the main hospital line.';
        response = `CON ${hospital.name}\n${shorten(emergency, 110)}\n0. Main  9. End`;
      } else if (menu === 'EMERGENCY_LIST') {
        response = `CON Invalid selection.\n${staticUssdEmergencyList(hospitals)}`;
      } else if (menu === 'HELP') {
        response = 'CON Invalid selection. Enter a menu number to continue.\n0. Main menu  9. End';
      } else {
        menu = 'ENDED';
        response = 'END This session has ended. Start a new session to continue.';
        ended = true;
      }

      session.menu = menu;
      session.events.push({ selection, response, created_at: new Date().toISOString() });
      return staticResult({ response, ended });
    }

    staticError('Sign-in, appointments, and administration require the application API, which is not available on static hosting.', 503);
  }

  async function staticRequest(path, options) {
    if (options.auth || /^\/auth\/|^\/appointments(?:\/|$)|^\/users(?:\/|$)|^\/admin(?:\/|$)/.test(path)) {
      staticError('Sign-in, appointments, and administration require the application API, which is not available on static hosting.', 503);
    }
    const data = await getSiteData();
    const url = new URL(path, 'https://static.invalid');
    const method = options.method || 'GET';
    if (method !== 'GET' || url.pathname.startsWith('/ussd/sessions/')) {
      return staticUssdRequest(path, options, data);
    }

    if (url.pathname === '/health') {
      return staticResult({ databaseMode: 'static' });
    }
    if (url.pathname === '/health/categories') {
      return staticResult({ categories: data.categories.filter((category) => category.status === 'ACTIVE') });
    }
    if (url.pathname === '/health/articles') {
      const query = (url.searchParams.get('q') || '').toLocaleLowerCase();
      const categoryId = url.searchParams.get('category_id');
      const sort = url.searchParams.get('sort') || 'newest';
      const matching = data.articles.filter((article) => article.status === 'PUBLISHED'
        && (!categoryId || String(article.category_id) === categoryId)
        && (!query || [article.title, article.summary, article.content, article.category_name]
          .some((value) => String(value || '').toLocaleLowerCase().includes(query))));
      matching.sort((first, second) => {
        if (sort === 'title') return first.title.localeCompare(second.title);
        const comparison = new Date(second.published_at || second.created_at) - new Date(first.published_at || first.created_at);
        return sort === 'oldest' ? -comparison : comparison;
      });
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      return staticResult({
        articles: matching.slice(offset, offset + limit),
        pagination: { total: matching.length, limit, offset },
      });
    }
    const articleMatch = url.pathname.match(/^\/health\/articles\/(\d+)$/);
    if (articleMatch) {
      const article = data.articles.find((item) => String(item.id) === articleMatch[1] && item.status === 'PUBLISHED');
      if (!article) staticError('This article is not available.', 404);
      return staticResult({ article });
    }
    if (url.pathname === '/hospitals') {
      return staticResult({ hospitals: staticHospitalList(data, url.searchParams.get('q') || '') });
    }
    const hospitalMatch = url.pathname.match(/^\/hospitals\/([^/]+)$/);
    if (hospitalMatch) {
      const slug = decodeURIComponent(hospitalMatch[1]);
      const hospital = staticHospitals(data).find((item) => item.slug === slug);
      if (!hospital) staticError('This hospital is not in the directory.', 404);
      return staticResult({ hospital });
    }
    return staticError('This feature is not available in the static site.', 404);
  }

  async function request(path, options = {}) {
    if (staticMode) return staticRequest(path, options);

    const headers = new Headers(options.headers || {});
    const requestOptions = {
      method: options.method || 'GET',
      headers,
      credentials: 'same-origin',
    };

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      requestOptions.body = JSON.stringify(options.body);
    }
    if (options.auth) {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    let response;
    try {
      response = await fetch(`${apiBase}${path}`, requestOptions);
    } catch {
      throw new ApiError('Could not reach the service. Check that the application server is running.', 0);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError('The service returned an unreadable response.', response.status);
    }

    if (!response.ok || payload.success !== true) {
      if (response.status === 401 && options.auth) {
        sessionStorage.removeItem(TOKEN_KEY);
        document.dispatchEvent(new CustomEvent('epithyia:session-expired'));
      }
      throw new ApiError(payload.message || 'The request could not be completed.', response.status, payload.errors || []);
    }
    return payload;
  }

  async function login(credentials) {
    const result = await request('/auth/login', { method: 'POST', body: credentials });
    sessionStorage.setItem(TOKEN_KEY, result.data.token);
    return result.data;
  }

  async function logout() {
    try {
      if (sessionStorage.getItem(TOKEN_KEY)) {
        await request('/auth/logout', { method: 'POST', auth: true });
      }
    } finally {
      clearLocalSession();
    }
  }

  function clearLocalSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    document.dispatchEvent(new CustomEvent('epithyia:logged-out'));
  }

  window.EpithyiaApi = {
    request,
    isStaticSite: staticMode,
    siteUrl,
    login,
    logout,
    clearLocalSession,
    getToken: () => sessionStorage.getItem(TOKEN_KEY),
  };
})();
