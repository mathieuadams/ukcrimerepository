/**
 * CrimeSpotter UK - Main Application
 * Handles overall app functionality, search, navigation, and user interactions
 */

class CrimeSpotterApp {
    constructor() {
        this.crimeMap = null;
        this.isInitialized = false;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('🚀 Initializing CrimeSpotter UK...');
        
        try {
            // Hide loading screen
            this.hideLoadingScreen();
            
            // Initialize map
            this.initializeMap();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load available dates
            await this.loadAvailableDates();
            
            // Load initial data for London
            await this.loadInitialData();
            
            // Setup header scroll effect
            this.setupHeaderEffects();
            
            this.isInitialized = true;
            console.log('✅ CrimeSpotter UK initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }

    /**
     * Initialize the crime map
     */
    initializeMap() {
        if (typeof CrimeMap === 'undefined') {
            throw new Error('CrimeMap class not loaded');
        }

        this.crimeMap = new CrimeMap(window.CRIMESPOTTER_CONFIG);
        console.log('🗺️ Map initialized');
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Search functionality
        this.setupSearchListeners();
        
        // Quick location buttons
        this.setupQuickLocationButtons();
        
        // Mobile menu
        this.setupMobileMenu();
        
        // Share functionality
        this.setupShareButton();
        
        // Navigation
        this.setupNavigation();
        
        console.log('📡 Event listeners setup complete');
    }

    /**
     * Setup search functionality
     */
    setupSearchListeners() {
        const searchInput = document.getElementById('location-search');
        const searchBtn = document.getElementById('search-btn');
        const suggestionsContainer = document.getElementById('search-suggestions');

        if (searchInput && searchBtn) {
            // Search button click
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });

            // Enter key in search input
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });

            // Search suggestions (with debounce)
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.handleSearchInput(e.target.value);
                }, 300);
            });

            // Hide suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                    this.hideSuggestions();
                }
            });
        }
    }

    /**
     * Setup quick location buttons
     */
    setupQuickLocationButtons() {
        const quickButtons = document.querySelectorAll('.quick-btn');
        
        quickButtons.forEach(button => {
            button.addEventListener('click', () => {
                const coords = button.dataset.coords;
                const name = button.dataset.name;
                
                if (coords) {
                    const [lat, lng] = coords.split(',').map(parseFloat);
                    this.goToLocation(lat, lng, name);
                }
            });
        });
    }

    /**
     * Setup mobile menu
     */
    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');

        if (mobileMenuBtn && navLinks) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenuBtn.classList.toggle('active');
                navLinks.classList.toggle('mobile-open');
            });

            // Close menu when clicking on a link
            navLinks.addEventListener('click', (e) => {
                if (e.target.classList.contains('nav-link')) {
                    mobileMenuBtn.classList.remove('active');
                    navLinks.classList.remove('mobile-open');
                }
            });
        }
    }

    /**
     * Setup share button
     */
    setupShareButton() {
        const shareBtn = document.getElementById('share-btn');
        
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                this.shareLocation();
            });
        }
    }

    /**
     * Setup smooth navigation
     */
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                
                if (href.startsWith('#')) {
                    e.preventDefault();
                    const targetId = href.substring(1);
                    const targetElement = document.getElementById(targetId);
                    
                    if (targetElement) {
                        const headerHeight = document.querySelector('.header').offsetHeight;
                        const targetPosition = targetElement.offsetTop - headerHeight;
                        
                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                    }
                    
                    // Update active nav link
                    navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        });
    }

    /**
     * Setup header scroll effects
     */
    setupHeaderEffects() {
        const header = document.getElementById('header');
        
        if (header) {
            let lastScrollTop = 0;
            
            window.addEventListener('scroll', () => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                // Add/remove scrolled class
                if (scrollTop > 100) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
                
                lastScrollTop = scrollTop;
            });
        }
    }

    /**
     * Load available dates from API
     */
    async loadAvailableDates() {
        try {
            const response = await fetch(`${window.CRIMESPOTTER_CONFIG.apiBaseUrl}/dates`);
            const data = await response.json();
            
            if (data.success && data.dates) {
                this.populateDateSelector(data.dates);
                console.log('📅 Loaded available dates');
            }
        } catch (error) {
            console.warn('⚠️ Could not load available dates:', error);
        }
    }

    /**
     * Populate the date selector with available dates
     */
    populateDateSelector(dates) {
        const dateSelector = document.getElementById('date-selector');
        
        if (dateSelector && dates.length > 0) {
            // Clear existing options except the first (latest)
            dateSelector.innerHTML = '';
            
            dates.forEach((dateObj, index) => {
                const option = document.createElement('option');
                option.value = dateObj.date;
                option.textContent = `${dateObj.date}${index === 0 ? ' (Latest)' : ''}`;
                dateSelector.appendChild(option);
            });
        }
    }

    /**
     * Load initial data for the default location
     */
    async loadInitialData() {
        // Load crimes for London by default
        const [lat, lng] = window.CRIMESPOTTER_CONFIG.mapCenter;
        
        if (this.crimeMap) {
            await this.crimeMap.loadCrimes(51.5074, -0.1278); // London coordinates
            this.updateLocationInfo('London', 51.5074, -0.1278);
        }
    }

    /**
     * Perform search based on input
     */
    async performSearch() {
        const searchInput = document.getElementById('location-search');
        
        if (!searchInput) return;
        
        const query = searchInput.value.trim();
        
        if (!query) {
            this.showError('Please enter a location to search');
            return;
        }

        // Show loading state
        const searchBtn = document.getElementById('search-btn');
        const originalContent = searchBtn.innerHTML;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        searchBtn.disabled = true;

        try {
            // Try to geocode the location
            const location = await this.geocodeLocation(query);
            
            if (location) {
                this.goToLocation(location.lat, location.lng, location.name);
                this.hideSuggestions();
                searchInput.value = location.name;
            } else {
                this.showError('Location not found. Please try a different search term.');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            // Restore button state
            searchBtn.innerHTML = originalContent;
            searchBtn.disabled = false;
        }
    }

    /**
     * Handle search input for suggestions
     */
    async handleSearchInput(query) {
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }

        try {
            const suggestions = await this.getSuggestions(query);
            this.showSuggestions(suggestions);
        } catch (error) {
            console.error('Suggestions error:', error);
        }
    }

    /**
     * Get location suggestions
     */
    async getSuggestions(query) {
        try {
            const response = await fetch(`${window.CRIMESPOTTER_CONFIG.apiBaseUrl}/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            return data.suggestions || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Show search suggestions
     */
    showSuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('search-suggestions');
        
        if (!suggestionsContainer) return;

        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        const html = suggestions.map(suggestion => `
            <div class="suggestion-item" data-coords="${suggestion.coords.join(',')}" data-name="${suggestion.name}">
                <i class="fas fa-map-marker-alt"></i>
                <span>${suggestion.name}</span>
            </div>
        `).join('');

        suggestionsContainer.innerHTML = html;
        suggestionsContainer.style.display = 'block';

        // Add click listeners to suggestions
        suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const coords = item.dataset.coords.split(',').map(parseFloat);
                const name = item.dataset.name;
                
                this.goToLocation(coords[0], coords[1], name);
                
                const searchInput = document.getElementById('location-search');
                if (searchInput) {
                    searchInput.value = name;
                }
                
                this.hideSuggestions();
            });
        });
    }

    /**
     * Hide search suggestions
     */
    hideSuggestions() {
        const suggestionsContainer = document.getElementById('search-suggestions');
        
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
            suggestionsContainer.innerHTML = '';
        }
    }

    /**
     * Simple geocoding for common UK locations
     */
    async geocodeLocation(query) {
        const locations = {
            'london': { name: 'London', lat: 51.5074, lng: -0.1278 },
            'manchester': { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
            'birmingham': { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
            'leeds': { name: 'Leeds', lat: 53.8008, lng: -1.5491 },
            'liverpool': { name: 'Liverpool', lat: 53.4084, lng: -2.9916 },
            'bristol': { name: 'Bristol', lat: 51.4545, lng: -2.5879 },
            'sheffield': { name: 'Sheffield', lat: 53.3811, lng: -1.4701 },
            'newcastle': { name: 'Newcastle', lat: 54.9783, lng: -1.6178 },
            'nottingham': { name: 'Nottingham', lat: 52.9548, lng: -1.1581 },
            'glasgow': { name: 'Glasgow', lat: 55.8642, lng: -4.2518 },
            'edinburgh': { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
            'cardiff': { name: 'Cardiff', lat: 51.4816, lng: -3.1791 },
            'belfast': { name: 'Belfast', lat: 54.5973, lng: -5.9301 }
        };

        const normalizedQuery = query.toLowerCase().trim();
        return locations[normalizedQuery] || null;
    }

    /**
     * Go to a specific location
     */
    goToLocation(lat, lng, name) {
        if (this.crimeMap) {
            this.crimeMap.goToLocation(lat, lng);
            this.updateLocationInfo(name, lat, lng);
            console.log(`📍 Navigated to ${name} (${lat}, ${lng})`);
        }
    }

    /**
     * Update location info in the sidebar
     */
    updateLocationInfo(name, lat, lng) {
        const locationName = document.querySelector('.location-name');
        const locationCoords = document.querySelector('.location-coords');

        if (locationName) {
            locationName.textContent = name || 'Unknown Location';
        }

        if (locationCoords) {
            locationCoords.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }

    /**
     * Share current location
     */
    async shareLocation() {
        const center = this.crimeMap?.map.getCenter();
        
        if (!center) {
            this.showError('No location to share');
            return;
        }

        const url = `${window.location.origin}/?lat=${center.lat.toFixed(4)}&lng=${center.lng.toFixed(4)}`;
        const title = 'CrimeSpotter UK - Crime Data';
        const text = `Check out crime data for this location: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;

        try {
            if (navigator.share) {
                // Use Web Share API if available
                await navigator.share({
                    title: title,
                    text: text,
                    url: url
                });
                console.log('📤 Shared successfully');
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(url);
                this.showSuccess('Link copied to clipboard!');
            }
        } catch (error) {
            console.error('Share failed:', error);
            // Final fallback: show the URL
            prompt('Copy this link to share:', url);
        }
    }

    /**
     * Hide loading screen with animation
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 1000); // Show loading for at least 1 second
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('Error:', message);
        // You could implement a toast notification system here
        alert(`Error: ${message}`);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        console.log('Success:', message);
        // You could implement a toast notification system here
        alert(message);
    }

    /**
     * Handle URL parameters on page load
     */
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const lat = urlParams.get('lat');
        const lng = urlParams.get('lng');

        if (lat && lng) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            
            if (!isNaN(latitude) && !isNaN(longitude)) {
                this.goToLocation(latitude, longitude, 'Shared Location');
            }
        }
    }
}

// Initialize the application
new CrimeSpotterApp();