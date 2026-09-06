// ============================================================
//  app.js – UniEarn Client-Side Logic
//  Data lives in data.js  (window.freelancersData)
//  No localStorage, no server, no database.
// ============================================================

const ADMIN_PASSWORD = '696969';
let freelancers = window.freelancersData || [];

// ---- Initialise ----
document.addEventListener('DOMContentLoaded', () => {
  AOS.init({ once: true, duration: 700, offset: 60 });
  renderFreelancers();
  updateStatCounter();

  // Event listeners
  document.getElementById('adminBtn').addEventListener('click', adminLogin);
  document.getElementById('logoutBtn').addEventListener('click', adminLogout);
  document.getElementById('addBtn').addEventListener('click', openAddModal);
  document.getElementById('saveBtn').addEventListener('click', saveFreelancer);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => { if (e.target.files[0]) importExcel(e.target.files[0]); });
  document.getElementById('exportBtn').addEventListener('click', exportExcel);
  document.getElementById('exportJsBtn').addEventListener('click', exportJS);
  document.getElementById('searchInput').addEventListener('input', renderFreelancers);
});

// ---- Render Freelancer Cards ----
function renderFreelancers() {
  const query = (document.getElementById('searchInput').value || '').toLowerCase();
  const container = document.getElementById('freelancerCards');
  const noResults = document.getElementById('noResults');
  container.innerHTML = '';

  const filtered = freelancers.filter(f => {
    const blob = `${f.name} ${f.address} ${f.location} ${f.skills} ${f.work}`.toLowerCase();
    return blob.includes(query);
  });

  if (filtered.length === 0) {
    noResults.style.display = 'block';
  } else {
    noResults.style.display = 'none';
  }

  filtered.forEach((f, idx) => {
    // Find real index in the master array
    const realIdx = freelancers.indexOf(f);
    const initials = f.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const skillTags = f.skills.split(',').map(s => s.trim()).filter(Boolean).map(s => `<span class="skill-tag">${s}</span>`).join('');
    const workTags  = f.work.split(',').map(s => s.trim()).filter(Boolean).map(s => `<span class="work-tag">${s}</span>`).join('');
    const cleanNum  = f.phone.replace(/\D/g, '');

    const col = document.createElement('div');
    col.className = 'col-sm-6 col-lg-4';
    col.setAttribute('data-aos', 'fade-up');
    col.setAttribute('data-aos-delay', String((idx % 6) * 80));

    let adminBtns = '';
    if (window.isAdmin) {
      adminBtns = `
        <button class="btn-edit" title="Edit" onclick="openEditModal(${realIdx})"><i class="fas fa-pen"></i></button>
        <button class="btn-delete" title="Delete" onclick="deleteFreelancer(${realIdx})"><i class="fas fa-trash"></i></button>
      `;
    }

    col.innerHTML = `
      <div class="freelancer-card">
        <div class="freelancer-card-header">
          <div class="freelancer-avatar">${initials}</div>
          <h5>${f.name}</h5>
          <small><i class="fas fa-map-marker-alt me-1"></i>${f.location}</small>
        </div>
        <div class="freelancer-card-body">
          <div class="info-row"><i class="fas fa-home"></i><span>${f.address}</span></div>
          <div class="info-row"><i class="fas fa-tools"></i><span>${skillTags || f.skills}</span></div>
          <div class="info-row"><i class="fas fa-briefcase"></i><span>${workTags || f.work}</span></div>
          ${(f.priceMin || f.priceMax) ? `<div class="price-badge"><i class="fas fa-rupee-sign me-1"></i>₹${f.priceMin || '0'} – ₹${f.priceMax || '?'}</div>` : ''}
        </div>
        <div class="freelancer-card-footer">
          <a href="https://wa.me/${cleanNum}" target="_blank" class="btn-hire">
            <i class="fab fa-whatsapp me-1"></i> Hire
          </a>
          ${adminBtns}
        </div>
      </div>
    `;
    container.appendChild(col);
  });

  // Re-init AOS for newly added elements
  AOS.refresh();
}

