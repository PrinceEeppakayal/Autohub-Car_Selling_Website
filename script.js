document.addEventListener('DOMContentLoaded', function() {
  // API Base URL
  const API_URL = 'http://localhost:3000';

  // Store current user data and token globally
  let currentUser = null;
  let authToken = null;

  // Function to store auth data
  function storeAuthData(token, user) {
    localStorage.setItem('autoHubToken', token);
    localStorage.setItem('autoHubUser', JSON.stringify(user));
    authToken = token;
    currentUser = user;
  }

  // Function to clear auth data
  function clearAuthData() {
    localStorage.removeItem('autoHubToken');
    localStorage.removeItem('autoHubUser');
    authToken = null;
    currentUser = null;
  }

  // Function to load auth data from localStorage
  function loadAuthData() {
    const savedToken = localStorage.getItem('autoHubToken');
    const savedUser = localStorage.getItem('autoHubUser');
    if (savedToken && savedUser) {
      authToken = savedToken;
      try {
        currentUser = JSON.parse(savedUser);
      } catch (e) {
        console.error("Error parsing saved user data:", e);
        clearAuthData(); // Clear invalid data
      }
    }
    updateAuthStateUI(); // Update UI based on loaded state
  }

  // Function to make authenticated API calls
  async function fetchAuthenticated(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Check for auth errors specifically BEFORE trying to parse JSON
      if (response.status === 401 || response.status === 403) {
          console.warn(`Authentication error (${response.status}). Clearing stored token.`);
          clearAuthData(); // Clear invalid token/user data
          updateAuthStateUI(); // Update UI to reflect logged-out state
          // Optionally, redirect to login or show login modal here
          // showModal('authModal'); // Example: Show login modal
          throw new Error('Authentication failed. Please log in again.');
      }

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
      } else {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return { ok: response.ok, status: response.status, data: null };
      }

      if (!response.ok) {
        const errorMessage = data.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return { ok: true, status: response.status, data };
    } catch (error) {
      // Only log as API Fetch Error if it wasn't the specific auth error we handled
      if (!(error.message.includes('Authentication failed'))) {
          console.error('API Fetch Error:', error);
      }
      // Re-throw the error so form handlers can catch it
      throw error;
    }
  }

  // Consolidated function to update UI based on auth state
  function updateAuthStateUI() {
    const accountBtn = document.querySelector('.btn-auth');
    const loginWrapper = document.querySelector('.login-wrapper');
    const userDropdown = document.getElementById('userDropdown');

    if (!accountBtn || !loginWrapper) {
      console.error("Required auth UI elements not found!");
      return;
    }

    if (userDropdown) userDropdown.remove();
    accountBtn.removeEventListener('click', openAuthModal);
    accountBtn.removeEventListener('click', toggleUserDropdown);

    if (currentUser && authToken) {
      accountBtn.innerHTML = `
        <i class="bi bi-person-check-fill me-2"></i>
        <span class="d-none d-md-inline">${currentUser.firstName || currentUser.email.split('@')[0]}</span>
        <i class="bi bi-chevron-down ms-1 small"></i>
      `;
      accountBtn.removeAttribute('data-bs-toggle');
      accountBtn.removeAttribute('data-bs-target');
      accountBtn.addEventListener('click', toggleUserDropdown);
      createUserDropdown(currentUser, loginWrapper);
    } else {
      accountBtn.innerHTML = `<i class="bi bi-person-circle me-2"></i><span class="d-none d-md-inline">Account</span>`;
      accountBtn.setAttribute('data-bs-toggle', 'modal');
      accountBtn.setAttribute('data-bs-target', '#authModal');
      accountBtn.addEventListener('click', openAuthModal);
    }
  }

  // Function to open authentication modal
  function openAuthModal() {
    const authModalEl = document.getElementById('authModal');
    if (authModalEl) {
        const authModal = bootstrap.Modal.getOrCreateInstance(authModalEl);
        authModal.show();
    }
  }

  // Function to toggle user dropdown
  function toggleUserDropdown(e) {
    e.preventDefault();
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
      dropdown.classList.toggle('show');
    }
  }

  // Function to create user dropdown menu
  function createUserDropdown(user, parentElement) {
    const dropdown = document.createElement('div');
    dropdown.id = 'userDropdown';
    dropdown.className = 'user-dropdown';
    dropdown.innerHTML = `
      <div class="user-info p-3 border-bottom">
        <div class="fw-bold">${user.firstName ? user.firstName + ' ' + user.lastName : user.email}</div>
        <div class="small text-muted">${user.email}</div>
      </div>
      <a href="#" id="profileLink" class="dropdown-item py-2"><i class="bi bi-person me-2"></i> My Profile</a>
      <a href="#" id="savedCarsLink" class="dropdown-item py-2"><i class="bi bi-heart me-2"></i> Saved Cars</a>
      <a href="#" id="testDrivesLink" class="dropdown-item py-2"><i class="bi bi-clock-history me-2"></i> Test Drives</a>
      <div class="dropdown-divider"></div>
      <a href="#" id="logoutBtn" class="dropdown-item py-2 text-danger"><i class="bi bi-box-arrow-right me-2"></i> Logout</a>
    `;

    parentElement.appendChild(dropdown);

    document.getElementById('profileLink')?.addEventListener('click', showMyProfile);
    document.getElementById('savedCarsLink')?.addEventListener('click', showSavedCars);
    document.getElementById('testDrivesLink')?.addEventListener('click', showMyTestDrives);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  }

  // Function to handle logout
  function handleLogout(e) {
      e.preventDefault();
      clearAuthData();
      updateAuthStateUI();
      createToast('You have been successfully logged out.');
      document.getElementById('userDropdown')?.classList.remove('show');
  }

  // --- Modal Display Functions ---
  function showModal(modalId) {
      const modalEl = document.getElementById(modalId);
      if (modalEl) {
          const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.show();
      } else {
          console.error(`Modal with ID ${modalId} not found.`);
      }
  }

  // Function to hide modal
  function hideModal(modalId) {
      const modalEl = document.getElementById(modalId);
      if (modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
      }
  }

  // Function to show user profile in modal
  function showMyProfile(e) {
    e?.preventDefault();
    if (!currentUser) return;

    const profileModalBody = document.getElementById('profileModalBody');
    if (!profileModalBody) return;

    profileModalBody.innerHTML = `
      <dl class="row">
        <dt class="col-sm-4">First Name:</dt>
        <dd class="col-sm-8">${currentUser.firstName || 'N/A'}</dd>
        <dt class="col-sm-4">Last Name:</dt>
        <dd class="col-sm-8">${currentUser.lastName || 'N/A'}</dd>
        <dt class="col-sm-4">Email:</dt>
        <dd class="col-sm-8">${currentUser.email}</dd>
        <dt class="col-sm-4">Phone:</dt>
        <dd class="col-sm-8">${currentUser.phone || 'N/A'}</dd>
      </dl>
    `;
    showModal('profileModal');
    document.getElementById('userDropdown')?.classList.remove('show');
  }

  // Function to show saved cars (placeholder for future functionality)
  function showSavedCars(e) {
    e?.preventDefault();
    if (!currentUser) return;
    createToast('Saved Cars functionality is coming soon!', 'info');
    document.getElementById('userDropdown')?.classList.remove('show');
  }

  // Function to show user's test drives
  async function showMyTestDrives(e) {
    e?.preventDefault();
    if (!currentUser) return;

    const testDrivesModalBody = document.getElementById('testDrivesModalBody');
    if (!testDrivesModalBody) return;

    testDrivesModalBody.innerHTML = '<p>Loading test drives...</p>';
    showModal('testDrivesModal');
    document.getElementById('userDropdown')?.classList.remove('show');

    try {
      const result = await fetchAuthenticated(`${API_URL}/my-test-drives`);
      const testDrives = result.data;

      if (testDrives && Array.isArray(testDrives) && testDrives.length > 0) {
        let tableHTML = `
          <table class="table table-striped table-hover">
            <thead><tr><th>Car Model</th><th>Date</th><th>Time</th><th>Scheduled On</th></tr></thead>
            <tbody>
        `;
        testDrives.forEach(drive => {
          const scheduledDate = drive.createdAt ? new Date(drive.createdAt).toLocaleDateString() : 'N/A';
          tableHTML += `
            <tr>
              <td>${drive.carModel || 'N/A'}</td>
              <td>${drive.preferredDate || 'N/A'}</td>
              <td>${drive.preferredTime || 'N/A'}</td>
              <td>${scheduledDate}</td>
            </tr>
          `;
        });
        tableHTML += `</tbody></table>`;
        testDrivesModalBody.innerHTML = tableHTML;
      } else {
        testDrivesModalBody.innerHTML = '<p class="text-center text-muted">You have no scheduled test drives.</p>';
      }
    } catch (error) {
      console.error('[showMyTestDrives] Failed to fetch test drives:', error);
      testDrivesModalBody.innerHTML = '<p class="text-danger">Failed to load test drives. Please try again later.</p>';
    }
  }

  // --- Toast Notification ---
  function createToast(message, type = 'success', duration = 5000) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(toastContainer);
    }

    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    const bgClass = type === 'info' ? 'bg-info' : (type === 'danger' ? 'bg-danger' : 'bg-success');
    const iconClass = type === 'info' ? 'bi-info-circle-fill' : (type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill');

    toast.id = toastId;
    toast.className = `toast align-items-center text-white ${bgClass} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body"><i class="bi ${iconClass} me-2"></i> ${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: duration });
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => toast.remove());
  }

  // --- Form Message Display ---
  function showFormMessage(formElement, message, type = 'success') {
    const alertClass = `alert-${type}`;
    const iconClass = `bi-${type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill'}`;
    const messageClass = 'form-message-alert';
    const existingAlert = formElement.querySelector(`.${messageClass}`);
    if (existingAlert) existingAlert.remove();

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} ${messageClass} mt-3 d-flex align-items-center`;
    alertDiv.setAttribute('role', 'alert');
    alertDiv.innerHTML = `<i class="bi ${iconClass} me-2"></i> <div>${message}</div>`;

    const submitButton = formElement.querySelector('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      submitButton.parentNode.insertBefore(alertDiv, submitButton);
    } else {
      formElement.appendChild(alertDiv);
    }

    setTimeout(() => alertDiv.remove(), 5000);
  }

  // Function to show success message
  function showSuccessMessage(formElement, message) {
    showFormMessage(formElement, message, 'success');
  }

  // Function to show error message
  function showErrorMessage(formElement, message) {
    showFormMessage(formElement, message, 'danger');
  }

  // --- Generic Form Submission Handler ---
  async function handleFormSubmit(options) {
    const {
      formId,
      endpoint,
      method = 'POST',
      requiredFields = [],
      fieldSelectors = {},
      dataTransform = (data) => data,
      requireAuth = false,
      onSuccess,
      onError,
      clearFormOnSuccess = true,
      successMessageField = null,
      hideModalOnSuccess = null,
      successTimeout = 1500
    } = options;

    const formElement = document.getElementById(formId);
    if (!formElement) {
      console.error(`Form with ID ${formId} not found.`);
      return;
    }

    formElement.addEventListener('submit', async function(e) {
      e.preventDefault();

      if (requireAuth && (!currentUser || !authToken)) {
        showErrorMessage(formElement, 'Please log in to perform this action.');
        return;
      }

      const formData = new FormData(formElement);
      const data = {};
      let allFieldsValid = true;

      formData.forEach((value, key) => {
          const dataKey = Object.keys(fieldSelectors).find(k => fieldSelectors[k] === key) || key;
          data[dataKey] = value;
      });

      for (const key in fieldSelectors) {
          if (!data.hasOwnProperty(key)) {
              const element = document.getElementById(fieldSelectors[key]);
              if (element) {
                  data[key] = element.value || element.textContent;
              }
          }
      }

      if (requiredFields.length > 0) {
          for (const fieldName of requiredFields) {
              const element = formElement.querySelector(`[name="${fieldName}"], #${fieldName}`);
              if (!element || !element.value) {
                  allFieldsValid = false;
                  const dataKey = Object.keys(fieldSelectors).find(k => fieldSelectors[k] === fieldName) || fieldName;
                  showErrorMessage(formElement, `Please fill in the required field: ${dataKey}`);
                  break;
              }
          }
      }

      if (!allFieldsValid) return;

      const transformedData = dataTransform(data);

      try {
        const result = await fetchAuthenticated(`${API_URL}${endpoint}`, {
          method: method,
          body: JSON.stringify(transformedData),
        });

        if (successMessageField) {
            const successDiv = document.getElementById(successMessageField);
            if (successDiv) {
                successDiv.textContent = result.data.message || 'Operation successful!';
                successDiv.classList.remove('d-none');
                setTimeout(() => successDiv.classList.add('d-none'), successTimeout + 1500);
            } else {
                 showSuccessMessage(formElement, result.data.message || 'Operation successful!');
            }
        } else {
            showSuccessMessage(formElement, result.data.message || 'Operation successful!');
        }

        if (clearFormOnSuccess) {
          formElement.reset();
        }

        if (onSuccess) {
          onSuccess(result, formElement);
        }

        if (hideModalOnSuccess || successMessageField) {
            setTimeout(() => {
                if (hideModalOnSuccess) {
                    hideModal(hideModalOnSuccess);
                }
                if (!successMessageField) {
                    const existingAlert = formElement.querySelector('.form-message-alert');
                    if (existingAlert) existingAlert.remove();
                }
            }, successTimeout);
        }

      } catch (error) {
        showErrorMessage(formElement, error.message || 'An error occurred. Please try again.');
        if (onError) {
          onError(error, formElement);
        }
      }
    });
  }

  // Login Form Submission
  handleFormSubmit({
    formId: 'loginForm',
    endpoint: '/login',
    requiredFields: ['authEmail', 'authPassword'],
    fieldSelectors: { email: 'authEmail', password: 'authPassword' },
    onSuccess: (result) => {
      storeAuthData(result.data.token, result.data.user);
      updateAuthStateUI();
    },
    hideModalOnSuccess: 'authModal',
    successTimeout: 1000
  });

  // Register Form Submission
  handleFormSubmit({
    formId: 'registerForm',
    endpoint: '/register',
    requiredFields: ['authFirstName', 'authLastName', 'authRegisterEmail', 'authPhoneNumber', 'authRegisterPassword', 'authConfirmPassword', 'authTermsAgree'],
    fieldSelectors: {
        firstName: 'authFirstName',
        lastName: 'authLastName',
        email: 'authRegisterEmail',
        phone: 'authPhoneNumber',
        password: 'authRegisterPassword',
        confirmPassword: 'authConfirmPassword',
        termsAgree: 'authTermsAgree'
    },
    dataTransform: (data) => {
        data.termsAgree = document.getElementById('authTermsAgree')?.checked || false;
        if (!data.termsAgree) throw new Error("Please agree to the Terms of Service and Privacy Policy.");
        if (data.password !== data.confirmPassword) throw new Error("Passwords do not match.");
        delete data.confirmPassword;
        delete data.termsAgree;
        return data;
    },
    onSuccess: () => {
      const loginTabButton = document.getElementById('login-tab');
      if (loginTabButton) {
        const tab = new bootstrap.Tab(loginTabButton);
        tab.show();
      }
    },
    successTimeout: 1500
  });

  // Contact Form Submission
  handleFormSubmit({
    formId: 'contactForm',
    endpoint: '/contact',
    requireAuth: true,
    requiredFields: ['name', 'email', 'phone', 'interest', 'message'],
    fieldSelectors: { name: 'name', email: 'email', phone: 'phone', interest: 'interest', message: 'message' },
    onSuccess: (result, formElement) => {
        createToast(result.data.message || 'Message sent successfully!');
    }
  });

  // Test Drive Form Submission
  handleFormSubmit({
    formId: 'testDriveForm',
    endpoint: '/test-drive',
    requireAuth: true,
    requiredFields: ['testDriveName', 'testDriveEmail', 'testDrivePhone', 'testDriveDate', 'testDriveTime'],
    fieldSelectors: {
        name: 'testDriveName',
        email: 'testDriveEmail',
        phone: 'testDrivePhone',
        preferredDate: 'testDriveDate',
        preferredTime: 'testDriveTime',
        carModel: 'carDetailModalLabel'
    },
     dataTransform: (data) => {
        const carModelLabel = document.getElementById('carDetailModalLabel');
        data.carModel = carModelLabel?.textContent.replace(' Details', '').trim() || 'Unknown Car';
        return data;
    },
    onSuccess: (result) => {
        createToast(result.data.message || 'Test drive scheduled successfully!');
    },
    hideModalOnSuccess: 'testDriveModal',
    successTimeout: 1500
  });

  // Financing Form Submission
  handleFormSubmit({
    formId: 'financingForm',
    endpoint: '/financing-request',
    requireAuth: true,
    requiredFields: ['financingName', 'financingEmail', 'financingPhone', 'financingAmount', 'financingTerm'],
    fieldSelectors: {
        name: 'financingName',
        email: 'financingEmail',
        phone: 'financingPhone',
        amount: 'financingAmount',
        term: 'financingTerm',
        message: 'financingMessage'
    },
    successMessageField: 'financingSuccess',
    hideModalOnSuccess: 'serviceDetailModal',
    successTimeout: 3000
  });

