// ============================================================
//  api/db.js – UniEarn Vercel Serverless Cloud Database API
//  Handles cross-device real-time sync for Gigs, Freelancers & Users.
// ============================================================

let memoryStore = {
  users: [],
  freelancers: [
    {
      id: "f_default_1",
      userId: "u_default_1",
      name: "Abdul Rahman",
      address: "ALIET Vijayawada",
      location: "ALIET Vijayawada",
      skills: "writing work",
      work: "Assignment writing, record writing",
      phone: "852094464",
      priceMin: "100",
      priceMax: "500",
      rating: "4.8",
      reviewsCount: 14,
      isVerified: true,
      lat: 16.5062,
      lon: 80.6480,
      createdAt: "2026-09-09T18:00:00.000Z"
    }
  ],
  lastUpdated: new Date().toISOString()
};

module.exports = async (req, res) => {
  // CORS Headers for global access across web, mobile, Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'success',
        data: memoryStore
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {}
      }

      if (body && body.data) {
        if (Array.isArray(body.data.freelancers)) {
          memoryStore.freelancers = body.data.freelancers;
        }
        if (Array.isArray(body.data.users)) {
          memoryStore.users = body.data.users;
        }
        memoryStore.lastUpdated = new Date().toISOString();
      }

      return res.status(200).json({
        status: 'success',
        data: memoryStore
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
