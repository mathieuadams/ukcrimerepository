/**
 * Crime Heat Map Implementation for CrimeSpotter UK
 * Add this to your map.js file (replace or enhance existing CrimeMap class)
 */

class CrimeMap {
    constructor(config) {
        this.config = config;
        this.map = null;
        this.crimeMarkers = null;
        this.heatmapLayer = null;
        this.currentCrimes = [];
        this.activeFilters = new Set(['all']);
        this.isLoading = false;
        this.lastUpdateLocation = null;
        this.hasMovedSinceUpdate = false;
        this.viewMode = 'heatmap'; // 'heatmap' or 'markers'
        this.onDataLoaded = null;
        
        // Crime category colors and icons
        this.crimeStyles = {
            'burglary': { color: '#dc2626', icon: '🏠', weight: 2.0 },
            'violent-crime': { color: '#be123c', icon: '⚠️', weight: 2.5 },
            'theft-from-the-person': { color: '#ea580c', icon: '👤', weight: 1.8 },
            'vehicle-crime': { color: '#d97706', icon: '🚗', weight: 1.5 },
            'anti-social-behaviour': { color: '#7c3aed', icon: '📢', weight: 1.0 },
            'drugs': { color: '#059669', icon: '💊', weight: 1.5 },
            'robbery': { color: '#b91c1c', icon: '💰', weight: 2.5 },
            'public-order': { color: '#0369a1', icon: '👮', weight: 1.2 },
            'criminal-damage-arson': { color: '#ca8a04', icon: '🔥', weight: 1.8 },
            'other-theft': { color: '#6b7280', icon: '📦', weight: 1.3 },
            'bicycle-theft': { color: '#0891b2', icon: '🚲', weight: 1.0 },
            'shoplifting': { color: '#9333ea', icon: '🛒', weight: 1.0 },
            'other-crime': { color: '#374151', icon: '❓', weight: 1.0 }
        };
        
        this.init();
    }

    /**
     * Initialize the map
     */
    init() {
        this.loadHeatmapPlugin();
        this.createMap();
        this.setupEventListeners();
        this.addMapControls();
        console.log('🗺️ Crime map initialized with heatmap support');
    }

    /**
     * Load Leaflet.heat plugin
     */
    loadHeatmapPlugin() {
        if (typeof L.heatLayer === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
            script.onload = () => {
                console.log('✅ Heatmap plugin loaded');
            };
            document.head.appendChild(script);
        }
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

        // Initialize marker cluster group (for marker view)
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

        // Map event listeners
        this.map.on('moveend', () => {
            this.onMapMove();
        });

        this.map.on('zoomend', () => {
            this.onMapMove();
            // Adjust heatmap radius based on zoom
            this.adjustHeatmapRadius();
        });

        // Store initial location
        this.lastUpdateLocation = this.map.getCenter();
    }

    /**
     * Add map controls for view mode switching
     */
    addMapControls() {
        // Create custom control for view mode
        const ViewControl = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'view-mode-control');
                container.style.cssText = `
                    background: white;
                    padding: 10px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    display: flex;
                    gap: 5px;
                `;
                
                container.innerHTML = `
                    <button id="heatmap-view-btn" class="view-btn active" title="Heat Map View">
                        <i class="fas fa-fire"></i>
                        <span>Heat Map</span>
                    </button>
                    <button id="markers-view-btn" class="view-btn" title="Markers View">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Points</span>
                    </button>
                    <button id="hybrid-view-btn" class="view-btn" title="Hybrid View">
                        <i class="fas fa-layer-group"></i>
                        <span>Both</span>
                    </button>
                `;
                
