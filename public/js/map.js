/**
 * CrimeSpotter UK - Interactive Map Module
 * Handles all map-related functionality using Leaflet.js
 */

class CrimeMap {
    constructor(config) {
        this.config = config;
        this.map = null;
        this.crimeMarkers = null;
        this.currentCrimes = [];
        this.activeFilters = new Set(['all']);
        this.isLoading = false;
        this.lastUpdateLocation = null;
        this.hasMovedSinceUpdate = false;
        this.onDataLoaded = null; // Callback function for when data is loaded
        
        // Crime category colors and icons
        this.crimeStyles = {
            'burglary': { color: '#dc2626', icon: '🏠' },
            'theft-from-the-person': { color: '#ea580c', icon: '👤' },
            'vehicle-crime': { color: '#d97706', icon: '🚗' },
            'violent-crime': { color: '#be123c', icon: '⚠️' },
            'anti-social-behaviour': { color: '#7c3aed', icon: '📢' },
            'drugs': { color: '#059669', icon: '💊' },
            'robbery': { color: '#b91c1c', icon: '💰' },
            'public-order': { color: '#0369a1', icon: '👮' },
            'criminal-damage-arson': { color: '#ca8a04', icon: '🔥' },
            'other-theft': { color: '#6b7280', icon: '📦' },
            'bicycle-theft': { color: '#0891b2', icon: '🚲' },
            'shoplifting': { color: '#9333ea', icon: '🛒' },
            'other-crime': { color: '#374151', icon: '❓' }
        };
        
        this.init();
    }

    /**
     * Initialize the map
     */
    init() {
        this.createMap();
        this.setupEventListeners();
        this.addUpdateLocationButton();
        console.log('🗺️ Crime map initialized');
    }

