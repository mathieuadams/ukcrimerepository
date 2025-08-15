const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for development
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Cache for UK Police API dates
let datesCache = {
    data: null,
    timestamp: null,
    ttl: 60 * 60 * 1000 // 1 hour TTL
};

/**
 * Get available dates from UK Police API with caching
 */
async function getAvailableDates() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (datesCache.data && datesCache.timestamp && (now - datesCache.timestamp) < datesCache.ttl) {
        return datesCache.data;
    }
    
    try {
        const response = await fetch('https://data.police.uk/api/crimes-street-dates', {
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const dates = await response.json();
        const latestDate = dates && dates.length > 0 ? dates[0].date : '2025-06';
        
        // Update cache
        datesCache = {
            data: latestDate,
            timestamp: now,
            ttl: datesCache.ttl
        };
        
        console.log(`📅 Updated dates cache: ${latestDate}`);
        return latestDate;
        
    } catch (error) {
        console.error('❌ Error fetching dates:', error.message);
        return '2025-06'; // Fallback date
    }
}

/**
 * Validate coordinates
 */
function validateCoordinates(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
        return { valid: false, error: 'Invalid coordinate format' };
    }
    
    if (latitude < -90 || latitude > 90) {
        return { valid: false, error: 'Latitude must be between -90 and 90' };
    }
    
    if (longitude < -180 || longitude > 180) {
        return { valid: false, error: 'Longitude must be between -180 and 180' };
    }
    
    return { valid: true, lat: latitude, lng: longitude };
}

/**
 * Calculate bounds from crime data
 */
function calculateBounds(crimes) {
    if (!crimes || crimes.length === 0) return null;
    
    const validCrimes = crimes.filter(crime => 
        crime.location && 
        crime.location.latitude && 
        crime.location.longitude
    );
    
    if (validCrimes.length === 0) return null;
    
    const lats = validCrimes.map(crime => parseFloat(crime.location.latitude));
    const lngs = validCrimes.map(crime => parseFloat(crime.location.longitude));
    
    return {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
    };
}

/**
 * Process crime categories
 */
