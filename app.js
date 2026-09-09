// ============================================================
//  app.js – UniEarn Client-Side & Automated DB Logic
//  Includes Live GPS Geolocation & Haversine Radius Filtering.
// ============================================================

let freelancers = [];
let pendingSignUpData = null;
let currentCategory = 'ALL';
let currentGPSCoords = null; // { lat, lon }

// ---- Initialise ----
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof AOS !== 'undefined') {
    AOS.init({ once: true, duration: 700, offset: 60 });
  }

  // Load freelancers from Automated Database & Start Real-time Multi-Device Sync Engine
  await loadFreelancersFromDB();
  checkCurrentSession();
  initTypewriterEffect();

  if (window.uniEarnDB) {
    window.uniEarnDB.startRealtimeSync(loadFreelancersFromDBSilently);
  }

  // Search & Filter Event Listeners
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', renderFreelancers);

  const locationFilterSelect = document.getElementById('locationFilterSelect');
  if (locationFilterSelect) locationFilterSelect.addEventListener('change', renderFreelancers);

  const radiusFilterSelect = document.getElementById('radiusFilterSelect');
  if (radiusFilterSelect) radiusFilterSelect.addEventListener('change', renderFreelancers);

  // Near Me Button Handler
  const nearMeBtn = document.getElementById('nearMeBtn');
  if (nearMeBtn) nearMeBtn.addEventListener('click', handleNearMeFilter);

  // Live GPS Detect Button Handler in Sign Up
  const detectSignUpLocationBtn = document.getElementById('detectSignUpLocationBtn');
  if (detectSignUpLocationBtn) detectSignUpLocationBtn.addEventListener('click', () => handleDetectLiveGPS(false));
  
  // Silently assess user live location for signup
  handleDetectLiveGPS(true);

  // Category Filter Chips Handler
  const categoryChips = document.getElementById('categoryChips');
  if (categoryChips) {
    categoryChips.addEventListener('click', e => {
      const btn = e.target.closest('.category-chip');
      if (!btn) return;
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category') || 'ALL';
      renderFreelancers();
    });
  }

  // Preset Skill & Service Chips Click Handler for Sign Up & Edit Forms
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;

    const targetId = chip.getAttribute('data-target');
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    const cleanVal = chip.textContent.replace(/^\+\s*/, '').trim();
    let currentVal = input.value.trim();
    let items = currentVal ? currentVal.split(',').map(s => s.trim()).filter(Boolean) : [];

    const existingIdx = items.findIndex(item => item.toLowerCase() === cleanVal.toLowerCase());
    if (existingIdx !== -1) {
      items.splice(existingIdx, 1);
      chip.classList.remove('bg-primary', 'text-white');
      chip.classList.add('bg-light', 'text-secondary');
    } else {
      items.push(cleanVal);
      chip.classList.remove('bg-light', 'text-secondary');
      chip.classList.add('bg-primary', 'text-white');
    }

    input.value = items.join(', ');
  });

  // Hero Sign Up Location Dropdown Custom Toggle
  const signUpLocSelect = document.getElementById('heroSignUpLocationSelect');
  const signUpCustomLoc = document.getElementById('heroSignUpCustomLocation');
  if (signUpLocSelect && signUpCustomLoc) {
    signUpLocSelect.addEventListener('change', () => {
      if (signUpLocSelect.value === 'Other') {
        signUpCustomLoc.classList.remove('d-none');
        signUpCustomLoc.required = true;
      } else {
        signUpCustomLoc.classList.add('d-none');
        signUpCustomLoc.required = false;
      }
    });
  }

  // Edit Listing Location Dropdown Custom Toggle
  const myEditLocSelect = document.getElementById('myEditLocationSelect');
  const myEditCustomLoc = document.getElementById('myEditCustomLocation');
  if (myEditLocSelect && myEditCustomLoc) {
    myEditLocSelect.addEventListener('change', () => {
      if (myEditLocSelect.value === 'Other') {
        myEditCustomLoc.classList.remove('d-none');
      } else {
        myEditCustomLoc.classList.add('d-none');
      }
    });
  }

  // Role toggle for Hero Sign Up
  const roleFreelancerRadio = document.getElementById('roleFreelancer');
  const roleStudentRadio = document.getElementById('roleStudent');
  const extraFields = document.getElementById('freelancerExtraFields');

  if (roleFreelancerRadio && roleStudentRadio && extraFields) {
    roleFreelancerRadio.addEventListener('change', () => {
      extraFields.style.display = 'block';
    });
    roleStudentRadio.addEventListener('change', () => {
      extraFields.style.display = 'none';
    });
  }

  // Form Handlers
  const heroLoginForm = document.getElementById('heroLoginForm');
  if (heroLoginForm) heroLoginForm.addEventListener('submit', handleHeroLogin);

  const heroSignUpForm = document.getElementById('heroSignUpForm');
  if (heroSignUpForm) heroSignUpForm.addEventListener('submit', startSignUpOTPFlow);

  const otpVerificationForm = document.getElementById('otpVerificationForm');
  if (otpVerificationForm) otpVerificationForm.addEventListener('submit', verifySignUpOTPAndComplete);

  const forgotPassStep1 = document.getElementById('forgotPassStep1');
  if (forgotPassStep1) forgotPassStep1.addEventListener('submit', handleForgotPassStep1);

  const forgotPassStep2 = document.getElementById('forgotPassStep2');
  if (forgotPassStep2) forgotPassStep2.addEventListener('submit', handleForgotPassStep2);

  const myListingForm = document.getElementById('myListingForm');
  if (myListingForm) myListingForm.addEventListener('submit', handleSaveMyListing);

  const navLogoutBtn = document.getElementById('navLogoutBtn');
  if (navLogoutBtn) navLogoutBtn.addEventListener('click', handleLogout);
});