                // Prevent map interactions when clicking the buttons
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });

        // Add control to map
        new ViewControl().addTo(this.map);

        // Add CSS for view buttons
        this.addViewControlStyles();

        // Setup view mode buttons after they're added to DOM
        setTimeout(() => {
            this.setupViewModeButtons();
        }, 100);

        // Add intensity control
        this.addIntensityControl();
    }

    /**
     * Add intensity control for heatmap
     */
    addIntensityControl() {
        const IntensityControl = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'intensity-control');
                container.style.cssText = `
                    background: white;
                    padding: 10px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    margin-top: 10px;
                    display: ${this.viewMode === 'markers' ? 'none' : 'block'};
                `;
                
                container.innerHTML = `
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 5px;">
                        <i class="fas fa-adjust"></i> Intensity
                    </div>
                    <input type="range" id="intensity-slider" min="0.1" max="1" step="0.1" value="0.5" 
                           style="width: 150px;">
                    <span id="intensity-value" style="font-size: 11px; margin-left: 5px;">50%</span>
                `;
                
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });

        new IntensityControl().addTo(this.map);

        // Setup intensity slider
        setTimeout(() => {
            const slider = document.getElementById('intensity-slider');
            const value = document.getElementById('intensity-value');
            
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const intensity = parseFloat(e.target.value);
                    value.textContent = `${Math.round(intensity * 100)}%`;
                    this.updateHeatmapIntensity(intensity);
                });
            }
        }, 100);
    }

    /**
     * Add CSS styles for view controls
     */
    addViewControlStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .view-btn {
                padding: 8px 12px;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 13px;
                font-weight: 500;
                color: #64748b;
                transition: all 0.2s;
            }
            
            .view-btn:hover {
                background: #f8fafc;
                color: #475569;
            }
            
            .view-btn.active {
                background: #3b82f6;
                color: white;
                border-color: #3b82f6;
            }
            
            .view-btn i {
                font-size: 14px;
            }
            
            @media (max-width: 768px) {
                .view-btn span {
                    display: none;
                }
                .view-btn {
                    padding: 8px 10px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup view mode button handlers
     */
    setupViewModeButtons() {
        const heatmapBtn = document.getElementById('heatmap-view-btn');
        const markersBtn = document.getElementById('markers-view-btn');
        const hybridBtn = document.getElementById('hybrid-view-btn');

        if (heatmapBtn) {
            heatmapBtn.addEventListener('click', () => {
                this.setViewMode('heatmap');
            });
        }

        if (markersBtn) {
            markersBtn.addEventListener('click', () => {
                this.setViewMode('markers');
            });
        }

        if (hybridBtn) {
            hybridBtn.addEventListener('click', () => {
                this.setViewMode('hybrid');
            });
        }
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.getElementById(`${mode === 'hybrid' ? 'hybrid' : mode}-view-btn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Show/hide intensity control
        const intensityControl = document.querySelector('.intensity-control');
        if (intensityControl) {
            intensityControl.style.display = mode === 'markers' ? 'none' : 'block';
        }

        // Re-display crimes with new view mode
        this.displayCrimes(this.currentCrimes);
        
        console.log(`📊 Switched to ${mode} view`);
        this.showNotification(`Switched to ${mode} view`, 'info');
    }

    /**
     * Display crimes on the map (heatmap or markers)
     */
    displayCrimes(crimes) {
        // Clear existing layers
        if (this.heatmapLayer) {
            this.map.removeLayer(this.heatmapLayer);
            this.heatmapLayer = null;
        }
        if (this.crimeMarkers) {
            this.map.removeLayer(this.crimeMarkers);
            this.crimeMarkers.clearLayers();
        }

        if (!crimes || crimes.length === 0) {
            console.log('No crimes to display');
            this.showNotification('No crimes found in this area for the selected period', 'info');
            this.updateFilteredCount(0);
            return;
        }

        // Filter crimes based on active filters
        const filteredCrimes = crimes.filter(crime => this.shouldShowCrime(crime));
        
        if (filteredCrimes.length === 0) {
            console.log('No crimes match current filters');
            this.showNotification('No crimes match the selected filters', 'info');
            this.updateFilteredCount(0);
            return;
        }

        // Display based on view mode
        switch (this.viewMode) {
            case 'heatmap':
                this.displayHeatmap(filteredCrimes);
                break;
            case 'markers':
                this.displayMarkers(filteredCrimes);
                break;
            case 'hybrid':
                this.displayHeatmap(filteredCrimes);
                this.displayMarkers(filteredCrimes);
                break;
        }

        console.log(`📍 Displayed ${filteredCrimes.length} of ${crimes.length} crimes in ${this.viewMode} view`);
        
        // Update counts and statistics
        this.updateFilteredCount(filteredCrimes.length);
        this.updateAreaStatistics(filteredCrimes);
    }

    /**
     * Display crimes as heatmap
     */
    displayHeatmap(crimes) {
        // Wait for heatmap plugin to load
        if (typeof L.heatLayer === 'undefined') {
            console.log('Waiting for heatmap plugin...');
            setTimeout(() => this.displayHeatmap(crimes), 100);
            return;
        }

        // Prepare heat data points
        const heatData = crimes.map(crime => {
            if (!crime.location || !crime.location.latitude || !crime.location.longitude) {
                return null;
            }
            
            const lat = parseFloat(crime.location.latitude);
            const lng = parseFloat(crime.location.longitude);
            
            if (isNaN(lat) || isNaN(lng)) {
                return null;
            }
            
            // Get weight based on crime severity
            const weight = this.crimeStyles[crime.category]?.weight || 1.0;
            
            // Return [lat, lng, intensity]
            return [lat, lng, weight];
        }).filter(point => point !== null);

        if (heatData.length === 0) {
            console.log('No valid coordinates for heatmap');
            return;
        }

        // Create heatmap layer with dynamic configuration
        const zoom = this.map.getZoom();
        const radius = this.calculateHeatmapRadius(zoom);
        
        this.heatmapLayer = L.heatLayer(heatData, {
            radius: radius,
            blur: 15,
            maxZoom: 17,
            max: 3.0,
            gradient: {
                0.0: 'blue',
                0.2: 'cyan',
                0.4: 'lime',
                0.6: 'yellow',
                0.8: 'orange',
                1.0: 'red'
            }
        });

        this.heatmapLayer.addTo(this.map);
        console.log(`🔥 Heatmap created with ${heatData.length} points`);
    }

    /**
     * Display crimes as markers
     */
    displayMarkers(crimes) {
        const markers = crimes
            .map(crime => this.createCrimeMarker(crime))
            .filter(marker => marker !== null);

        if (markers.length > 0) {
            this.crimeMarkers.addLayers(markers);
            this.map.addLayer(this.crimeMarkers);
        }
    }

    /**
     * Calculate heatmap radius based on zoom level
     */
    calculateHeatmapRadius(zoom) {
        // Adjust radius based on zoom level for better visualization
        const baseRadius = 25;
        const zoomFactor = Math.pow(2, 15 - zoom);
        return Math.max(10, Math.min(50, baseRadius * zoomFactor));
    }

    /**
     * Adjust heatmap radius when zoom changes
     */
    adjustHeatmapRadius() {
        if (this.heatmapLayer && this.viewMode !== 'markers') {
            // Re-create heatmap with new radius
            this.displayCrimes(this.currentCrimes);
        }
    }

    /**
     * Update heatmap intensity
     */
    updateHeatmapIntensity(intensity) {
        if (this.heatmapLayer) {
            // Re-create heatmap with new intensity
            // Store the intensity value for reuse
            this.heatmapIntensity = intensity;
            this.displayCrimes(this.currentCrimes);
        }
    }

    // ... Include all other existing methods from your current CrimeMap class ...
    // (loadCrimes, createCrimeMarker, handleFilterChange, etc.)
    
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
                <div class="crime-marker-inner" style="background-color: ${style.color}; opacity: 0.7;">
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
        notification.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            display: block;
        `;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

// Export for use in other modules
window.CrimeMap = CrimeMap;