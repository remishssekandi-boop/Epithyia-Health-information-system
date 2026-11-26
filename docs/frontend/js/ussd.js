(() => {
  const Api = window.EpithyiaApi;
  const startForm = document.querySelector('#ussd-start-form');
  if (!startForm) return;

  const phone = document.querySelector('#ussd-phone');
  const inputForm = document.querySelector('#ussd-input-form');
  const selection = document.querySelector('#ussd-input');
  const menu = document.querySelector('#ussd-menu');
  const state = document.querySelector('#ussd-state');
  const feedback = document.querySelector('#ussd-feedback');
  const historyList = document.querySelector('#ussd-history');
  const submitButton = document.querySelector('#ussd-submit');
  const endButton = document.querySelector('#ussd-end');
  let sessionId = null;
  let inputPath = '';

  function showResponse(response) {
    const [prefix, ...lines] = response.split(' ');
    state.textContent = prefix === 'END' ? 'Session ended' : 'Menu active · Choose an option';
    menu.textContent = lines.join(' ');
    inputPath = prefix === 'END' ? '' : inputPath;
    selection.disabled = prefix === 'END';
    submitButton.disabled = prefix === 'END';
    endButton.disabled = prefix === 'END';
  }

  async function loadHistory() {
    if (!sessionId) return;
    const result = await Api.request(`/ussd/sessions/${encodeURIComponent(sessionId)}/events`);
    historyList.replaceChildren();
    for (const event of result.data.events) {
      const item = document.createElement('li');
      item.textContent = `${event.selection || 'Start'}\n${event.response}`;
      historyList.append(item);
    }
  }

  startForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.querySelector('#ussd-start');
    button.disabled = true;
    feedback.textContent = '';
    try {
      const result = await Api.request('/ussd/simulator/start', {
        method: 'POST',
        body: { phoneNumber: phone.value.trim() },
      });
      sessionId = result.data.sessionId;
      inputPath = '';
      showResponse(result.data.response);
      await loadHistory();
      selection.disabled = false;
      submitButton.disabled = false;
      endButton.disabled = false;
      selection.focus();
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  inputForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!sessionId || !selection.value.trim()) return;
    submitButton.disabled = true;
    feedback.textContent = '';
    const nextPath = inputPath ? `${inputPath}*${selection.value.trim()}` : selection.value.trim();
    try {
      const result = await Api.request('/ussd/simulator/continue', {
        method: 'POST',
        body: { sessionId, phoneNumber: phone.value.trim(), text: nextPath },
      });
      inputPath = nextPath;
      selection.value = '';
      showResponse(result.data.response);
      await loadHistory();
      if (!result.data.ended) {
        submitButton.disabled = false;
        selection.focus();
      }
    } catch (error) {
      feedback.textContent = error.message;
      submitButton.disabled = false;
    }
  });

  endButton.addEventListener('click', async () => {
    selection.value = '9';
    inputForm.requestSubmit();
  });
})();
