(() => {
  const TOKEN_KEY = 'epithyia.jwt';
  const apiBase = (document.querySelector('meta[name="api-base"]')?.content || '/api').replace(/\/$/, '');

  class ApiError extends Error {
    constructor(message, status, errors = []) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.errors = errors;
    }
  }

  async function request(path, options = {}) {
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
    login,
    logout,
    clearLocalSession,
    getToken: () => sessionStorage.getItem(TOKEN_KEY),
  };
})();