    /**
     * Create the Leaflet map
     */
    createMap() {
        // Check if map container exists
        const mapContainer = document.getElementById('crime-map');
        if (!mapContainer) {
            console.error('Map container not found!');
            throw new Error('Map container element with id "crime-map" not found');
        }
        
        // Initialize map
        this.map = L.map('crime-map', {
            center: this.config.mapCenter,
            zoom: this.config.mapZoom,
            zoomControl: false
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
            minZoom: 5
        }).addTo(this.map);

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        // Initialize marker cluster group
        this.crimeMarkers = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                let size = 'small';
                
                if (count > 100) size = 'large';
                else if (count > 30) size = 'medium';
                
                return L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${size}`,
                    iconSize: L.point(40, 40)
                });
            }
        });
        
        this.map.addLayer(this.crimeMarkers);

        // Map event listeners
        this.map.on('moveend', () => {
            this.onMapMove();
        });

        this.map.on('zoomend', () => {
            this.onMapMove();
        });

        // Store initial location
        this.lastUpdateLocation = this.map.getCenter();
    }

    /**
     * Handle map movement
     */
    onMapMove() {
        this.updateLocationInfo();
        
        // Check if map has moved significantly
        const currentCenter = this.map.getCenter();
        if (this.lastUpdateLocation) {
            const distance = this.lastUpdateLocation.distanceTo(currentCenter);
            // If moved more than 500 meters, show the update button
            if (distance > 500) {
                this.hasMovedSinceUpdate = true;
                this.showUpdateButton();
            }
        }
    }

    /**
     * Add update location button to the map
     */
    addUpdateLocationButton() {
        // Create custom control for update button
        const UpdateControl = L.Control.extend({
            options: {
                position: 'topleft'
            },

            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'update-location-control');
                container.innerHTML = `
                    <button id="update-location-btn" class="update-location-btn" style="display: none;">
                        <i class="fas fa-sync-alt"></i>
                        <span>Update This Location</span>
                    </button>
                `;
                
                // Prevent map interactions when clicking the button
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });

        // Add control to map
        new UpdateControl().addTo(this.map);

        // Add click handler after button is added to DOM
        setTimeout(() => {
            const updateBtn = document.getElementById('update-location-btn');
            if (updateBtn) {
                updateBtn.addEventListener('click', () => {
                    this.updateCurrentLocation();
                });
            }
        }, 100);
    }

    /**
     * Show the update button
     */
    showUpdateButton() {
        const updateBtn = document.getElementById('update-location-btn');
        if (updateBtn && this.hasMovedSinceUpdate) {
            updateBtn.style.display = 'flex';
            updateBtn.classList.add('pulse');
            
            // Remove pulse animation after 2 seconds
            setTimeout(() => {
                updateBtn.classList.remove('pulse');
            }, 2000);
        }
    }

    /**
     * Hide the update button
     */
    hideUpdateButton() {
        const updateBtn = document.getElementById('update-location-btn');
        if (updateBtn) {
            updateBtn.style.display = 'none';
        }
    }

    /**
     * Update crime data for current map location
     */
    async updateCurrentLocation() {
        const center = this.map.getCenter();
        const updateBtn = document.getElementById('update-location-btn');
        
        // Update button state
        if (updateBtn) {
            updateBtn.disabled = true;
            updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Loading...</span>';
        }
        
        try {
            const data = await this.loadCrimes(center.lat, center.lng);
            this.lastUpdateLocation = center;
            this.hasMovedSinceUpdate = false;
            this.hideUpdateButton();
            
            // Show success message
            this.showNotification('Location updated successfully!', 'success');
        } catch (error) {
            console.error('Failed to update location:', error);
            this.showNotification('Failed to update location. Please try again.', 'error');
        } finally {
            // Restore button state
            if (updateBtn) {
                updateBtn.disabled = false;
                updateBtn.innerHTML = '<i class="fas fa-sync-alt"></i> <span>Update This Location</span>';
            }
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Controls toggle
        const controlsToggle = document.getElementById('controls-toggle');
        if (controlsToggle) {
            controlsToggle.addEventListener('click', () => {
                this.toggleControls();
            });
        }

        // Date selector - removed duplicate listener that was in app.js
        const dateSelector = document.getElementById('date-selector');
        if (dateSelector) {
            // Remove any existing listeners first
            const newDateSelector = dateSelector.cloneNode(true);
            dateSelector.parentNode.replaceChild(newDateSelector, dateSelector);
            
            newDateSelector.addEventListener('change', (e) => {
                this.loadCrimesForCurrentView(e.target.value);
            });
        }

        // Crime type filters
        const crimeFilters = document.getElementById('crime-filters');
        if (crimeFilters) {
            crimeFilters.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    this.handleFilterChange(e.target);
                }
            });
        }

        // Map controls
        const myLocationBtn = document.getElementById('my-location-btn');
        if (myLocationBtn) {
            myLocationBtn.addEventListener('click', () => {
                this.goToUserLocation();
            });
        }

        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // Add manual refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.updateCurrentLocation();
            });
        }
    }

    /**
     * Load crimes for a specific location
     */
    async loadCrimes(lat, lng, date = null) {
        if (this.isLoading) return null;
        
        this.showLoading(true);
        this.isLoading = true;
        
        let returnData = null;

        try {
            const params = new URLSearchParams({
                lat: lat.toString(),
                lng: lng.toString()
            });

            if (date) {
                params.append('date', date);
            }

            const response = await fetch(`${this.config.apiBaseUrl}/crimes?${params}`);
            const data = await response.json();

            if (data.success) {
                this.currentCrimes = data.crimes || [];
                this.displayCrimes(this.currentCrimes);
                this.updateStatistics(data);
                this.updateFilters(data.categories || {});
                
                // Update location display
                this.updateLocationDisplay(lat, lng);
                
                // Fit map to bounds if we have crime data
                if (data.bounds && this.currentCrimes.length > 0) {
                    this.fitToBounds(data.bounds);
                }
                
                // Call the callback if it exists
                if (this.onDataLoaded && typeof this.onDataLoaded === 'function') {
                    this.onDataLoaded(data);
                }
                
                returnData = data;
                console.log(`✅ Loaded ${this.currentCrimes.length} crimes`);
            } else {
                throw new Error(data.error || 'Failed to load crime data');
            }

        } catch (error) {
            console.error('❌ Error loading crimes:', error);
            this.showError('Failed to load crime data. Please try again.');
            
            // Still call callback with error state
            if (this.onDataLoaded && typeof this.onDataLoaded === 'function') {
                this.onDataLoaded({ success: false, count: 0 });
            }
        } finally {
            this.showLoading(false);
            this.isLoading = false;
        }
        
        return returnData;
    }

    /**
     * Update location display
     */
    updateLocationDisplay(lat, lng) {
        const locationName = document.querySelector('.location-name');
        const locationCoords = document.querySelector('.location-coords');
        
        if (locationCoords) {
            locationCoords.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }

    /**
     * Load crimes for current map view
     */
    async loadCrimesForCurrentView(date = null) {
        const center = this.map.getCenter();
        const data = await this.loadCrimes(center.lat, center.lng, date);
        this.lastUpdateLocation = center;
        this.hasMovedSinceUpdate = false;
        this.hideUpdateButton();
        return data;
    }

    /**
     * Display crimes on the map
     */
    displayCrimes(crimes) {
        // Clear existing markers
        this.crimeMarkers.clearLayers();

        if (!crimes || crimes.length === 0) {
            console.log('No crimes to display');
            this.showNotification('No crimes found in this area for the selected period', 'info');
            this.updateFilteredCount(0);
            return;
        }

        // Filter crimes based on active filters
        const filteredCrimes = crimes.filter(crime => this.shouldShowCrime(crime));
        
        // Create markers for each filtered crime
        const markers = filteredCrimes
            .map(crime => this.createCrimeMarker(crime))
            .filter(marker => marker !== null);

        // Add markers to cluster group
        if (markers.length > 0) {
            this.crimeMarkers.addLayers(markers);
        }

        console.log(`📍 Displayed ${markers.length} of ${crimes.length} crime markers (filtered)`);
        
        // Update the count display with filtered count
        this.updateFilteredCount(markers.length);
        
        // Update the area statistics with filtered data
        this.updateAreaStatistics(filteredCrimes);
    }

    /**
     * Update filtered crime count display
     */
    updateFilteredCount(count) {
        const areaTotal = document.getElementById('area-total');
        if (areaTotal) {
            areaTotal.textContent = count;
        }
    }
    
    /**
     * Update area statistics based on filtered crimes
     */
    updateAreaStatistics(filteredCrimes) {
        const areaCommon = document.getElementById('area-common');
        const areaSafety = document.getElementById('area-safety');
        
        if (areaCommon && filteredCrimes.length > 0) {
            // Calculate most common crime from filtered results
            const categories = {};
            filteredCrimes.forEach(crime => {
                const category = crime.category || 'unknown';
                categories[category] = (categories[category] || 0) + 1;
            });
            
            const mostCommon = Object.entries(categories)
                .sort(([,a], [,b]) => b - a)[0];
            
            if (mostCommon) {
                const displayName = mostCommon[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                areaCommon.textContent = displayName;
            }
        } else if (areaCommon) {
            areaCommon.textContent = '-';
        }
        
        if (areaSafety) {
            // Simple safety score calculation based on filtered crimes
            const count = filteredCrimes.length;
            const safetyScore = Math.max(1, Math.min(10, 10 - Math.floor(count / 10)));
            areaSafety.textContent = `${safetyScore}/10`;
            areaSafety.className = `safety-score ${safetyScore >= 7 ? 'good' : safetyScore >= 4 ? 'medium' : 'poor'}`;
        }
    }

    /**
     * Create a marker for a crime incident
     */
    createCrimeMarker(crime) {
        if (!crime.location || !crime.location.latitude || !crime.location.longitude) {
            return null;
        }

        const lat = parseFloat(crime.location.latitude);
        const lng = parseFloat(crime.location.longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return null;
        }

        const style = this.crimeStyles[crime.category] || this.crimeStyles['other-crime'];
        
        // Create custom icon
        const icon = L.divIcon({
            className: 'crime-marker',
            html: `
                <div class="crime-marker-inner" style="background-color: ${style.color}">
                    <span class="crime-icon">${style.icon}</span>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Create marker
        const marker = L.marker([lat, lng], { icon });

        // Create popup content
        const popupContent = this.createPopupContent(crime);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'crime-popup'
        });

        return marker;
    }

    /**
     * Create popup content for a crime marker
     */
    createPopupContent(crime) {
        const style = this.crimeStyles[crime.category] || this.crimeStyles['other-crime'];
        const categoryDisplay = crime.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return `
            <div class="crime-popup-content">
                <div class="crime-popup-header">
                    <span class="crime-popup-icon" style="color: ${style.color}">${style.icon}</span>
                    <h3 class="crime-popup-title">${categoryDisplay}</h3>
                </div>
                <div class="crime-popup-details">
                    <p><strong>📍 Location:</strong> ${crime.location.street?.name || 'Unknown location'}</p>
                    <p><strong>📅 Date:</strong> ${this.formatDate(crime.month)}</p>
                    ${crime.outcome_status ? `<p><strong>⚖️ Outcome:</strong> ${crime.outcome_status.category}</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Check if a crime should be displayed based on current filters
     */
    shouldShowCrime(crime) {
        if (this.activeFilters.has('all')) {
            return true;
        }
        
        return this.activeFilters.has(crime.category);
    }

    /**
     * Handle filter checkbox changes
     */
    handleFilterChange(checkbox) {
        const value = checkbox.value;
        
        if (value === 'all') {
            if (checkbox.checked) {
                // Select all
                this.activeFilters.clear();
                this.activeFilters.add('all');
                // Check all other checkboxes
                document.querySelectorAll('#crime-filters input[type="checkbox"]').forEach(cb => {
                    cb.checked = true;
                });
            } else {
                // If unchecking "all", uncheck everything
                this.activeFilters.clear();
                document.querySelectorAll('#crime-filters input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
            }
        } else {
            if (checkbox.checked) {
                // Remove "all" if it was selected
                if (this.activeFilters.has('all')) {
                    this.activeFilters.clear();
                    const allCheckbox = document.querySelector('#crime-filters input[value="all"]');
                    if (allCheckbox) allCheckbox.checked = false;
                }
                this.activeFilters.add(value);
            } else {
                this.activeFilters.delete(value);
            }
            
            // Check if all individual filters are selected
            const allFilters = Array.from(document.querySelectorAll('#crime-filters input[type="checkbox"]:not([value="all"])'));
            const allChecked = allFilters.every(cb => cb.checked);
            
            if (allChecked && allFilters.length > 0) {
                // If all individual filters are checked, check "all" as well
                this.activeFilters.clear();
                this.activeFilters.add('all');
                const allCheckbox = document.querySelector('#crime-filters input[value="all"]');
                if (allCheckbox) allCheckbox.checked = true;
                allFilters.forEach(cb => cb.checked = true);
            } else if (this.activeFilters.size === 0) {
                // If no filters selected, select all
                this.activeFilters.add('all');
                const allCheckbox = document.querySelector('#crime-filters input[value="all"]');
                if (allCheckbox) allCheckbox.checked = true;
                document.querySelectorAll('#crime-filters input[type="checkbox"]').forEach(cb => {
                    cb.checked = true;
                });
            }
        }

        // Re-display crimes with new filters
        this.displayCrimes(this.currentCrimes);
        console.log('🔍 Applied filters:', Array.from(this.activeFilters));
    }

    /**
     * Update crime type filters based on available data
     */
    updateFilters(categories) {
        const filtersContainer = document.getElementById('crime-filters');
        if (!filtersContainer) return;

        // Store the current filter state before updating
        const currentActiveFilters = new Set(this.activeFilters);

        // Keep the "All Crimes" filter and update its count
        const allFilter = filtersContainer.querySelector('input[value="all"]');
        const allCount = filtersContainer.querySelector('#count-all');
        
        let totalCount = 0;
        Object.values(categories).forEach(count => totalCount += count);
        
        if (allCount) {
            allCount.textContent = totalCount;
        }

        // Remove existing category filters (except "all")
        const existingFilters = filtersContainer.querySelectorAll('.filter-item:not(:first-child)');
        existingFilters.forEach(filter => filter.remove());

        // Add new category filters
        Object.entries(categories)
            .sort(([,a], [,b]) => b - a) // Sort by count descending
            .forEach(([category, count]) => {
                if (count > 0) {
                    const filterHtml = this.createFilterHtml(category, count);
                    filtersContainer.insertAdjacentHTML('beforeend', filterHtml);
                }
            });

        // Add refresh button if it doesn't exist
        let refreshContainer = document.querySelector('.filter-refresh');
        if (!refreshContainer) {
            refreshContainer = document.createElement('div');
            refreshContainer.className = 'filter-refresh';
            refreshContainer.innerHTML = `
                <button id="filter-refresh-btn">
                    <i class="fas fa-sync-alt"></i>
                    <span>Apply Filters</span>
                </button>
            `;
            filtersContainer.parentElement.appendChild(refreshContainer);
            
            // Add event listener to refresh button
            document.getElementById('filter-refresh-btn').addEventListener('click', () => {
                this.displayCrimes(this.currentCrimes);
                this.showNotification('Filters applied', 'success');
            });
        }

        // Restore the filter state
        this.activeFilters = currentActiveFilters;
    }

    /**
     * Create HTML for a filter item
     */
    createFilterHtml(category, count) {
        const style = this.crimeStyles[category] || this.crimeStyles['other-crime'];
        const displayName = category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return `
            <label class="filter-item">
                <input type="checkbox" value="${category}" ${this.activeFilters.has(category) || this.activeFilters.has('all') ? 'checked' : ''}>
                <span class="checkmark"></span>
                <span class="filter-icon" style="color: ${style.color}">${style.icon}</span>
                <span class="filter-text">${displayName}</span>
                <span class="filter-count">${count}</span>
            </label>
        `;
    }

    /**
     * Update statistics panel
     */
    updateStatistics(data) {
        // Update area statistics
        const areaTotal = document.getElementById('area-total');
        const areaCommon = document.getElementById('area-common');
        const areaSafety = document.getElementById('area-safety');

        if (areaTotal) {
            areaTotal.textContent = data.count || 0;
        }

        if (areaCommon && data.categories) {
            const mostCommon = Object.entries(data.categories)
                .sort(([,a], [,b]) => b - a)[0];
            
            if (mostCommon) {
                const displayName = mostCommon[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                areaCommon.textContent = displayName;
            }
        }

        if (areaSafety) {
            // Simple safety score calculation (inverse of crime density)
            const safetyScore = Math.max(1, Math.min(10, 10 - Math.floor(data.count / 10)));
            areaSafety.textContent = `${safetyScore}/10`;
            areaSafety.className = `safety-score ${safetyScore >= 7 ? 'good' : safetyScore >= 4 ? 'medium' : 'poor'}`;
        }
    }

    /**
     * Update location info in sidebar
     */
    updateLocationInfo() {
        const locationInfo = document.getElementById('location-info');
        if (!locationInfo) return;

        const center = this.map.getCenter();
        const zoom = this.map.getZoom();

        const locationCoords = locationInfo.querySelector('.location-coords');

        if (locationCoords) {
            locationCoords.textContent = `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
        }
    }

    /**
     * Go to user's current location
     */
    goToUserLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }

        const button = document.getElementById('my-location-btn');
        if (button) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                this.map.setView([latitude, longitude], 14);
                await this.loadCrimes(latitude, longitude);
                this.lastUpdateLocation = L.latLng(latitude, longitude);
                this.hasMovedSinceUpdate = false;
                this.hideUpdateButton();
                
                if (button) {
                    button.innerHTML = '<i class="fas fa-crosshairs"></i>';
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                alert('Unable to get your location. Please try again.');
                
                if (button) {
                    button.innerHTML = '<i class="fas fa-crosshairs"></i>';
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        const mapSection = document.querySelector('.map-section');
        const button = document.getElementById('fullscreen-btn');
        
        if (!document.fullscreenElement) {
            mapSection.requestFullscreen().then(() => {
                if (button) {
                    button.innerHTML = '<i class="fas fa-compress"></i>';
                }
                // Invalidate map size after fullscreen
                setTimeout(() => this.map.invalidateSize(), 100);
            });
        } else {
            document.exitFullscreen().then(() => {
                if (button) {
                    button.innerHTML = '<i class="fas fa-expand"></i>';
                }
                // Invalidate map size after exit fullscreen
                setTimeout(() => this.map.invalidateSize(), 100);
            });
        }
    }

    /**
     * Toggle controls sidebar
     */
    toggleControls() {
        const controls = document.getElementById('map-controls');
        const toggle = document.getElementById('controls-toggle');
        
        if (controls && toggle) {
            controls.classList.toggle('collapsed');
            const icon = toggle.querySelector('i');
            
            if (controls.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-right';
            } else {
                icon.className = 'fas fa-chevron-left';
            }
            
            // Invalidate map size when sidebar toggles
            setTimeout(() => this.map.invalidateSize(), 300);
        }
    }

    /**
     * Fit map to crime data bounds
     */
    fitToBounds(bounds) {
        if (!bounds) return;
        
        const leafletBounds = L.latLngBounds(
            [bounds.south, bounds.west],
            [bounds.north, bounds.east]
        );
        
        this.map.fitBounds(leafletBounds, {
            padding: [20, 20],
            maxZoom: 15
        });
    }

    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        const loadingOverlay = document.getElementById('map-loading');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('map-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'map-notification';
            notification.className = 'map-notification';
            const mapContainer = document.querySelector('.map-container');
            if (mapContainer) {
                mapContainer.appendChild(notification);
            }
        }
        
        // Set message and type
        notification.textContent = message;
        notification.className = `map-notification ${type}`;
        notification.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            const [year, month] = dateString.split('-');
            const date = new Date(year, month - 1);
            return date.toLocaleDateString('en-GB', { 
                year: 'numeric', 
                month: 'long' 
            });
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Go to a specific coordinate
     */
    async goToLocation(lat, lng, zoom = 14) {
        this.map.setView([lat, lng], zoom);
        const data = await this.loadCrimes(lat, lng);
        this.lastUpdateLocation = L.latLng(lat, lng);
        this.hasMovedSinceUpdate = false;
        this.hideUpdateButton();
        return data;
    }
}

// Export for use in other modules
window.CrimeMap = CrimeMap;