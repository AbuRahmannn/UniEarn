// ============================================================
//  db.js – UniEarn Automated Database Module
//  Uses Multi-Device Global Cloud Sync REST Engine + LocalStorage.
// ============================================================

const DB_NAME = 'UniEarnDB';
const DB_VERSION = 1;
const CLOUD_DB_URL = 'https://api.restful-api.dev/objects/ff808181a067127101a0873b93995acd';

// List of popular real-time universities and colleges
window.POPULAR_COLLEGES = [
  "JNTU Hyderabad",
  "Osmania University, Hyderabad",
  "MIT Pune",
  "VIT Vellore",
  "VIT Chennai",
  "SRM Institute, Chennai",
  "BITS Pilani (Hyderabad Campus)",
  "BITS Pilani (Main Campus)",
  "Delhi University (DU)",
  "Anna University, Chennai",
  "IIT Hyderabad",
  "IIT Bombay",
  "IIT Delhi",
  "IIT Madras",
  "LPU Punjab",
  "Amity University",
  "Bangalore University / RVCE",
  "Mumbai University",
  "ALIET Vijayawada",
  "Other College / City"
];

// College GPS Coordinates Lookup
window.COLLEGE_COORDINATES = {
  "JNTU Hyderabad": { lat: 17.4947, lon: 78.3912 },
  "Osmania University, Hyderabad": { lat: 17.4139, lon: 78.5284 },
  "MIT Pune": { lat: 18.5178, lon: 73.8151 },
  "VIT Vellore": { lat: 12.9692, lon: 79.1559 },
  "VIT Chennai": { lat: 12.8406, lon: 80.1534 },
  "SRM Institute, Chennai": { lat: 12.8231, lon: 80.0442 },
  "BITS Pilani (Hyderabad Campus)": { lat: 17.5449, lon: 78.5718 },
  "BITS Pilani (Main Campus)": { lat: 28.3639, lon: 75.5870 },
  "Delhi University (DU)": { lat: 28.6904, lon: 77.2066 },
  "Anna University, Chennai": { lat: 13.0102, lon: 80.2354 },
  "IIT Hyderabad": { lat: 17.5947, lon: 78.1230 },
  "IIT Bombay": { lat: 19.1334, lon: 72.9133 },
  "IIT Delhi": { lat: 28.5450, lon: 77.1926 },
  "IIT Madras": { lat: 12.9915, lon: 80.2337 },
  "LPU Punjab": { lat: 31.2536, lon: 75.7037 },
  "Amity University": { lat: 28.5439, lon: 77.3331 },
  "Bangalore University / RVCE": { lat: 12.9237, lon: 77.4987 },
  "Mumbai University": { lat: 19.0728, lon: 72.8570 },
  "ALIET Vijayawada": { lat: 16.5062, lon: 80.6480 }
};

// Haversine Distance Helper in Kilometers
window.calculateDistanceKm = function(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round((R * c) * 10) / 10;
};

class UniEarnDB {
  constructor() {
    this.storageKeyFreelancers = 'uniearn_freelancers_db';
    this.storageKeyUsers = 'uniearn_users_db';
    this.storageKeySession = 'uniearn_current_session';
    this.pendingOTP = null;
  }

  async init() {
    let existingFreelancers = this.getLocal(this.storageKeyFreelancers);
    if (!existingFreelancers) {
      this.setLocal(this.storageKeyFreelancers, []);
    }

    let existingUsers = this.getLocal(this.storageKeyUsers);
    if (!existingUsers) {
      this.setLocal(this.storageKeyUsers, []);
    }

    // Perform Global Cloud DB Synchronization on Init
    await this.syncFromCloud();

    return true;
  }