// ---- Stats Counter Animation ----
function updateStatCounter() {
  const el = document.getElementById('statFreelancers');
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

// ---- CRUD ----
function deleteFreelancer(index) {
  if (!confirm('Delete this freelancer?')) return;
  freelancers.splice(index, 1);
  window.freelancersData = freelancers;
  renderFreelancers();
  updateStatCounter();
}

function openEditModal(index) {
  const f = freelancers[index];
  document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-edit me-2"></i>Edit Freelancer';
  document.getElementById('nameInput').value = f.name;
  document.getElementById('addressInput').value = f.address;
  document.getElementById('locationInput').value = f.location;
  document.getElementById('skillsInput').value = f.skills;
  document.getElementById('workInput').value = f.work;
  document.getElementById('phoneInput').value = f.phone;
  document.getElementById('priceMinInput').value = f.priceMin || '';
  document.getElementById('priceMaxInput').value = f.priceMax || '';
  document.getElementById('editIndex').value = index;
  new bootstrap.Modal(document.getElementById('freelancerModal')).show();
}

function openAddModal() {
  document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-plus me-2"></i>Add Freelancer';
  document.getElementById('freelancerForm').reset();
  document.getElementById('editIndex').value = '';
  new bootstrap.Modal(document.getElementById('freelancerModal')).show();
}

function saveFreelancer() {
  const f = {
    name:     document.getElementById('nameInput').value.trim(),
    address:  document.getElementById('addressInput').value.trim(),
    location: document.getElementById('locationInput').value.trim(),
    skills:   document.getElementById('skillsInput').value.trim(),
    work:     document.getElementById('workInput').value.trim(),
    phone:    document.getElementById('phoneInput').value.trim(),
    priceMin: document.getElementById('priceMinInput').value.trim(),
    priceMax: document.getElementById('priceMaxInput').value.trim()
  };
  if (!f.name || !f.phone) { alert('Name and Phone are required.'); return; }

  const editIdx = document.getElementById('editIndex').value;
  if (editIdx !== '') {
    freelancers[parseInt(editIdx, 10)] = f;
  } else {
    freelancers.push(f);
  }
  window.freelancersData = freelancers;
  renderFreelancers();
  updateStatCounter();
  bootstrap.Modal.getInstance(document.getElementById('freelancerModal')).hide();
}

// ---- Excel Import / Export ----
function importExcel(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: ['Name','Address','Location','Skills','Work','Phone','PriceMin','PriceMax'],
      range: 1
    });
    freelancers = rows.map(r => ({
      name:     r.Name     || '',
      address:  r.Address  || '',
      location: r.Location || '',
      skills:   r.Skills   || '',
      work:     r.Work     || '',
      phone:    String(r.Phone || ''),
      priceMin: String(r.PriceMin || ''),
      priceMax: String(r.PriceMax || '')
    }));
    window.freelancersData = freelancers;
    renderFreelancers();
    updateStatCounter();
    alert('Imported ' + freelancers.length + ' freelancer(s) from Excel.');
  };
  reader.readAsArrayBuffer(file);
}

function exportExcel() {
  const data = [
    ['Name','Address','Location','Skills','Work','Phone','PriceMin','PriceMax'],
    ...freelancers.map(f => [f.name, f.address, f.location, f.skills, f.work, f.phone, f.priceMin || '', f.priceMax || ''])
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Freelancers');
  XLSX.writeFile(wb, 'freelancers.xlsx');
}

// ---- Export data.js (save data into the code) ----
function exportJS() {
  const json = JSON.stringify(freelancers, null, 2);
  const content = `// UniEarn Freelancer Data – Auto-generated\n// Replace data.js with this file to persist changes.\nwindow.freelancersData = ${json};\n`;
  const blob = new Blob([content], { type: 'application/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data.js';
  a.click();
  URL.revokeObjectURL(a.href);
  alert('data.js downloaded!\\nReplace the existing data.js in your project folder with this file to save changes permanently.');
}

// ---- Admin Login / Logout ----
window.isAdmin = false;

function adminLogin() {
  const panel = document.getElementById('adminPanel');
  if (panel.classList.contains('open')) {
    // Already open, close it
    panel.classList.remove('open');
    return;
  }
  const pwd = prompt('Enter Admin Password:');
  if (pwd === ADMIN_PASSWORD) {
    window.isAdmin = true;
    panel.classList.add('open');
    renderFreelancers();
  } else if (pwd !== null) {
    alert('Incorrect password.');
  }
}

function adminLogout() {
  window.isAdmin = false;
  document.getElementById('adminPanel').classList.remove('open');
  renderFreelancers();
}
