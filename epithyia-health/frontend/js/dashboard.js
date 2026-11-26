(() => {
  const Api = window.EpithyiaApi;
  const host = document.querySelector('#dashboard-content');
  if (!host) return;
  const title = document.querySelector('#dashboard-title');
  const description = document.querySelector('#dashboard-description');
  const roles = ['ADMIN', 'CONTENT_MANAGER', 'HEALTH_WORKER', 'USER'];

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  }

  function card(heading, text) {
    const section = element('section', 'dashboard-card', '');
    section.append(element('h2', '', heading), element('p', '', text));
    return section;
  }

  function shortcuts() {
    const section = card('Public services', 'These services use the same public APIs as other visitors.');
    const links = element('div', 'dashboard-shortcuts', '');
    for (const [label, href] of [
      ['Health information', '/health-information.php'],
      ['Hospital directory', '/hospitals.php'],
      ['USSD simulator', '/ussd.php'],
    ]) {
      const link = element('a', 'button button-outline', label);
      link.href = href;
      links.append(link);
    }
    section.append(links);
    host.append(section);
  }

  async function adminTools() {
    const section = card('Account administration', 'Review the accounts already supported by this application and change a user role. The API prevents removing the last active administrator.');
    const status = element('p', 'dashboard-feedback', 'Loading accounts…');
    const tableWrap = element('div', 'dashboard-table-wrap', '');
    section.append(status, tableWrap);
    host.append(section);
    try {
      const response = await Api.request('/users?limit=100', { auth: true });
      const table = element('table', 'dashboard-users', '');
      const head = element('thead', '', '');
      const headerRow = element('tr', '', '');
      for (const label of ['Name', 'Email', 'Role']) headerRow.append(element('th', '', label));
      head.append(headerRow);
      const body = element('tbody', '', '');
      for (const user of response.data.users) {
        const row = element('tr', '', '');
        row.append(element('td', '', user.name), element('td', '', user.email));
        const roleCell = element('td', '', '');
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Role for ${user.email}`);
        for (const role of roles) {
          const option = element('option', '', role);
          option.value = role;
          option.selected = role === user.role;
          select.append(option);
        }
        select.addEventListener('change', async () => {
          select.disabled = true;
          status.classList.remove('success');
          try {
            await Api.request(`/users/${encodeURIComponent(user.id)}/role`, {
              method: 'PATCH',
              auth: true,
              body: { role: select.value },
            });
            user.role = select.value;
            status.classList.add('success');
            status.textContent = `Updated ${user.email} to ${user.role}.`;
          } catch (error) {
            select.value = user.role;
            status.textContent = error.message;
          } finally {
            select.disabled = false;
          }
        });
        roleCell.append(select);
        row.append(roleCell);
        body.append(row);
      }
      table.append(head, body);
      tableWrap.append(table);
      status.textContent = `${response.data.users.length} accounts loaded.`;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function hospitalTools() {
    const section = card(
      'Add a hospital to the directory',
      'Enter public hospital details and a secure image URL. New listings appear in the public directory and are marked as not independently verified.',
    );
    const form = element('form', 'dashboard-form', '');
    const fields = [
      ['Hospital name', 'name', 'input', true, 200],
      ['Location', 'location', 'input', true, 200],
      ['Street address', 'address', 'input', false, 500],
      ['Public telephone number', 'phone', 'input', false, 50],
      ['Short description', 'description', 'textarea', true, 5000],
      ['Hours and operating information', 'operating_info', 'textarea', false, 2000],
      ['Emergency contact information', 'emergency_contact', 'input', false, 200],
      ['Hospital image URL (HTTPS)', 'image_path', 'url', true, 500],
    ];
    const controls = {};
    for (const [label, name, type, required, maxLength] of fields) {
      const wrapper = element('label', '', label);
      const control = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      control.name = name;
      control.required = required;
      control.maxLength = maxLength;
      if (type !== 'textarea') control.type = type;
      controls[name] = control;
      wrapper.append(control);
      form.append(wrapper);
    }
    const feedback = element('p', 'dashboard-feedback', '');
    feedback.setAttribute('role', 'status');
    const submit = element('button', 'button', 'Add hospital');
    submit.type = 'submit';
    form.append(submit, feedback);
    section.append(form);
    host.append(section);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      feedback.classList.remove('success');
      feedback.textContent = 'Adding hospital…';
      try {
        const body = Object.fromEntries(fields.map(([, name]) => [name, controls[name].value.trim()]));
        const result = await Api.request('/hospitals', { method: 'POST', auth: true, body });
        feedback.textContent = `${result.data.hospital.name} was added. View it in the hospital directory.`;
        feedback.classList.add('success');
        form.reset();
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
  }

  function displayAppointment(appointment, admin, status, reload) {
    const item = element('li', '', '');
    const details = [
      `${appointment.hospital_name} — ${appointment.appointment_date} at ${String(appointment.appointment_time).slice(0, 5)}`,
      `Status: ${appointment.status.toLowerCase()}`,
      appointment.requested_service ? `Requested service: ${appointment.requested_service}` : '',
      admin ? `Requested by: ${appointment.user_name} (${appointment.user_email}, ${appointment.user_phone})` : '',
      appointment.hospital_phone ? `Hospital telephone: ${appointment.hospital_phone}` : '',
    ].filter(Boolean);
    item.append(element('p', '', details.join(' · ')));
    if (admin && appointment.status === 'REQUESTED') {
      const actions = element('div', 'dashboard-shortcuts', '');
      for (const [nextStatus, label] of [['CONFIRMED', 'Confirm'], ['DECLINED', 'Decline']]) {
        const button = element('button', 'button button-outline', label);
        button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          status.classList.remove('success');
          status.textContent = `Updating request #${appointment.id}…`;
          try {
            const result = await Api.request(`/appointments/${encodeURIComponent(appointment.id)}/status`, {
              method: 'PATCH',
              auth: true,
              body: { status: nextStatus },
            });
            appointment.status = result.data.appointment.status;
            if (reload) await reload();
            status.classList.add('success');
            status.textContent = `Request #${appointment.id} marked ${nextStatus.toLowerCase()}. The community member will see the update on their dashboard.`;
          } catch (error) {
            status.textContent = error.message;
            button.disabled = false;
          }
        });
        actions.append(button);
      }
      item.append(actions);
    }
    return item;
  }

  async function appointmentAdminTools() {
    const section = card('Appointment requests', 'Review requests submitted by community members. Confirming a request updates its status in the member dashboard; contact the member directly if coordination is needed.');
    const status = element('p', 'dashboard-feedback', 'Loading appointment requests…');
    const list = element('ul', 'dashboard-list', '');
    section.append(status, list);
    host.append(section);

    await loadAppointments();

    async function loadAppointments() {
      try {
        const result = await Api.request('/appointments', { auth: true });
        list.replaceChildren();
        if (result.data.appointments.length === 0) {
          list.append(element('li', '', 'No appointment requests have been submitted.'));
        } else {
          for (const appointment of result.data.appointments) {
            list.append(displayAppointment(appointment, true, status, loadAppointments));
          }
        }
        status.textContent = `${result.data.appointments.length} appointment ${result.data.appointments.length === 1 ? 'request' : 'requests'} loaded.`;
      } catch (error) {
        status.textContent = error.message;
      }
    }
  }

  async function communityTools(user) {
    const section = card(
      'Request a hospital appointment',
      'Choose a hospital, preferred date and time, and the service you need. This saves a request for administrator review; it does not reserve a hospital slot or notify the hospital. Check the request status here and call the hospital to confirm arrangements.',
    );
    const contact = element('p', '', `Your account contact number is ${user.phone}. Keep it current so the administrator can follow up.`);
    const form = element('form', 'dashboard-form', '');
    const hospitalLabel = element('label', '', 'Hospital');
    const hospitalSelect = document.createElement('select');
    hospitalSelect.name = 'hospital_id';
    hospitalSelect.required = true;
    hospitalLabel.append(hospitalSelect);
    const dateLabel = element('label', '', 'Preferred date');
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.name = 'appointment_date';
    dateInput.required = true;
    const localDate = new Date();
    dateInput.min = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    dateLabel.append(dateInput);
    const timeLabel = element('label', '', 'Preferred time');
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.name = 'appointment_time';
    timeInput.required = true;
    timeLabel.append(timeInput);
    const serviceLabel = element('label', '', 'Service or department (optional)');
    const serviceInput = document.createElement('input');
    serviceInput.type = 'text';
    serviceInput.name = 'requested_service';
    serviceInput.maxLength = 120;
    serviceLabel.append(serviceInput);
    const feedback = element('p', 'dashboard-feedback', '');
    feedback.setAttribute('role', 'status');
    const submit = element('button', 'button', 'Send appointment request');
    submit.type = 'submit';
    form.append(hospitalLabel, dateLabel, timeLabel, serviceLabel, submit, feedback);
    const requestStatus = element('p', 'dashboard-feedback', 'Loading your appointment requests…');
    requestStatus.setAttribute('role', 'status');
    const requests = element('ul', 'dashboard-list', '');
    section.append(contact, form, element('h3', '', 'Your requests'), requestStatus, requests);
    host.append(section);

    async function loadAppointments() {
      try {
        const result = await Api.request('/appointments', { auth: true });
        requests.replaceChildren();
        if (result.data.appointments.length === 0) {
          requests.append(element('li', '', 'You have not requested an appointment yet.'));
        } else {
          for (const appointment of result.data.appointments) requests.append(displayAppointment(appointment, false, requestStatus));
        }
        requestStatus.textContent = `${result.data.appointments.length} appointment ${result.data.appointments.length === 1 ? 'request' : 'requests'} on your account.`;
      } catch (error) {
        requestStatus.textContent = error.message;
      }
    }

    try {
      const result = await Api.request('/hospitals');
      for (const hospital of result.data.hospitals) {
        const option = element('option', '', hospital.name);
        option.value = hospital.id;
        hospitalSelect.append(option);
      }
      if (result.data.hospitals.length === 0) {
        feedback.textContent = 'No hospitals are currently available in the directory.';
        submit.disabled = true;
      }
    } catch (error) {
      feedback.textContent = error.message;
      submit.disabled = true;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      feedback.classList.remove('success');
      feedback.textContent = 'Sending appointment request…';
      try {
        const result = await Api.request('/appointments', {
          method: 'POST',
          auth: true,
          body: {
            hospital_id: Number(hospitalSelect.value),
            appointment_date: dateInput.value,
            appointment_time: timeInput.value,
            requested_service: serviceInput.value.trim(),
          },
        });
        feedback.textContent = `Request #${result.data.appointment.id} saved as pending. Call ${result.data.appointment.hospital_name} to confirm availability.`;
        feedback.classList.add('success');
        form.reset();
        await loadAppointments();
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });

    await loadAppointments();
  }

  async function demoControls() {
    const section = card(
      'Local workspace controls',
      'These controls affect only starter records in the local SQLite database. Restoring them signs you out; accounts and records you add are preserved.',
    );
    const feedback = element('p', 'dashboard-feedback', '');
    feedback.setAttribute('role', 'status');
    const actions = element('div', 'dashboard-shortcuts', '');
    const clearButton = element('button', 'button button-outline', 'Clear USSD session history');
    clearButton.type = 'button';
    const resetButton = element('button', 'button button-danger', 'Restore starter records');
    resetButton.type = 'button';
    actions.append(clearButton, resetButton);
    const activityHeading = element('h3', '', 'Recent activity');
    const activityList = element('ul', 'dashboard-list', '');
    section.append(actions, feedback, activityHeading, activityList);
    host.append(section);

    async function loadActivity() {
      try {
        const result = await Api.request('/demo/activity', { auth: true });
        const items = [
          ...result.data.audit.map((item) => ({
            time: item.created_at,
            text: `${item.action} — ${item.entity}${item.entity_id ? ` #${item.entity_id}` : ''}`,
          })),
          ...result.data.ussd.map((item) => ({
            time: item.created_at,
            text: `USSD ${item.menu}: selection ${item.selection || '(start)'}`,
          })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20);
        activityList.replaceChildren();
        if (items.length === 0) activityList.append(element('li', '', 'No activity has been recorded yet.'));
        for (const item of items) {
          const entry = element('li', '', `${item.time} — ${item.text}`);
          activityList.append(entry);
        }
      } catch (error) {
        feedback.textContent = error.message;
      }
    }

    clearButton.addEventListener('click', async () => {
      clearButton.disabled = true;
      feedback.classList.remove('success');
      feedback.textContent = 'Clearing session history…';
      try {
        const result = await Api.request('/demo/sessions/clear', { method: 'POST', auth: true });
        feedback.textContent = result.data.message;
        feedback.classList.add('success');
        await loadActivity();
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        clearButton.disabled = false;
      }
    });

    resetButton.addEventListener('click', async () => {
      if (!window.confirm('Restore the starter records and sign out? Accounts and records you added will be preserved.')) return;
      resetButton.disabled = true;
      clearButton.disabled = true;
      feedback.classList.remove('success');
      feedback.textContent = 'Restoring starter records…';
      try {
        const result = await Api.request('/demo/reset', { method: 'POST', auth: true });
        feedback.textContent = result.data.message;
        Api.clearLocalSession();
        window.location.replace('/login.php');
      } catch (error) {
        feedback.textContent = error.message;
        resetButton.disabled = false;
        clearButton.disabled = false;
      }
    });

    await loadActivity();
  }

  async function contentManagerTools() {
    const section = card('Create a health-information draft', 'New articles start as private drafts. Publish only information that is accurate, locally appropriate, and has completed the required health review.');
    const form = element('form', 'dashboard-form', '');
    const fields = [
      ['Category', 'category_id', 'select'],
      ['Title', 'title', 'input'],
      ['Summary', 'summary', 'input'],
      ['Article text', 'content', 'textarea'],
    ];
    const controls = {};
    for (const [label, name, tag] of fields) {
      const wrapper = element('label', '', label);
      const control = document.createElement(tag);
      control.name = name;
      control.required = true;
      if (tag === 'input' && name === 'title') control.maxLength = 200;
      if (tag === 'input' && name === 'summary') control.maxLength = 500;
      if (tag === 'textarea') control.maxLength = 50000;
      controls[name] = control;
      wrapper.append(control);
      form.append(wrapper);
    }
    const feedback = element('p', 'dashboard-feedback', '');
    feedback.setAttribute('role', 'status');
    const submit = element('button', 'button', 'Save as draft');
    submit.type = 'submit';
    form.append(submit, feedback);
    section.append(form);
    host.append(section);

    try {
      const result = await Api.request('/health/categories', { auth: true });
      for (const category of result.data.categories.filter((item) => item.status === 'ACTIVE')) {
        const option = element('option', '', category.name);
        option.value = category.id;
        controls.category_id.append(option);
      }
    } catch (error) {
      feedback.textContent = error.message;
      submit.disabled = true;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      feedback.classList.remove('success');
      feedback.textContent = 'Saving draft…';
      try {
        const result = await Api.request('/health/articles', {
          method: 'POST',
          auth: true,
          body: {
            category_id: Number(controls.category_id.value),
            title: controls.title.value.trim(),
            summary: controls.summary.value.trim(),
            content: controls.content.value.trim(),
          },
        });
        const article = result.data.article;
        feedback.textContent = `Draft ${article.id} saved.`;
        feedback.classList.add('success');
        form.reset();
        const publish = element('button', 'button button-outline', 'Publish this article');
        publish.type = 'button';
        publish.addEventListener('click', async () => {
          publish.disabled = true;
          try {
            await Api.request(`/health/articles/${encodeURIComponent(article.id)}/publish`, {
              method: 'PATCH',
              auth: true,
            });
            feedback.textContent = `Article ${article.id} published.`;
            publish.remove();
          } catch (error) {
            feedback.classList.remove('success');
            feedback.textContent = error.message;
            publish.disabled = false;
          }
        });
        section.append(publish);
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function readOnlyTools(role) {
    const section = card(
      'Published information',
      role === 'HEALTH_WORKER'
        ? 'Your account can access published information but cannot create or publish content.'
        : 'Your account can browse public information but cannot access private drafts or manage content.',
    );
    const status = element('p', 'dashboard-feedback', 'Loading published information…');
    const list = element('ul', 'dashboard-list', '');
    section.append(status, list);
    host.append(section);
    try {
      const result = await Api.request('/health/articles?limit=5', { auth: true });
      status.textContent = `${result.data.pagination.total} published articles are available to this account.`;
      for (const article of result.data.articles) {
        const item = element('li', '', `${article.category_name}: ${article.title}`);
        list.append(item);
      }
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function load() {
    if (!Api.getToken()) {
      window.location.replace('/login.php');
      return;
    }
    try {
      const response = await Api.request('/auth/me', { auth: true });
      const user = response.data.user;
      if (!roles.includes(user.role)) throw new Error('This account has no configured dashboard role.');
      title.textContent = `Welcome, ${user.name}.`;
      description.textContent = `Signed in as ${user.role.replaceAll('_', ' ').toLowerCase()}. Your access is checked by the server on each protected operation.`;
      host.replaceChildren();
      shortcuts();
      if (user.role === 'ADMIN') {
        await adminTools();
        await hospitalTools();
        await appointmentAdminTools();
        const health = await Api.request('/health');
        if (health.data.databaseMode === 'demo') await demoControls();
      }
      else if (user.role === 'CONTENT_MANAGER') await contentManagerTools();
      else if (user.role === 'USER') await communityTools(user);
      else await readOnlyTools(user.role);
    } catch (error) {
      host.replaceChildren(element('p', 'empty-state', error.message));
      if (error.status === 401) window.location.replace('/login.php');
    }
  }

  load();
})();