function processCrimeCategories(crimes) {
    const categories = {};
    
    crimes.forEach(crime => {
        const category = crime.category || 'unknown';
        categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
}

// Routes

/**
 * Home page
 */
app.get('/', async (req, res) => {
    try {
        const recentDate = await getAvailableDates();
        res.render('index', { 
            recentDate,
            title: 'CrimeSpotter UK - Live Crime Data Mapping'
        });
    } catch (error) {
        console.error('Error rendering home page:', error);
        res.status(500).render('error', { 
            error: 'Unable to load page',
            title: 'Error - CrimeSpotter UK'
        });
    }
});

// Add these routes to your server.js file, after the home route and before the API routes

/**
 * Statistics page
 */
app.get('/statistics', (req, res) => {
    try {
        res.render('statistics', { 
            title: 'Crime Statistics - CrimeSpotter UK'
        });
    } catch (error) {
        console.error('Error rendering statistics page:', error);
        res.status(500).render('error', { 
            error: 'Unable to load statistics page',
            title: 'Error - CrimeSpotter UK'
        });
    }
});

/**
 * About page
 */
app.get('/about', (req, res) => {
    try {
        res.render('about', { 
            title: 'About - CrimeSpotter UK'
        });
    } catch (error) {
        console.error('Error rendering about page:', error);
        res.status(500).render('error', { 
            error: 'Unable to load about page',
            title: 'Error - CrimeSpotter UK'
        });
    }
});

/**
 * Privacy Policy page
 */
app.get('/privacy', (req, res) => {
    try {
        res.render('privacy', { 
            title: 'Privacy Policy - CrimeSpotter UK'
        });
    } catch (error) {
        console.error('Error rendering privacy page:', error);
        res.status(500).render('error', { 
            error: 'Unable to load privacy policy',
            title: 'Error - CrimeSpotter UK'
        });
    }
});

/**
 * Terms of Service page
 */
app.get('/terms', (req, res) => {
    try {
        res.render('terms', { 
            title: 'Terms of Service - CrimeSpotter UK'
        });
    } catch (error) {
        console.error('Error rendering terms page:', error);
        res.status(500).render('error', { 
            error: 'Unable to load terms of service',
            title: 'Error - CrimeSpotter UK'
        });
    }
});

// Contact page (optional)
app.get('/contact', (req, res) => {
    res.redirect('/about#contact');
});

/**
 * API: Get crime data for a location
 */
app.get('/api/crimes', async (req, res) => {
    try {
        const { lat = '51.5074', lng = '-0.1278', date } = req.query;
        
        // Validate coordinates
        const validation = validateCoordinates(lat, lng);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error
            });
        }
        
        // Use provided date or get latest available
        const queryDate = date || await getAvailableDates();
        
        // Build UK Police API URL
        const ukApiUrl = `https://data.police.uk/api/crimes-street/all-crime?lat=${validation.lat}&lng=${validation.lng}&date=${queryDate}`;
        
        console.log(`🔍 Fetching: ${ukApiUrl}`);
        
        // Fetch crime data
        const response = await fetch(ukApiUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'CrimeSpotter-UK/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`UK Police API error: ${response.status} ${response.statusText}`);
        }
        
        const crimes = await response.json();
        
        console.log(`✅ Found ${crimes.length} crimes for ${validation.lat}, ${validation.lng}`);
        
        // Process data
        const categories = processCrimeCategories(crimes);
        const bounds = calculateBounds(crimes);
        
        // Return response
        res.json({
            success: true,
            location: `${validation.lat}, ${validation.lng}`,
            date: queryDate,
            count: crimes.length,
            crimes: crimes, // Return all crimes for mapping
            categories: categories,
            bounds: bounds,
            sample: crimes.length > 0 ? crimes[0] : null,
            message: crimes.length === 0 ? 'No crimes found in this area for the selected period' : null
        });
        
    } catch (error) {
        console.error('❌ API Error:', error.message);
        
        const statusCode = error.message.includes('timeout') ? 504 : 
                          error.message.includes('UK Police API') ? 502 : 500;
        
        res.status(statusCode).json({
            success: false,
            error: 'Failed to fetch crime data. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * API: Get available dates
 */
app.get('/api/dates', async (req, res) => {
    try {
        const response = await fetch('https://data.police.uk/api/crimes-street-dates', {
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const dates = await response.json();
        
        res.json({
            success: true,
            dates: dates.slice(0, 12), // Return last 12 months
            latest: dates.length > 0 ? dates[0].date : null
        });
        
    } catch (error) {
        console.error('❌ Error fetching dates:', error.message);
        res.status(500).json({
            success: false,
            error: 'Unable to fetch available dates'
        });
    }
});

/**
 * API: Get UK police forces
 */
app.get('/api/forces', async (req, res) => {
    try {
        const response = await fetch('https://data.police.uk/api/forces', {
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const forces = await response.json();
        
        res.json({
            success: true,
            forces: forces
        });
        
    } catch (error) {
        console.error('❌ Error fetching forces:', error.message);
        res.status(500).json({
            success: false,
            error: 'Unable to fetch police forces'
        });
    }
});

/**
 * API: Health check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'CrimeSpotter UK API',
        version: '1.0.0',
        uptime: process.uptime()
    });
});

/**
 * API: Search locations (for autocomplete)
 */
app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.length < 3) {
        return res.json({ suggestions: [] });
    }
    
    // This would integrate with a geocoding service
    // For now, return some sample suggestions
    const suggestions = [
        { name: 'London', coords: [51.5074, -0.1278] },
        { name: 'Manchester', coords: [53.4808, -2.2426] },
        { name: 'Birmingham', coords: [52.4862, -1.8904] },
        { name: 'Leeds', coords: [53.8008, -1.5491] },
        { name: 'Liverpool', coords: [53.4084, -2.9916] }
    ].filter(item => item.name.toLowerCase().includes(q.toLowerCase()));
    
    res.json({ suggestions });
});

// Error handling middleware
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

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 CrimeSpotter UK server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    
    // Initialize cache
    try {
        await getAvailableDates();
        console.log('✅ Initial data cache loaded');
    } catch (error) {
        console.log('⚠️ Warning: Could not load initial cache');
    }
});