// --- Smooth Scroll and Navbar Color Change ---
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      const isScrolled = window.scrollY > 50;
      navbar.style.backgroundColor = isScrolled ? 'rgba(33, 37, 41, 0.95)' : 'var(--dark-color)';
    });
  }

  // Smooth scroll for internal links
  document.addEventListener('click', function(e) {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (href.length <= 1 || href.startsWith('#!')) return;

    try {
        const targetElement = document.querySelector(href);
        if (targetElement) {
            e.preventDefault();
            const offsetTop = targetElement.offsetTop - (navbar?.offsetHeight || 80);

            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });

            document.querySelectorAll('.nav-link').forEach(navLink => navLink.classList.remove('active'));
            if (anchor.classList.contains('nav-link')) {
                anchor.classList.add('active');
            }
        }
    } catch (error) {
        console.warn(`Smooth scroll target not found or invalid selector: ${href}`);
    }
  });

  // --- Modal Initialization and Event Listeners ---
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('shown.bs.modal', function() {
      if (!currentUser) return;
      const form = this.querySelector('form');
      if (!form) return;

      const setInputValue = (selector, value) => {
          const input = form.querySelector(selector);
          if (input && value) input.value = value;
      };

      setInputValue('input[id*="Name" i]', `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim());
      setInputValue('input[id*="Email" i]', currentUser.email);
      setInputValue('input[id*="Phone" i]', currentUser.phone);
    });
  });

  // Set minimum date for test drive date input
  const testDriveDate = document.getElementById('testDriveDate');
  if (testDriveDate) {
      try {
        testDriveDate.setAttribute('min', new Date().toISOString().split('T')[0]);
      } catch (e) { console.error("Error setting min date:", e); }
  }

  // Set minimum date for financing date input
  const searchForm = document.querySelector('.search-wrapper form');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const searchInput = searchForm.querySelector('.search-input')?.value.toLowerCase().trim();
      if (!searchInput) return;

      const carsSection = document.getElementById('cars');
      if (!carsSection) return;

      window.scrollTo({ top: carsSection.offsetTop - (navbar?.offsetHeight || 80), behavior: 'smooth' });

      const carCards = carsSection.querySelectorAll('.car-card');
      let matchFound = false;
      const highlightClass = 'search-highlight';

      carCards.forEach(card => card.classList.remove(highlightClass));

      carCards.forEach(card => {
        const cardTitle = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
        const cardText = card.querySelector('.card-text')?.textContent.toLowerCase() || '';

        if (cardTitle.includes(searchInput) || cardText.includes(searchInput)) {
          card.classList.add(highlightClass);
          matchFound = true;
        }
      });

      setTimeout(() => {
        carCards.forEach(card => card.classList.remove(highlightClass));
      }, 3000);

      if (!matchFound) {
        createToast('No cars found matching your search.', 'info');
      }
    });
  }

  // Initialize search form if not already present
  const searchWrapper = document.querySelector('.search-wrapper');
  if (searchWrapper && !searchWrapper.querySelector('form')) {
    const inputGroup = searchWrapper.querySelector('.input-group');
    if (inputGroup) {
      const form = document.createElement('form');
      form.appendChild(inputGroup.cloneNode(true));
      inputGroup.parentNode.replaceChild(form, inputGroup);
    }
  }

  // Initialize car detail modal
  document.addEventListener('click', function(e) {
      const button = e.target.closest('.service-card .btn[data-bs-toggle="modal"][data-bs-target="#serviceDetailModal"]');
      if (button) {
          const serviceCard = button.closest('.service-card');
          const serviceTitle = serviceCard?.querySelector('.card-title')?.textContent || 'Service Details';
          const serviceDetailModalLabel = document.getElementById('serviceDetailModalLabel');
          if (serviceDetailModalLabel) {
              serviceDetailModalLabel.textContent = serviceTitle;
          }
      }
  });

  // Initialize car detail modal for car cards
  const requestCallBackBtn = document.getElementById('requestCallBack');
  if (requestCallBackBtn) {
    requestCallBackBtn.addEventListener('click', function() {
      if (!currentUser || !authToken) {
        createToast('Please log in to request a call back.', 'danger');
        return;
      }

      createToast('Call back request submitted successfully!');
      requestCallBackBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i> Request Submitted';
      requestCallBackBtn.disabled = true;

      setTimeout(() => {
        requestCallBackBtn.innerHTML = '<i class="bi bi-telephone me-2"></i> Request Call Back';
        requestCallBackBtn.disabled = false;
      }, 5000);
    });
  }

  // Initialize car detail modal for car cards
  document.addEventListener('click', function(e) {
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown && userDropdown.classList.contains('show') && !e.target.closest('.login-wrapper')) {
      userDropdown.classList.remove('show');
    }
  });

  // Load auth data on page load
  loadAuthData();

});