// ---- Live GPS Geolocation & College/City Assessment Handler ----
function handleDetectLiveGPS(isSilent = false) {
  const detectBtn = document.getElementById('detectSignUpLocationBtn');
  const locSelect = document.getElementById('heroSignUpLocationSelect');
  const customLoc = document.getElementById('heroSignUpCustomLocation');

  if (!navigator.geolocation) {
    if (!isSilent) alert('Geolocation is not supported by your browser.');
    return;
  }

  if (detectBtn && !isSilent) {
    detectBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Assessing...';
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      currentGPSCoords = { lat, lon };

      try {
        // Reverse Geocode using OpenStreetMap Nominatim API
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
        const data = await resp.json();
        const address = data.address || {};

        const detectedCollegeName = address.university || address.college || address.amenity || address.building || '';
        const detectedCityName = address.city || address.town || address.village || address.suburb || address.city_district || address.county || address.state_district || 'My Location';

        // Match detected location against popular colleges
        let matchedCollege = null;
        if (window.POPULAR_COLLEGES && Array.isArray(window.POPULAR_COLLEGES)) {
          matchedCollege = window.POPULAR_COLLEGES.find(col => {
            if (col.includes('Other')) return false;
            const cLower = col.toLowerCase();
            return (detectedCollegeName && (cLower.includes(detectedCollegeName.toLowerCase()) || detectedCollegeName.toLowerCase().includes(cLower))) ||
                   (detectedCityName && cLower.includes(detectedCityName.toLowerCase()));
          });

          // Check coordinates distance (within 15km)
          if (!matchedCollege && window.COLLEGE_COORDINATES && window.calculateDistanceKm) {
            let minDistance = 15;
            for (const [colName, coords] of Object.entries(window.COLLEGE_COORDINATES)) {
              const dist = window.calculateDistanceKm(lat, lon, coords.lat, coords.lon);
              if (dist !== null && dist < minDistance) {
                minDistance = dist;
                matchedCollege = colName;
              }
            }
          }
        }

        if (locSelect) {
          if (matchedCollege) {
            locSelect.value = matchedCollege;
            if (customLoc) {
              customLoc.classList.add('d-none');
              customLoc.value = '';
            }
            if (!isSilent) alert(`📍 Recognized College Detected: ${matchedCollege}`);
          } else {
            // College not available in database: add user's live city to dropdown
            const cityLabel = detectedCityName;

            let existingOpt = Array.from(locSelect.options).find(opt => opt.value.toLowerCase() === cityLabel.toLowerCase());
            if (!existingOpt) {
              const newOpt = document.createElement('option');
              newOpt.value = cityLabel;
              newOpt.textContent = `📍 ${cityLabel} (Live City)`;
              locSelect.insertBefore(newOpt, locSelect.options[locSelect.options.length - 1]);
              locSelect.value = cityLabel;
            } else {
              locSelect.value = existingOpt.value;
            }

            if (customLoc) {
              customLoc.classList.remove('d-none');
              customLoc.value = detectedCollegeName ? `${detectedCollegeName}, ${cityLabel}` : cityLabel;
            }

            if (!isSilent) alert(`📍 College not in list. Added your live city: ${cityLabel}`);
          }
        }

        if (detectBtn) {
          detectBtn.innerHTML = `<i class="fas fa-check text-success me-1"></i>${matchedCollege || detectedCityName}`;
        }
      } catch (err) {
        if (locSelect) locSelect.value = 'Other';
        if (customLoc) {
          customLoc.classList.remove('d-none');
          customLoc.value = `Live GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
        }
        if (detectBtn) detectBtn.innerHTML = '<i class="fas fa-check text-success me-1"></i>GPS Located';
      }
    },
    error => {
      if (detectBtn) detectBtn.innerHTML = '<i class="fas fa-crosshairs me-1 text-danger"></i>Live GPS';
      if (!isSilent) alert('Could not access live location. Please select your college or city from the dropdown.');
    },
    { timeout: 10000 }
  );
}

// ---- Near Me Location & Radius Filter Handler ----
function handleNearMeFilter() {
  const session = window.uniEarnDB ? window.uniEarnDB.getCurrentSession() : null;
  const radiusFilterSelect = document.getElementById('radiusFilterSelect');
  const locationFilterSelect = document.getElementById('locationFilterSelect');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        currentGPSCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (radiusFilterSelect) radiusFilterSelect.value = '10'; // Default to 10km radius
        if (locationFilterSelect) locationFilterSelect.value = 'ALL';
        renderFreelancers();
        alert('📍 "Near Me" radius filter active! Showing freelancers within 10 km of your live GPS location.');
        document.getElementById('freelancers').scrollIntoView({ behavior: 'smooth' });
      },
      err => {
        // Fallback to session location
        if (session && session.location) {
          if (locationFilterSelect) {
            for (let i = 0; i < locationFilterSelect.options.length; i++) {
              if (session.location.toLowerCase().includes(locationFilterSelect.options[i].value.toLowerCase())) {
                locationFilterSelect.selectedIndex = i;
                break;
              }
            }
          }
          alert(`📍 Showing freelancers near ${session.location}`);
        } else {
          if (locationFilterSelect && locationFilterSelect.options.length > 1) {
            locationFilterSelect.selectedIndex = 1;
            alert(`📍 Showing freelancers near ${locationFilterSelect.value}`);
          }
        }
        renderFreelancers();
        document.getElementById('freelancers').scrollIntoView({ behavior: 'smooth' });
      }
    );
  } else {
    renderFreelancers();
    document.getElementById('freelancers').scrollIntoView({ behavior: 'smooth' });
  }
}

// ---- Top Header Navbar Buttons Handler ----
function openAuthModal(tab) {
  scrollToAuth(tab);
}

function scrollToAuth(tab) {
  const authModalEl = document.getElementById('authModal');
  if (authModalEl) {
    const modalInstance = bootstrap.Modal.getInstance(authModalEl);
    if (modalInstance) modalInstance.hide();
  }

  const heroSection = document.querySelector('.hero-section');
  if (heroSection) heroSection.scrollIntoView({ behavior: 'smooth' });

  if (tab === 'login') {
    const loginTabBtn = document.getElementById('hero-login-tab');
    if (loginTabBtn) new bootstrap.Tab(loginTabBtn).show();
  } else if (tab === 'signup') {
    const signupTabBtn = document.getElementById('hero-signup-tab');
    if (signupTabBtn) new bootstrap.Tab(signupTabBtn).show();
  }
}

// ---- Load & Render Data from DB ----
async function loadFreelancersFromDB() {
  if (window.uniEarnDB) {
    await window.uniEarnDB.syncFromCloud();
    freelancers = await window.uniEarnDB.getFreelancers();
  } else {
    freelancers = window.freelancersData || [];
  }
  renderFreelancers();
  updateStatCounter();
}

async function loadFreelancersFromDBSilently() {
  if (window.uniEarnDB) {
    const freshList = window.uniEarnDB.getLocal(window.uniEarnDB.storageKeyFreelancers) || [];
    if (JSON.stringify(freshList) !== JSON.stringify(freelancers)) {
      freelancers = freshList;
      renderFreelancers();
      updateStatCounter();
    }
  }
}

// ---- Session & Navbar Handler ----
function checkCurrentSession() {
  if (!window.uniEarnDB) return;
  const session = window.uniEarnDB.getCurrentSession();
  const navAuthArea = document.getElementById('navAuthArea');
  const navUserArea = document.getElementById('navUserArea');
  const navEditListingBtn = document.getElementById('navEditListingBtn');

  if (session) {
    if (navAuthArea) navAuthArea.classList.add('d-none');
    if (navUserArea) {
      navUserArea.classList.remove('d-none');
      navUserArea.classList.add('d-flex');
      document.getElementById('navUserName').textContent = session.name;
      document.getElementById('navUserRole').textContent = session.role === 'freelancer' ? 'Freelancer' : 'Student Client';
    }

    if (session.role === 'freelancer' && navEditListingBtn) {
      navEditListingBtn.classList.remove('d-none');
    } else if (navEditListingBtn) {
      navEditListingBtn.classList.add('d-none');
    }
  } else {
    if (navAuthArea) navAuthArea.classList.remove('d-none');
    if (navUserArea) {
      navUserArea.classList.add('d-none');
      navUserArea.classList.remove('d-flex');
    }
    if (navEditListingBtn) navEditListingBtn.classList.add('d-none');
  }
}

// ---- Hero Login Handler ----
async function handleHeroLogin(e) {
  e.preventDefault();
  const emailOrPhone = document.getElementById('heroLoginEmail').value.trim();
  const password = document.getElementById('heroLoginPassword').value.trim();
  const alertBox = document.getElementById('heroLoginAlert');

  if (alertBox) alertBox.classList.add('d-none');

  try {
    const user = await window.uniEarnDB.loginUser(emailOrPhone, password);
    checkCurrentSession();
    renderFreelancers();
    alert('Welcome back, ' + user.name + '!');
    document.getElementById('heroLoginForm').reset();
    document.getElementById('freelancers').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    if (alertBox) {
      alertBox.textContent = err.message || 'Login failed.';
      alertBox.classList.remove('d-none');
    } else {
      alert(err.message);
    }
  }
}

// ---- Email OTP Registration Flow ----
function startSignUpOTPFlow(e) {
  e.preventDefault();
  const role = document.querySelector('input[name="userRole"]:checked')?.value || 'student';
  const name = document.getElementById('heroSignUpName').value.trim();
  
  const locSelect = document.getElementById('heroSignUpLocationSelect');
  const customLoc = document.getElementById('heroSignUpCustomLocation');
  let location = locSelect.value;
  if (location === 'Other' && customLoc.value.trim()) {
    location = customLoc.value.trim();
  }

  const email = document.getElementById('heroSignUpEmail').value.trim();
  const phone = document.getElementById('heroSignUpPhone').value.trim();
  const password = document.getElementById('heroSignUpPassword').value.trim();
  const alertBox = document.getElementById('heroSignUpAlert');

  if (alertBox) alertBox.classList.add('d-none');

  pendingSignUpData = {
    role,
    name,
    location,
    email,
    phone,
    password,
    lat: currentGPSCoords ? currentGPSCoords.lat : undefined,
    lon: currentGPSCoords ? currentGPSCoords.lon : undefined
  };

  if (role === 'freelancer') {
    pendingSignUpData.skills = document.getElementById('heroSignUpSkills').value.trim() || 'General Services';
    pendingSignUpData.work = document.getElementById('heroSignUpWork').value.trim() || 'Freelance Work';
    
    let rawMin = parseInt(document.getElementById('heroSignUpPriceMin').value);
    let rawMax = parseInt(document.getElementById('heroSignUpPriceMax').value);

    let pMin = isNaN(rawMin) ? 0 : Math.max(0, rawMin);
    let pMax = isNaN(rawMax) ? 500 : Math.min(2000, Math.max(0, rawMax));

    if (rawMax > 2000) {
      alert('ℹ️ Maximum price is capped at ₹2,000. Price set to ₹2,000.');
    }
    if (pMin > pMax) pMin = pMax;

    pendingSignUpData.priceMin = String(pMin);
    pendingSignUpData.priceMax = String(pMax);
  }

  const otpCode = window.uniEarnDB.generateOTP(email);

  const targetEmailEl = document.getElementById('otpTargetEmail');
  if (targetEmailEl) targetEmailEl.textContent = email;
  document.getElementById('otpDisplayCode').textContent = otpCode;
  document.getElementById('otpInputCode').value = '';
  document.getElementById('otpAlert').classList.add('d-none');

  new bootstrap.Modal(document.getElementById('otpModal')).show();
}

async function verifySignUpOTPAndComplete(e) {
  e.preventDefault();
  const inputCode = document.getElementById('otpInputCode').value.trim();
  const otpAlert = document.getElementById('otpAlert');

  if (otpAlert) otpAlert.classList.add('d-none');

  try {
    window.uniEarnDB.verifyOTP(inputCode);
    const newUser = await window.uniEarnDB.registerUser(pendingSignUpData);
    pendingSignUpData = null;

    await loadFreelancersFromDB();
    checkCurrentSession();

    bootstrap.Modal.getInstance(document.getElementById('otpModal')).hide();
    alert('🎉 Email Security OTP verified! Account created and synced to Database. Welcome, ' + newUser.name + '!');
    document.getElementById('heroSignUpForm').reset();
    document.getElementById('freelancers').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    if (otpAlert) {
      otpAlert.textContent = err.message || 'Invalid OTP code.';
      otpAlert.classList.remove('d-none');
    }
  }
}

// ---- Forgot Password Flow ----
function openForgotPasswordModal() {
  document.getElementById('forgotPassStep1').classList.remove('d-none');
  document.getElementById('forgotPassStep2').classList.add('d-none');
  document.getElementById('forgotPassTarget').value = '';
  new bootstrap.Modal(document.getElementById('forgotPasswordModal')).show();
}

function handleForgotPassStep1(e) {
  e.preventDefault();
  const target = document.getElementById('forgotPassTarget').value.trim();
  if (!target) return;

  const otpCode = window.uniEarnDB.generateOTP(target);
  document.getElementById('forgotOTPCode').textContent = otpCode;
  document.getElementById('forgotPassStep1').classList.add('d-none');
  document.getElementById('forgotPassStep2').classList.remove('d-none');
}

async function handleForgotPassStep2(e) {
  e.preventDefault();
  const target = document.getElementById('forgotPassTarget').value.trim();
  const otpInput = document.getElementById('forgotOTPInput').value.trim();
  const newPass = document.getElementById('forgotNewPassword').value.trim();
  const alertBox = document.getElementById('forgotPassAlert');

  if (alertBox) alertBox.classList.add('d-none');

  try {
    window.uniEarnDB.verifyOTP(otpInput);
    await window.uniEarnDB.resetPassword(target, newPass);
    bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal')).hide();
    alert('🔑 Password reset successfully! You can now log in with your new password.');
  } catch (err) {
    if (alertBox) {
      alertBox.textContent = err.message || 'Failed to reset password.';
      alertBox.classList.remove('d-none');
    }
  }
}

// ---- Client Hire WhatsApp Gate ----
function handleHireClick(phone) {
  const session = window.uniEarnDB ? window.uniEarnDB.getCurrentSession() : null;

  if (!session) {
    alert('🔒 Please log in or sign up first as a student to contact freelancers on WhatsApp.');
    scrollToAuth('login');
    return;
  }

  const cleanNum = phone.replace(/\D/g, '');
  const prefilledMessage = encodeURIComponent('HI "Uni Earn" Freelancer I can across your profile and I want to hire you!');
  window.open(`https://wa.me/${cleanNum}?text=${prefilledMessage}`, '_blank');
}

// ---- Self-Service Freelancer Listing Editing ----
async function openMyListingModal() {
  const session = window.uniEarnDB ? window.uniEarnDB.getCurrentSession() : null;
  if (!session) return;

  const profile = await window.uniEarnDB.getFreelancerByUserId(session.id, session.name);
  if (!profile) {
    alert('No freelancer profile found for your account.');
    return;
  }

  document.getElementById('myEditName').value = profile.name;
  
  const selectEl = document.getElementById('myEditLocationSelect');
  if (selectEl) {
    let found = false;
    for (let i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value.toLowerCase() === profile.location.toLowerCase()) {
        selectEl.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found) {
      selectEl.value = 'Other';
      const customLoc = document.getElementById('myEditCustomLocation');
      if (customLoc) {
        customLoc.classList.remove('d-none');
        customLoc.value = profile.location;
      }
    }
  }

  document.getElementById('myEditSkills').value = profile.skills;
  document.getElementById('myEditWork').value = profile.work;
  document.getElementById('myEditPhone').value = profile.phone;
  document.getElementById('myEditPriceMin').value = profile.priceMin || '';
  document.getElementById('myEditPriceMax').value = profile.priceMax || '';

  new bootstrap.Modal(document.getElementById('myListingModal')).show();
}

async function handleSaveMyListing(e) {
  e.preventDefault();
  const session = window.uniEarnDB ? window.uniEarnDB.getCurrentSession() : null;
  if (!session) return;

  const profile = await window.uniEarnDB.getFreelancerByUserId(session.id, session.name);
  if (!profile) return;

  const locSelect = document.getElementById('myEditLocationSelect');
  const customLoc = document.getElementById('myEditCustomLocation');
  let location = locSelect ? locSelect.value : profile.location;
  if (location === 'Other' && customLoc && customLoc.value.trim()) {
    location = customLoc.value.trim();
  }

  let rawMin = parseInt(document.getElementById('myEditPriceMin').value);
  let rawMax = parseInt(document.getElementById('myEditPriceMax').value);

  let pMin = isNaN(rawMin) ? 0 : Math.max(0, rawMin);
  let pMax = isNaN(rawMax) ? 2000 : Math.min(2000, Math.max(0, rawMax));

  if (rawMax > 2000) {
    alert('ℹ️ Maximum price is capped at ₹2,000. Price set to ₹2,000.');
  }
  if (pMin > pMax) pMin = pMax;

  const updatedData = {
    name: document.getElementById('myEditName').value.trim(),
    location: location,
    skills: document.getElementById('myEditSkills').value.trim(),
    work: document.getElementById('myEditWork').value.trim(),
    phone: document.getElementById('myEditPhone').value.trim(),
    priceMin: String(pMin),
    priceMax: String(pMax)
  };

  await window.uniEarnDB.updateFreelancer(profile.id, updatedData);
  await loadFreelancersFromDB();
  bootstrap.Modal.getInstance(document.getElementById('myListingModal')).hide();
  alert('✨ Your listing has been updated successfully in the Database!');
}

async function handleDeleteMyListing() {
  const session = window.uniEarnDB ? window.uniEarnDB.getCurrentSession() : null;
  if (!session) return;

  const profile = await window.uniEarnDB.getFreelancerByUserId(session.id, session.name);
  if (!profile) {
    alert('No active freelancer listing found to delete.');
    return;
  }

  if (confirm('⚠️ Are you sure you want to delete your freelancer gig listing? This action will remove your gig from UniEarn globally.')) {
    await window.uniEarnDB.deleteFreelancer(profile.id);
    const modalEl = document.getElementById('myListingModal');
    if (modalEl) {
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
    }
    await loadFreelancersFromDB();
    alert('🗑️ Your freelancer gig listing has been deleted successfully from the Database.');
  }
}

async function handleDeleteMyListingDirect(freelancerId) {
  if (confirm('⚠️ Are you sure you want to delete this freelancer gig listing? This action cannot be undone.')) {
    await window.uniEarnDB.deleteFreelancer(freelancerId);
    await loadFreelancersFromDB();
    alert('🗑️ Freelancer gig listing deleted successfully.');
  }
}

function handleLogout() {
  if (window.uniEarnDB) {
    window.uniEarnDB.logoutUser();
    checkCurrentSession();
    renderFreelancers();
    alert('You have logged out.');
  }
}

// ---- Render Freelancer Cards ----
function renderFreelancers() {
  const queryInput = document.getElementById('searchInput');
  const query = queryInput ? (queryInput.value || '').toLowerCase() : '';

  const locationFilterSelect = document.getElementById('locationFilterSelect');
  const selectedLocation = locationFilterSelect ? locationFilterSelect.value : 'ALL';

  const radiusFilterSelect = document.getElementById('radiusFilterSelect');
  const selectedRadius = radiusFilterSelect ? radiusFilterSelect.value : 'ALL';

  const container = document.getElementById('freelancerCards');
  const noResults = document.getElementById('noResults');
  if (!container) return;

  container.innerHTML = '';

  const session = window.uniEarnDB ? window.uniEarnDB.getCurrentSession() : null;
  const userLat = currentGPSCoords ? currentGPSCoords.lat : (session && session.lat ? session.lat : 17.4947);
  const userLon = currentGPSCoords ? currentGPSCoords.lon : (session && session.lon ? session.lon : 78.3912);

  const filtered = freelancers.filter(f => {
    // Search query filter
    const blob = `${f.name} ${f.address} ${f.location} ${f.skills} ${f.work}`.toLowerCase();
    const matchesQuery = blob.includes(query);

    // Location filter
    const matchesLocation = (selectedLocation === 'ALL') || f.location.toLowerCase().includes(selectedLocation.toLowerCase());

    // Radius distance filter
    let matchesRadius = true;
    if (selectedRadius !== 'ALL' && window.calculateDistanceKm) {
      const dist = window.calculateDistanceKm(userLat, userLon, f.lat, f.lon);
      if (dist !== null && dist > parseFloat(selectedRadius)) {
        matchesRadius = false;
      }
    }

    // Category filter
    let matchesCategory = true;
    if (currentCategory !== 'ALL') {
      const catBlob = `${f.skills} ${f.work}`.toLowerCase();
      if (currentCategory === 'PPT') matchesCategory = catBlob.includes('ppt') || catBlob.includes('writing') || catBlob.includes('assignment');
      else if (currentCategory === 'Video') matchesCategory = catBlob.includes('video') || catBlob.includes('editing');
      else if (currentCategory === 'Web') matchesCategory = catBlob.includes('web') || catBlob.includes('code') || catBlob.includes('developer');
      else if (currentCategory === 'Design') matchesCategory = catBlob.includes('design') || catBlob.includes('photo') || catBlob.includes('poster');
      else if (currentCategory === 'Tutoring') matchesCategory = catBlob.includes('tutor') || catBlob.includes('teach');
    }

    return matchesQuery && matchesLocation && matchesRadius && matchesCategory;
  });

  if (filtered.length === 0) {
    if (noResults) noResults.style.display = 'block';
  } else {
    if (noResults) noResults.style.display = 'none';
  }

  filtered.forEach((f, idx) => {
    const initials = f.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const skillTags = f.skills.split(',').map(s => s.trim()).filter(Boolean).map(s => `<span class="skill-tag">${s}</span>`).join('');
    const workTags  = f.work.split(',').map(s => s.trim()).filter(Boolean).map(s => `<span class="work-tag">${s}</span>`).join('');

    // Distance calculation
    const distanceKm = (window.calculateDistanceKm && f.lat && f.lon) ? window.calculateDistanceKm(userLat, userLon, f.lat, f.lon) : null;
    const distanceBadge = distanceKm !== null ? `<span class="badge bg-light text-primary border rounded-pill px-2 py-1 small me-2"><i class="fas fa-location-arrow me-1"></i>${distanceKm} km</span>` : '';

    const col = document.createElement('div');
    col.className = 'col-sm-6 col-lg-4';
    col.setAttribute('data-aos', 'fade-up');
    col.setAttribute('data-aos-delay', String((idx % 6) * 80));

    // Self-Service Edit & Delete Buttons for Freelancer Owner
    let selfEditBtn = '';
    if (session && (session.id === f.userId || session.name.toLowerCase() === f.name.toLowerCase())) {
      selfEditBtn = `
        <button class="btn-edit ms-2" title="Edit My Listing" onclick="openMyListingModal()">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn-delete ms-2" title="Delete My Listing" onclick="handleDeleteMyListingDirect('${f.id}')">
          <i class="fas fa-trash-alt"></i>
        </button>
      `;
    }

    col.innerHTML = `
      <div class="freelancer-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div class="freelancer-card-header p-3">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="freelancer-avatar mb-0">${initials}</div>
            <span class="rating-badge"><i class="fas fa-star text-warning me-1"></i>${f.rating || '4.9'} (${f.reviewsCount || 14})</span>
          </div>
          <h5 class="fw-bold mb-1">${f.name}</h5>
          <div class="d-flex align-items-center justify-content-between text-white-50 small">
            <span><i class="fas fa-university me-1"></i>${f.location}</span>
            <span class="badge bg-white text-dark rounded-pill px-2 py-1 fw-semibold small"><i class="fas fa-check-circle text-success me-1"></i>Verified</span>
          </div>
        </div>
        <div class="freelancer-card-body p-3">
          <div class="info-row"><i class="fas fa-tools me-2 text-primary"></i><span>${skillTags || f.skills}</span></div>
          <div class="info-row"><i class="fas fa-briefcase me-2 text-danger"></i><span>${workTags || f.work}</span></div>
          <div class="d-flex align-items-center justify-content-between mt-2">
            ${(f.priceMin || f.priceMax) ? `<div class="price-badge"><i class="fas fa-rupee-sign me-1"></i>₹${f.priceMin || '0'} – ₹${f.priceMax || '?'}</div>` : '<div></div>'}
            ${distanceBadge}
          </div>
        </div>
        <div class="freelancer-card-footer p-3 bg-light border-top d-flex align-items-center">
          <button onclick="handleHireClick('${f.phone}')" class="btn-hire flex-fill shadow-sm">
            <i class="fab fa-whatsapp me-1"></i> Hire via WhatsApp
          </button>
          ${selfEditBtn}
        </div>
      </div>
    `;
    container.appendChild(col);
  });

  if (typeof AOS !== 'undefined') AOS.refresh();
}

// ---- Stats Counter Animation ----
function updateStatCounter() {
  const el = document.getElementById('statFreelancers');
  if (!el) return;
  const target = freelancers.length;
  let current = 0;
  if (target === 0) { el.textContent = '0'; return; }
  const step = Math.max(1, Math.floor(target / 30));
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = current;
  }, 30);
}

// ---- Typewriter Effect for Hero Description ----
function initTypewriterEffect() {
  const target = document.getElementById('typewriterTarget');
  if (!target) return;

  const fullText = "Access student services, register as a freelancer, or log in to connect directly with fellow student freelancers.";
  let index = 0;
  target.textContent = "";

  function typeChar() {
    if (index < fullText.length) {
      target.textContent += fullText.charAt(index);
      index++;
      setTimeout(typeChar, 35);
    }
  }

  typeChar();
}

