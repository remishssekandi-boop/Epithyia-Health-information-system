(() => {
  const Api = window.EpithyiaApi;

  function feedback(element, message, isSuccess = false) {
    element.replaceChildren();
    element.classList.toggle('success', isSuccess);
    element.textContent = message;
  }

  function showAccountCreated(element) {
    element.replaceChildren(document.createTextNode('Account created successfully. '));
    const link = document.createElement('a');
    link.href = '/login.php';
    link.textContent = 'Log in now';
    element.append(link);
    element.classList.add('success');
  }

  function errorMessage(error) {
    return error.errors?.length ? `${error.message} ${error.errors.join(' ')}` : error.message;
  }

  function setupLogin() {
    const form = document.querySelector('#login-form');
    if (!form) return;
    const message = document.querySelector('#login-feedback');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      feedback(message, 'Signing in…');
      try {
        const data = await Api.login({
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
        });
        feedback(message, `Signed in as ${data.user.name}. Opening your role dashboard…`, true);
        window.location.assign('/dashboard.php');
      } catch (error) {
        feedback(message, errorMessage(error));
        button.disabled = false;
      }
    });
  }

  function setupRegistration() {
    const form = document.querySelector('#register-form');
    if (!form) return;
    const message = document.querySelector('#register-feedback');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const password = values.get('password');
      if (password !== values.get('confirmPassword')) {
        feedback(message, 'The password and confirmation do not match.');
        form.elements.confirmPassword.focus();
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      feedback(message, 'Creating your account…');
      try {
        await Api.request('/auth/register', {
          method: 'POST',
          body: {
            name: values.get('name').trim(),
            email: values.get('email').trim(),
            phone: values.get('phone').trim(),
            password,
          },
        });
        form.reset();
        showAccountCreated(message);
      } catch (error) {
        feedback(message, errorMessage(error));
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupLogin();
    setupRegistration();
  });
})();
