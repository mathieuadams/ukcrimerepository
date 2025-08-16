/**
 * Crime Heatmap Addon for CrimeSpotter UK
 * This extends your existing CrimeMap class without removing any functionality
 * Add this as a new file: public/js/map-heatmap.js
 * Include it AFTER map.js in your HTML
 */

// Extend the existing CrimeMap class with heatmap functionality
if (window.CrimeMap) {
    
    // Store the original displayCrimes method
    const originalDisplayCrimes = window.CrimeMap.prototype.displayCrimes;
    const originalInit = window.CrimeMap.prototype.init;
    const originalCreateMap = window.CrimeMap.prototype.createMap;
    
    // Extend the init method
    window.CrimeMap.prototype.init = function() {
        // Call original init
        originalInit.call(this);
        
        // Add heatmap properties
        this.heatmapLayer = null;
        this.showHeatmap = false;
        this.showMarkers = true;
        this.heatmapIntensity = 0.5;
        
        // Load heatmap plugin
        this.loadHeatmapPlugin();
        
        // Add heatmap controls after map is created
        setTimeout(() => {
            this.addHeatmapControls();
        }, 500);
    };
    
    // Add method to load heatmap plugin
    window.CrimeMap.prototype.loadHeatmapPlugin = function() {
        if (typeof L.heatLayer === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
            script.onload = () => {
                console.log('✅ Heatmap plugin loaded');
            };
            document.head.appendChild(script);
        }
    };
    
    // Add heatmap controls to the map
    window.CrimeMap.prototype.addHeatmapControls = function() {
        // Create layer control
        const LayerControl = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'layer-control');
                container.style.cssText = `
                    background: white;
                    padding: 12px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    min-width: 150px;
                `;
                
                container.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">
                        <i class="fas fa-layer-group"></i> View Layers
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                            <input type="checkbox" id="toggle-markers" checked style="margin-right: 8px;">
                            <i class="fas fa-map-marker-alt" style="width: 16px; margin-right: 6px; color: #3b82f6;"></i>
                            Crime Points
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                            <input type="checkbox" id="toggle-heatmap" style="margin-right: 8px;">
                            <i class="fas fa-fire" style="width: 16px; margin-right: 6px; color: #dc2626;"></i>
                            Heat Map
                        </label>
                    </div>
                    <div id="heatmap-controls" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                        <div style="font-size: 12px; margin-bottom: 5px;">
                            <i class="fas fa-adjust"></i> Heat Intensity
                        </div>
                        <div style="display: flex; align-items: center;">
                            <input type="range" id="heat-intensity" min="0.1" max="1" step="0.1" value="0.5" 
                                   style="width: 100px; flex: 1;">
                            <span id="intensity-value" style="font-size: 11px; margin-left: 8px; min-width: 30px;">50%</span>
                        </div>
                    </div>
                `;
                
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });

        // Add control to map
        new LayerControl().addTo(this.map);
        
        // Setup event listeners for the controls
        setTimeout(() => {
            this.setupLayerControls();
        }, 100);
        
        console.log('🎛️ Heatmap controls added');
    };
    
    // Setup layer control event listeners
    window.CrimeMap.prototype.setupLayerControls = function() {
        const markersToggle = document.getElementById('toggle-markers');
        const heatmapToggle = document.getElementById('toggle-heatmap');
        const heatmapControls = document.getElementById('heatmap-controls');
        const intensitySlider = document.getElementById('heat-intensity');
        const intensityValue = document.getElementById('intensity-value');
        
        if (markersToggle) {
            markersToggle.addEventListener('change', (e) => {
                this.showMarkers = e.target.checked;
                this.updateDisplayMode();
            });
        }
        
        if (heatmapToggle) {
            heatmapToggle.addEventListener('change', (e) => {
                this.showHeatmap = e.target.checked;
                if (heatmapControls) {
                    heatmapControls.style.display = e.target.checked ? 'block' : 'none';
                }
                this.updateDisplayMode();
            });
        }
        
        if (intensitySlider && intensityValue) {
            intensitySlider.addEventListener('input', (e) => {
                this.heatmapIntensity = parseFloat(e.target.value);
                intensityValue.textContent = `${Math.round(this.heatmapIntensity * 100)}%`;
                if (this.showHeatmap) {
                    this.updateHeatmap();
                }
            });
        }
    };
    
    // Update display based on selected layers
    window.CrimeMap.prototype.updateDisplayMode = function() {
        // Clear current displays
        if (this.heatmapLayer) {
            this.map.removeLayer(this.heatmapLayer);
        }
        if (this.crimeMarkers) {
            this.map.removeLayer(this.crimeMarkers);
        }
        
        // Re-display based on settings
        if (this.currentCrimes && this.currentCrimes.length > 0) {
            const filteredCrimes = this.currentCrimes.filter(crime => this.shouldShowCrime(crime));
            
            if (this.showMarkers) {
                this.displayCrimeMarkers(filteredCrimes);
            }
            
            if (this.showHeatmap) {
                this.displayHeatmap(filteredCrimes);
            }
        }
        
        // Show notification
        let mode = [];
        if (this.showMarkers) mode.push('Crime Points');
        if (this.showHeatmap) mode.push('Heat Map');
        
        if (mode.length === 0) {
            this.showNotification('All layers hidden', 'info');
        } else {
            this.showNotification(`Showing: ${mode.join(' + ')}`, 'info');
        }
    };
    
    // Override displayCrimes to support both modes
    window.CrimeMap.prototype.displayCrimes = function(crimes) {
        // Store crimes for re-display
        this.currentCrimes = crimes;
        
        // Clear existing layers
        if (this.crimeMarkers) {
            this.crimeMarkers.clearLayers();
            this.map.removeLayer(this.crimeMarkers);
        }
        if (this.heatmapLayer) {
            this.map.removeLayer(this.heatmapLayer);
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

        // Display markers if enabled
        if (this.showMarkers) {
            this.displayCrimeMarkers(filteredCrimes);
        }
        
        // Display heatmap if enabled
        if (this.showHeatmap) {
            this.displayHeatmap(filteredCrimes);
        }

        console.log(`📍 Displayed ${filteredCrimes.length} of ${crimes.length} crimes`);
        
        // Update the count display
        this.updateFilteredCount(filteredCrimes.length);
        this.updateAreaStatistics(filteredCrimes);
    };
    
    // Display crime markers (original functionality)
    window.CrimeMap.prototype.displayCrimeMarkers = function(crimes) {
        const markers = crimes
            .map(crime => this.createCrimeMarker(crime))
            .filter(marker => marker !== null);

        if (markers.length > 0) {
            this.crimeMarkers.addLayers(markers);
            this.map.addLayer(this.crimeMarkers);
        }
    };
    
    // Add heatmap display method
    window.CrimeMap.prototype.displayHeatmap = function(crimes) {
        // Wait for plugin to load
        if (typeof L.heatLayer === 'undefined') {
            console.log('Waiting for heatmap plugin...');
            setTimeout(() => this.displayHeatmap(crimes), 100);
            return;
        }

        // Crime severity weights
        const crimeWeights = {
            'burglary': 2.0,
            'violent-crime': 2.5,
            'theft-from-the-person': 1.8,
            'vehicle-crime': 1.5,
            'anti-social-behaviour': 1.0,
            'drugs': 1.5,
            'robbery': 2.5,
            'public-order': 1.2,
            'criminal-damage-arson': 1.8,
            'other-theft': 1.3,
            'bicycle-theft': 1.0,
            'shoplifting': 1.0,
            'other-crime': 1.0
        };

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
            const weight = (crimeWeights[crime.category] || 1.0) * this.heatmapIntensity;
            
            return [lat, lng, weight];
        }).filter(point => point !== null);

        if (heatData.length === 0) {
            console.log('No valid coordinates for heatmap');
            return;
        }

        // Calculate radius based on zoom
        const zoom = this.map.getZoom();
        const radius = this.calculateHeatmapRadius(zoom);
        
        // Create heatmap layer
        this.heatmapLayer = L.heatLayer(heatData, {
            radius: radius,
            blur: 15,
            maxZoom: 17,
            max: 2.5,
            gradient: {
                0.0: 'rgba(0, 0, 255, 0)',
                0.1: 'rgba(0, 0, 255, 0.5)',
                0.2: 'rgba(0, 255, 255, 0.7)',
                0.4: 'rgba(0, 255, 0, 0.8)',
                0.6: 'rgba(255, 255, 0, 0.9)',
                0.8: 'rgba(255, 140, 0, 0.9)',
                1.0: 'rgba(255, 0, 0, 1)'
            }
        });

        this.heatmapLayer.addTo(this.map);
        console.log(`🔥 Heatmap created with ${heatData.length} points`);
    };
    
    // Update heatmap when intensity changes
    window.CrimeMap.prototype.updateHeatmap = function() {
        if (this.heatmapLayer && this.currentCrimes) {
            this.map.removeLayer(this.heatmapLayer);
            const filteredCrimes = this.currentCrimes.filter(crime => this.shouldShowCrime(crime));
            this.displayHeatmap(filteredCrimes);
        }
    };
    
    // Calculate appropriate radius for heatmap based on zoom
    window.CrimeMap.prototype.calculateHeatmapRadius = function(zoom) {
        // Adjust radius based on zoom level
        if (zoom <= 10) return 40;
        if (zoom <= 12) return 30;
        if (zoom <= 14) return 25;
        if (zoom <= 16) return 20;
        return 15;
    };
    
    // Add method to check if crime should be shown (if not already exists)
    if (!window.CrimeMap.prototype.shouldShowCrime) {
        window.CrimeMap.prototype.shouldShowCrime = function(crime) {
            if (this.activeFilters.has('all')) {
                return true;
            }
            return this.activeFilters.has(crime.category);
        };
    }
    
    // Add method to update filtered count (if not already exists)
    if (!window.CrimeMap.prototype.updateFilteredCount) {
        window.CrimeMap.prototype.updateFilteredCount = function(count) {
            const areaTotal = document.getElementById('area-total');
            if (areaTotal) {
                areaTotal.textContent = count;
            }
        };
    }
    
    // Add method to update area statistics (if not already exists)
    if (!window.CrimeMap.prototype.updateAreaStatistics) {
        window.CrimeMap.prototype.updateAreaStatistics = function(filteredCrimes) {
            const areaCommon = document.getElementById('area-common');
            const areaSafety = document.getElementById('area-safety');
            
            if (areaCommon && filteredCrimes.length > 0) {
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
            }
            
            if (areaSafety) {
                const count = filteredCrimes.length;
                const safetyScore = Math.max(1, Math.min(10, 10 - Math.floor(count / 10)));
                areaSafety.textContent = `${safetyScore}/10`;
                areaSafety.className = `safety-score ${safetyScore >= 7 ? 'good' : safetyScore >= 4 ? 'medium' : 'poor'}`;
            }
        };
    }
    
    console.log('🔥 Heatmap addon loaded successfully');
    
} else {
    console.error('CrimeMap class not found. Make sure map.js is loaded before map-heatmap.js');
}