  // --- Global Multi-Device Cloud Synchronization Methods ---
  async syncFromCloud() {
    try {
      const resp = await fetch(CLOUD_DB_URL);
      if (!resp.ok) return;
      const res = await resp.json();
      const cloudData = res.data || {};

      const cloudUsers = cloudData.users || [];
      const cloudFreelancers = cloudData.freelancers || [];

      // Merge Cloud Users with Local Users
      const localUsers = this.getLocal(this.storageKeyUsers) || [];
      const userMap = new Map();
      [...cloudUsers, ...localUsers].forEach(u => {
        if (u && u.email) userMap.set(u.email.toLowerCase(), u);
      });
      const mergedUsers = Array.from(userMap.values());
      this.setLocal(this.storageKeyUsers, mergedUsers);

      // Merge Cloud Freelancers with Local Freelancers
      const localFreelancers = this.getLocal(this.storageKeyFreelancers) || [];
      const freelancerMap = new Map();
      [...cloudFreelancers, ...localFreelancers].forEach(f => {
        if (f && (f.id || f.name)) freelancerMap.set((f.id || f.name).toLowerCase(), f);
      });
      const mergedFreelancers = Array.from(freelancerMap.values());
      this.setLocal(this.storageKeyFreelancers, mergedFreelancers);

      // Push merged profiles to cloud if new local items exist
      if (mergedUsers.length > cloudUsers.length || mergedFreelancers.length > cloudFreelancers.length) {
        await this.syncToCloud();
      }
    } catch (e) {
      console.warn('Cloud Database Fetch Error (using offline local storage):', e);
    }
  }

  async syncToCloud() {
    try {
      const users = this.getLocal(this.storageKeyUsers) || [];
      const freelancers = this.getLocal(this.storageKeyFreelancers) || [];

      const payload = {
        name: "uniearn_main_db",
        data: {
          users: users,
          freelancers: freelancers,
          lastUpdated: new Date().toISOString()
        }
      };

      await fetch(CLOUD_DB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Cloud Database Push Error:', e);
    }
  }

  getLocal(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Storage Read Error:', e);
      return null;
    }
  }

  setLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage Write Error:', e);
    }
  }

  // --- Email OTP Verification System ---
  generateOTP(targetEmail) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.pendingOTP = {
      target: targetEmail.toLowerCase().trim(),
      code: code,
      expiresAt: Date.now() + 10 * 60 * 1000
    };
    return code;
  }

  verifyOTP(userCode) {
    if (!this.pendingOTP) {
      throw new Error('No OTP request found. Please request a new code.');
    }
    if (Date.now() > this.pendingOTP.expiresAt) {
      this.pendingOTP = null;
      throw new Error('OTP code expired. Please request a new code.');
    }
    if (this.pendingOTP.code !== userCode.trim()) {
      throw new Error('Invalid OTP code. Please check your email and try again.');
    }
    this.pendingOTP = null;
    return true;
  }

  // --- Freelancer Database Operations ---
  async getFreelancers() {
    await this.init();
    return this.getLocal(this.storageKeyFreelancers) || [];
  }

  async addFreelancer(freelancerData) {
    await this.init();
    const list = await this.getFreelancers();
    const rating = (4.7 + Math.random() * 0.3).toFixed(1);
    const reviews = Math.floor(5 + Math.random() * 25);

    let coords = window.COLLEGE_COORDINATES[freelancerData.location];
    if (!coords && freelancerData.lat && freelancerData.lon) {
      coords = { lat: freelancerData.lat, lon: freelancerData.lon };
    }

    const newEntry = {
      id: 'f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: freelancerData.userId || null,
      rating: rating,
      reviewsCount: reviews,
      isVerified: true,
      lat: coords ? coords.lat : 17.4947,
      lon: coords ? coords.lon : 78.3912,
      ...freelancerData,
      createdAt: new Date().toISOString()
    };
    list.unshift(newEntry);
    this.setLocal(this.storageKeyFreelancers, list);
    
    // Sync to Cloud DB
    this.syncToCloud();
    return newEntry;
  }

  async updateFreelancer(indexOrId, freelancerData) {
    await this.init();
    const list = await this.getFreelancers();
    let coords = window.COLLEGE_COORDINATES[freelancerData.location];
    if (coords) {
      freelancerData.lat = coords.lat;
      freelancerData.lon = coords.lon;
    }

    if (typeof indexOrId === 'number') {
      list[indexOrId] = { ...list[indexOrId], ...freelancerData };
    } else {
      const idx = list.findIndex(f => f.id === indexOrId);
      if (idx !== -1) list[idx] = { ...list[idx], ...freelancerData };
    }
    this.setLocal(this.storageKeyFreelancers, list);

    // Sync to Cloud DB
    this.syncToCloud();
    return true;
  }

  async deleteFreelancer(indexOrId) {
    await this.init();
    let list = await this.getFreelancers();
    if (typeof indexOrId === 'number') {
      list.splice(indexOrId, 1);
    } else {
      list = list.filter(f => f.id !== indexOrId);
    }
    this.setLocal(this.storageKeyFreelancers, list);

    // Sync to Cloud DB
    this.syncToCloud();
    return true;
  }

  async clearAllFreelancers() {
    this.setLocal(this.storageKeyFreelancers, []);
    this.syncToCloud();
  }

  async getFreelancerByUserId(userId, name) {
    const list = await this.getFreelancers();
    return list.find(f => f.userId === userId || f.name.toLowerCase() === (name || '').toLowerCase());
  }

  // --- User Auth & Registration ---
  async registerUser(userData) {
    await this.init();
    
    // Ensure latest accounts from Cloud DB before registering
    await this.syncFromCloud();
    const users = this.getLocal(this.storageKeyUsers) || [];

    const existing = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const userId = 'u_' + Date.now();
    let coords = window.COLLEGE_COORDINATES[userData.location];

    const newUser = {
      id: userId,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role || 'student',
      location: userData.location || '',
      phone: userData.phone || '',
      lat: userData.lat || (coords ? coords.lat : 17.4947),
      lon: userData.lon || (coords ? coords.lon : 78.3912),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this.setLocal(this.storageKeyUsers, users);

    if (userData.role === 'freelancer') {
      await this.addFreelancer({
        userId: userId,
        name: userData.name,
        address: userData.location || 'College Campus',
        location: userData.location || 'Student Freelancer',
        skills: userData.skills || 'General Services',
        work: userData.work || 'Freelance Work',
        phone: userData.phone || '',
        priceMin: userData.priceMin || '100',
        priceMax: userData.priceMax || '500',
        lat: newUser.lat,
        lon: newUser.lon
      });
    }

    // Sync new user & freelancer to Cloud DB so other devices can access it!
    await this.syncToCloud();

    this.setSession(newUser);
    return newUser;
  }

  async loginUser(emailOrPhone, password) {
    await this.init();
    
    // Pull latest user accounts from Cloud DB first!
    await this.syncFromCloud();
    
    const users = this.getLocal(this.storageKeyUsers) || [];
    const query = emailOrPhone.toLowerCase().trim();
    const user = users.find(u => (u.email.toLowerCase() === query || u.phone === query) && u.password === password);
    
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    this.setSession(user);
    return user;
  }

  async resetPassword(emailOrPhone, newPassword) {
    await this.init();
    await this.syncFromCloud();

    const users = this.getLocal(this.storageKeyUsers) || [];
    const query = emailOrPhone.toLowerCase().trim();
    const userIdx = users.findIndex(u => u.email.toLowerCase() === query || u.phone === query);

    if (userIdx === -1) {
      throw new Error('No user account found with that email address.');
    }

    users[userIdx].password = newPassword;
    this.setLocal(this.storageKeyUsers, users);
    await this.syncToCloud();
    return true;
  }

  setSession(user) {
    const sessionData = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: user.role,
      lat: user.lat,
      lon: user.lon,
      loggedInAt: new Date().toISOString()
    };
    this.setLocal(this.storageKeySession, sessionData);
  }

  getCurrentSession() {
    return this.getLocal(this.storageKeySession);
  }

  logoutUser() {
    localStorage.removeItem(this.storageKeySession);
  }
}

// Global Database Instance
window.uniEarnDB = new UniEarnDB();
