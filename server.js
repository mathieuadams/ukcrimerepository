// server.js
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;



// If you're behind a proxy/CDN (Render/Heroku/Nginx), this makes req.protocol honor X-Forwarded-Proto
app.set('trust proxy', 1);

// -------------------- Middleware --------------------
app.use(helmet({
  contentSecurityPolicy: false, // allow inline scripts/styles while developing
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static + views
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Page locals (for header active state + footer year)
app.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  let page = 'other';
  if (p === '/') page = 'index';
  else if (p.startsWith('/cities')) page = 'cities';
  else if (p.startsWith('/city')) page = 'city';
  else if (p.startsWith('/about')) page = 'about';
  else if (p.startsWith('/privacy')) page = 'privacy';
  else if (p.startsWith('/terms')) page = 'terms';
  else if (p.startsWith('/contact')) page = 'contact';

  res.locals.page = page;
  res.locals.year = new Date().getFullYear();
  res.locals.baseUrl = `${req.protocol}://${req.get('host')}`;
  next();
});

// -------------------- Data --------------------
// Hoisted city database so multiple routes (and sitemap) can use it.
const cityData = {
  london: { name: 'London', lat: 51.5074, lng: -0.1278, region: 'Greater London' },
  manchester: { name: 'Manchester', lat: 53.4808, lng: -2.2426, region: 'Greater Manchester' },
  birmingham: { name: 'Birmingham', lat: 52.4862, lng: -1.8904, region: 'West Midlands' },
  leeds: { name: 'Leeds', lat: 53.8008, lng: -1.5491, region: 'West Yorkshire' },
  liverpool: { name: 'Liverpool', lat: 53.4084, lng: -2.9916, region: 'Merseyside' },
  sheffield: { name: 'Sheffield', lat: 53.3811, lng: -1.4701, region: 'South Yorkshire' },
  bristol: { name: 'Bristol', lat: 51.4545, lng: -2.5879, region: 'South West' },
  newcastle: { name: 'Newcastle', lat: 54.9783, lng: -1.6178, region: 'Tyne and Wear' },
  nottingham: { name: 'Nottingham', lat: 52.9548, lng: -1.1581, region: 'East Midlands' },
  plymouth: { name: 'Plymouth', lat: 50.3755, lng: -4.1427, region: 'Devon' },
  southampton: { name: 'Southampton', lat: 50.9097, lng: -1.4044, region: 'Hampshire' },
  portsmouth: { name: 'Portsmouth', lat: 50.8198, lng: -1.0880, region: 'Hampshire' },
  leicester: { name: 'Leicester', lat: 52.6369, lng: -1.1398, region: 'Leicestershire' },
  coventry: { name: 'Coventry', lat: 52.4068, lng: -1.5197, region: 'West Midlands' },
  cardiff: { name: 'Cardiff', lat: 51.4816, lng: -3.1791, region: 'Wales' },
  swansea: { name: 'Swansea', lat: 51.6214, lng: -3.9436, region: 'Wales' },
  bradford: { name: 'Bradford', lat: 53.7960, lng: -1.7594, region: 'West Yorkshire' },
  brighton: { name: 'Brighton & Hove', lat: 50.8225, lng: -0.1372, region: 'East Sussex' },
  oxford: { name: 'Oxford', lat: 51.7520, lng: -1.2577, region: 'Oxfordshire' },
  cambridge: { name: 'Cambridge', lat: 52.2053, lng: 0.1218, region: 'Cambridgeshire' },
  exeter: { name: 'Exeter', lat: 50.7256, lng: -3.5269, region: 'Devon' },
  york: { name: 'York', lat: 53.9600, lng: -1.0873, region: 'North Yorkshire' },
  bath: { name: 'Bath', lat: 51.3811, lng: -2.3590, region: 'Somerset' },
  norwich: { name: 'Norwich', lat: 52.6309, lng: 1.2974, region: 'Norfolk' },
  reading: { name: 'Reading', lat: 51.4543, lng: -0.9781, region: 'Berkshire' },
  derby: { name: 'Derby', lat: 52.9226, lng: -1.4746, region: 'Derbyshire' },
  stoke: { name: 'Stoke-on-Trent', lat: 53.0027, lng: -2.1794, region: 'Staffordshire' },
  wolverhampton: { name: 'Wolverhampton', lat: 52.5865, lng: -2.1288, region: 'West Midlands' },
  'milton-keynes': { name: 'Milton Keynes', lat: 52.0406, lng: -0.7594, region: 'Buckinghamshire' },
  newport: { name: 'Newport', lat: 51.5842, lng: -2.9977, region: 'Wales' }
};
const citySlugs = Object.keys(cityData);

// Dates cache (for latest available month)
let datesCache = {
  data: null,         // 'YYYY-MM'
  timestamp: null,
  ttl: 60 * 60 * 1000 // 1 hour
};

// -------------------- Helpers --------------------
async function getAvailableDates() {
  const now = Date.now();
  if (datesCache.data && datesCache.timestamp && (now - datesCache.timestamp) < datesCache.ttl) {
    return datesCache.data;
  }
  try {
    const response = await fetch('https://data.police.uk/api/crimes-street-dates', { timeout: 10000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const dates = await response.json();
    const latestDate = (dates && dates.length > 0) ? dates[0].date : '2025-06';
    datesCache = { data: latestDate, timestamp: now, ttl: datesCache.ttl };
    console.log(`📅 Updated dates cache: ${latestDate}`);
    return latestDate;
  } catch (err) {
    console.error('❌ Error fetching dates:', err.message);
    return '2025-06'; // fallback
  }
}

function validateCoordinates(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { valid: false, error: 'Invalid coordinate format' };
  }
  if (latitude < -90 || latitude > 90) return { valid: false, error: 'Latitude must be between -90 and 90' };
  if (longitude < -180 || longitude > 180) return { valid: false, error: 'Longitude must be between -180 and 180' };
  return { valid: true, lat: latitude, lng: longitude };
}

function calculateBounds(crimes) {
  if (!Array.isArray(crimes) || crimes.length === 0) return null;
  const points = crimes.filter(c => c?.location?.latitude && c?.location?.longitude);
  if (points.length === 0) return null;
  const lats = points.map(c => parseFloat(c.location.latitude));
  const lngs = points.map(c => parseFloat(c.location.longitude));
  return { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) };
}

function processCrimeCategories(crimes) {
  const categories = {};
  (crimes || []).forEach(c => {
    const k = c.category || 'unknown';
    categories[k] = (categories[k] || 0) + 1;
  });
  return categories;
}

// -------------------- Page Routes --------------------
app.get('/', async (req, res) => {
  try {
    const recentDate = await getAvailableDates();
    res.render('index', { title: 'CrimeSpotter UK - Live Crime Data Mapping', recentDate });
  } catch (err) {
    console.error('Home render error:', err);
    res.status(500).render('error', { title: 'Error - CrimeSpotter UK', error: 'Unable to load page' });
  }
});

app.get('/cities', (req, res) => {
  try {
    res.render('cities', { title: 'Browse by City - CrimeSpotter UK', cities: cityData });
  } catch (err) {
    console.error('Cities render error:', err);
    res.status(500).render('error', { title: 'Error - CrimeSpotter UK', error: 'Unable to load cities page' });
  }
});

app.get('/city/:cityname', async (req, res) => {
  try {
    const slug = (req.params.cityname || '').toLowerCase();
    const city = cityData[slug];
    if (!city) {
      return res.status(404).render('error', { title: '404 - CrimeSpotter UK', error: 'City not found' });
    }
    res.render('city', {
      title: `${city.name} Crime Statistics - CrimeSpotter UK`,
      cityName: city.name,
      cityLat: city.lat,
      cityLng: city.lng,
      cityRegion: city.region
    });
  } catch (err) {
    console.error('City render error:', err);
    res.status(500).render('error', { title: 'Error - CrimeSpotter UK', error: 'Unable to load city page' });
  }
});

app.get('/about', (req, res) => {
  try {
    res.render('about', { title: 'About - CrimeSpotter UK' });
  } catch (err) {
    res.status(500).render('error', { title: 'Error - CrimeSpotter UK', error: 'Unable to load about page' });
  }
});

app.get('/privacy', (req, res) => {
  try {
    res.render('privacy', { title: 'Privacy Policy - CrimeSpotter UK' });
  } catch (err) {
    res.status(500).render('error', { title: 'Error - CrimeSpotter UK', error: 'Unable to load privacy policy' });
  }
});

app.get('/terms', (req, res) => {
  try {
    res.render('terms', { title: 'Terms of Service - CrimeSpotter UK' });
  } catch (err) {
    res.status(500).render('error', { title: 'Error - CrimeSpotter UK', error: 'Unable to load terms of service' });
  }
});

app.get('/contact', (req, res) => {
  try {
    res.render('contact', { title: 'Contact Us - CrimeSpotter UK' });
  } catch (err) {
    res.status(500).render('error', { title: 'Error - CrimeSpotter UK', error: 'Unable to load contact page' });
  }
});

// -------------------- API Routes --------------------
app.get('/api/crimes', async (req, res) => {
  try {
    const { lat = '51.5074', lng = '-0.1278', date } = req.query;
    const validation = validateCoordinates(lat, lng);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const queryDate = date || await getAvailableDates();
    const ukApiUrl = `https://data.police.uk/api/crimes-street/all-crime?lat=${validation.lat}&lng=${validation.lng}&date=${queryDate}`;
    console.log(`🔍 Fetching: ${ukApiUrl}`);

    const response = await fetch(ukApiUrl, {
      timeout: 15000,
      headers: { 'User-Agent': 'CrimeSpotter-UK/1.0' }
    });
    if (!response.ok) throw new Error(`UK Police API error: ${response.status} ${response.statusText}`);

    const crimes = await response.json();
    console.log(`✅ Found ${crimes.length} crimes for ${validation.lat}, ${validation.lng}`);

    const categories = processCrimeCategories(crimes);
    const bounds = calculateBounds(crimes);

    res.json({
      success: true,
      location: `${validation.lat}, ${validation.lng}`,
      date: queryDate,
      count: crimes.length,
      crimes,
      categories,
      bounds,
      sample: crimes.length > 0 ? crimes[0] : null,
      message: crimes.length === 0 ? 'No crimes found in this area for the selected period' : null
    });
  } catch (error) {
    console.error('❌ /api/crimes error:', error.message);
    const statusCode = error.message.includes('timeout') ? 504 :
                       error.message.includes('UK Police API') ? 502 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to fetch crime data. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/dates', async (req, res) => {
  try {
    const response = await fetch('https://data.police.uk/api/crimes-street-dates', { timeout: 10000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const dates = await response.json();
    res.json({ success: true, dates: dates.slice(0, 12), latest: dates[0]?.date || null });
  } catch (err) {
    console.error('❌ /api/dates error:', err.message);
    res.status(500).json({ success: false, error: 'Unable to fetch available dates' });
  }
});

app.get('/api/forces', async (req, res) => {
  try {
    const response = await fetch('https://data.police.uk/api/forces', { timeout: 10000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const forces = await response.json();
    res.json({ success: true, forces });
  } catch (err) {
    console.error('❌ /api/forces error:', err.message);
    res.status(500).json({ success: false, error: 'Unable to fetch police forces' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CrimeSpotter UK API',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 3) return res.json({ suggestions: [] });
  const suggestions = [
    { name: 'London', coords: [51.5074, -0.1278] },
    { name: 'Manchester', coords: [53.4808, -2.2426] },
    { name: 'Birmingham', coords: [52.4862, -1.8904] },
    { name: 'Leeds', coords: [53.8008, -1.5491] },
    { name: 'Liverpool', coords: [53.4084, -2.9916] }
  ].filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
  res.json({ suggestions });
});

// Handle contact form submissions
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const sanitized = {
      name: String(name).slice(0, 100).replace(/[<>]/g, ''),
      email: String(email).slice(0, 100),
      subject: String(subject).slice(0, 200).replace(/[<>]/g, ''),
      message: String(message).slice(0, 5000).replace(/[<>]/g, '')
    };

    console.log('📧 Contact Form Submission:', {
      timestamp: new Date().toISOString(),
      name: sanitized.name,
      email: sanitized.email,
      subject: sanitized.subject
    });

    // TODO: send via nodemailer or external email service
    res.json({ success: true, message: 'Thank you for your message. We will respond within 24-48 hours.' });
  } catch (err) {
    console.error('❌ Contact form error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message. Please try again later.' });
  }
});

// -------------------- Sitemap & Robots --------------------
// -------------------- Sitemap --------------------
app.get('/sitemap.xml', async (req, res) => {
  try {
    // Always build absolute URLs from your canonical host (recommended)
    const canonicalHost = process.env.CANONICAL_HOST || req.get('host'); // e.g. 'www.crimespotter.co.uk'
    const base = `https://${canonicalHost}`;

    const staticPaths = ['/', '/cities', '/about', '/contact', '/privacy', '/terms'];

    let latest = null;
    try { latest = await getAvailableDates(); } catch {}
    const isoToday = new Date().toISOString().split('T')[0];
    const lastmodCity = latest ? `${latest}-01` : isoToday;

    const urls = [
      ...staticPaths.map(p => ({
        loc: `${base}${p}`, lastmod: isoToday, changefreq: 'weekly', priority: p === '/' ? '1.0' : '0.8'
      })),
      ...citySlugs.map(slug => ({
        loc: `${base}/city/${slug}`, lastmod: lastmodCity, changefreq: 'weekly', priority: '0.7'
      }))
    ];

    const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res
      .status(200)
      .set('Content-Type', 'application/xml; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600')
      .send(xml);
  } catch (err) {
    console.error('sitemap error', err);
    res.status(500).type('application/xml').send('<?xml version="1.0"?><error/>');
  }
});

app.get('/robots.txt', (req, res) => {
  res
    .type('text/plain')
    .set('Cache-Control', 'public, max-age=3600')
    .send(
`User-agent: *
Allow: /

Sitemap: https://www.crimespotter.co.uk/sitemap.xml
Sitemap: https://crimespotter.co.uk/sitemap.xml
`);
});


// -------------------- Error Handlers (MUST BE LAST) --------------------
app.use((req, res) => {
  res.status(404).render('error', {
    error: 'Page not found',
    title: '404 - CrimeSpotter UK'
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).render('error', {
    error: 'Internal server error',
    title: 'Error - CrimeSpotter UK'
  });
});

// -------------------- Start --------------------
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 CrimeSpotter UK server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  try {
    await getAvailableDates();
    console.log('✅ Initial data cache loaded');
  } catch {
    console.log('⚠️ Warning: Could not load initial cache');
  }
});
