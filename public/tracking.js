// Tracking functionality with enhanced search
let searchTimeout;

// Geoapify API Key - Replace with your own key
const GEOAPIFY_API_KEY = 'YOUR_GEOAPIFY_API_KEY';
// Google Maps API Key - Replace with your own key
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

let googleMapsLoaded = false;
function loadGoogleMapsApi() {
    return new Promise((resolve, reject) => {
        if (googleMapsLoaded || window.google?.maps) {
            googleMapsLoaded = true;
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => { googleMapsLoaded = true; resolve(); };
        script.onerror = () => reject(new Error('Failed to load Google Maps API'));
        document.head.appendChild(script);
    });
}

async function displayGoogleMap(parcel, trackingHistory, currentLocation) {
    const container = document.getElementById('google-map');
    if (!container) return;
    if (GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Add your Google Maps API key in tracking.js</div>';
        return;
    }

    try {
        await loadGoogleMapsApi();

        const locations = [];
        if (parcel.origin) locations.push({ name: parcel.origin, type: 'origin' });
        (trackingHistory || []).forEach(h => { if (!locations.some(l => l.name === h.location)) locations.push({ name: h.location, type: 'checkpoint' }); });
        if (currentLocation && !locations.some(l => l.name === currentLocation)) locations.push({ name: currentLocation, type: 'current' });
        if (parcel.destination && !locations.some(l => l.name === parcel.destination)) locations.push({ name: parcel.destination, type: 'destination' });

        const map = new google.maps.Map(container, { zoom: 5, center: { lat: 20, lng: 0 }, mapTypeId: 'roadmap' });
        const geocoder = new google.maps.Geocoder();
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
        directionsRenderer.setMap(map);

        // Geocode all locations (use address strings)
        async function geocode(address) {
            return new Promise((resolve) => {
                geocoder.geocode({ address }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const loc = results[0].geometry.location;
                        resolve({ lat: loc.lat(), lng: loc.lng() });
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        const coords = [];
        for (const loc of locations) {
            const c = await geocode(loc.name);
            coords.push({ loc, c });
        }

        const valid = coords.filter(x => x.c);
        if (valid.length === 0) {
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Unable to geocode locations</div>';
            return;
        }

        // Fit bounds
        const bounds = new google.maps.LatLngBounds();
        valid.forEach(x => bounds.extend(x.c));
        map.fitBounds(bounds);

        // Render markers
        valid.forEach(({ loc, c }) => {
            const color = loc.type === 'origin' ? 'green' : loc.type === 'destination' ? 'red' : loc.type === 'current' ? 'orange' : 'blue';
            new google.maps.Marker({ position: c, map, title: `${loc.type.toUpperCase()}: ${loc.name}`, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: color, fillOpacity: 1, strokeWeight: 1, strokeColor: '#333' } });
        });

        // Build route from origin -> checkpoints -> destination
        const origin = coords.find(x => x.loc.type === 'origin' && x.c)?.c || valid[0].c;
        const destination = coords.find(x => x.loc.type === 'destination' && x.c)?.c || valid.at(-1).c;
        const waypoints = coords.filter(x => x.loc.type === 'checkpoint' && x.c).map(x => ({ location: x.c, stopover: true }));

        if (origin && destination) {
            directionsService.route({ origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING }, (result, status) => {
                if (status === 'OK') directionsRenderer.setDirections(result);
            });
        }
    } catch (e) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-red-500">Failed to load Google Map</div>';
    }
}

async function geocodeAddress(address) {
    try {
        const response = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${GEOAPIFY_API_KEY}`);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            return { lat, lon };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

async function displayRouteMap(parcel, trackingHistory, currentLocation) {
    const mapDiv = document.getElementById('route-map');
    
    // Collect all locations (origin, checkpoints, current, destination)
    const locations = [];
    
    // Add origin
    if (parcel.origin) locations.push({ name: parcel.origin, type: 'origin' });
    
    // Add checkpoints from history
    if (trackingHistory && trackingHistory.length > 0) {
        trackingHistory.forEach(h => {
            if (!locations.some(l => l.name === h.location)) {
                locations.push({ name: h.location, type: 'checkpoint' });
            }
        });
    }
    
    // Add current location if different from origin
    if (currentLocation && !locations.some(l => l.name === currentLocation)) {
        locations.push({ name: currentLocation, type: 'current' });
    }
    
    // Add destination
    if (parcel.destination && !locations.some(l => l.name === parcel.destination)) {
        locations.push({ name: parcel.destination, type: 'destination' });
    }
    
    // If we have at least origin and destination, try to display map
    if (locations.length >= 2 && GEOAPIFY_API_KEY !== 'YOUR_GEOAPIFY_API_KEY') {
        displayGeoapifyMap(locations, mapDiv);
    } else if (GEOAPIFY_API_KEY === 'YOUR_GEOAPIFY_API_KEY') {
        mapDiv.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-500 bg-gray-50">
                <div class="text-center p-6">
                    <p class="mb-2">🗺️ Map visualization available</p>
                    <p class="text-sm">Add your Geoapify API key to enable maps</p>
                </div>
            </div>
        `;
    } else {
        mapDiv.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-500 bg-gray-50">
                <div class="text-center p-6">
                    <p class="mb-2">📍 Route information available</p>
                    <div class="mt-4 space-y-2">
                        ${locations.map((loc, idx) => `
                            <div class="flex items-center justify-start text-left">
                                <span class="text-2xl mr-3">${getLocationIcon(loc.type)}</span>
                                <span class="text-gray-700">${idx + 1}. ${loc.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
}

function getLocationIcon(type) {
    switch(type) {
        case 'origin': return '🏁';
        case 'destination': return '🎯';
        case 'current': return '📍';
        default: return '📍';
    }
}

async function displayGeoapifyMap(locations, mapDiv) {
    // Try to geocode addresses and display static map
    try {
        const markers = [];
        const waypoints = [];
        
        console.log('🗺️ Displaying map for locations:', locations);
        
        for (let i = 0; i < locations.length && i < 10; i++) {
            const loc = locations[i];
            console.log(`Geocoding location ${i+1}:`, loc.name);
            const coords = await geocodeAddress(loc.name);
            
            if (coords) {
                console.log(`✓ Got coordinates for ${loc.name}:`, coords);
                waypoints.push(coords);
                // Determine marker color based on type
                let markerColor = 'blue';
                if (loc.type === 'origin') markerColor = 'green';
                else if (loc.type === 'destination') markerColor = 'red';
                else if (loc.type === 'current') markerColor = 'orange';
                
                // Geoapify marker syntax - simplified with lonlat prefix
                markers.push(`lonlat:${coords.lon},${coords.lat};color:${markerColor};size:large`);
            } else {
                console.log(`✗ Failed to geocode ${loc.name}`);
            }
        }
        
        console.log(`Geocoded ${waypoints.length} of ${locations.length} locations`);
        
        if (waypoints.length >= 2) {
            // Calculate bounding box for static map
            const lats = waypoints.map(w => w.lat);
            const lons = waypoints.map(w => w.lon);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const centerLat = (minLat + maxLat) / 2;
            const centerLon = (minLon + maxLon) / 2;
            
            // Create static map URL with markers and route
            const routeParam = waypoints.map(w => `${w.lon},${w.lat}`).join('|');
            
            let staticMapUrl = `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=800&height=400&center=lonlat:${centerLon},${centerLat}&zoom=5&apiKey=${GEOAPIFY_API_KEY}`;
            
            // Add markers as separate marker parameters
            markers.forEach(marker => {
                staticMapUrl += `&marker=${marker}`;
            });
            
            console.log('🗺️ Static map URL:', staticMapUrl.substring(0, 200) + '...');
            
            mapDiv.innerHTML = `
                <div class="relative h-full bg-gray-50 overflow-hidden">
                    <img src="${staticMapUrl}" alt="Route Map" class="w-full h-full object-cover">
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                        <div class="flex flex-wrap gap-2 justify-center">
                            ${locations.slice(0, 5).map((loc, idx) => `
                                <div class="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center space-x-2">
                                    <span class="text-2xl">${getLocationIcon(loc.type)}</span>
                                    <span class="text-sm font-semibold text-gray-800">${idx + 1}. ${loc.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Fallback to timeline view if geocoding fails
            displayTimelineView(locations, mapDiv);
        }
    } catch (error) {
        console.error('Map display error:', error);
        displayTimelineView(locations, mapDiv);
    }
}

function displayTimelineView(locations, mapDiv) {
    // Fallback timeline view
    mapDiv.innerHTML = `
        <div class="relative h-full bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
            <div class="absolute inset-0 p-6">
                <div class="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg shadow-lg p-4 h-full overflow-y-auto">
                    <h4 class="text-sm font-bold text-gray-700 mb-4 text-center">📍 Route Overview</h4>
                    <div class="space-y-4">
                        ${locations.map((loc, idx) => `
                            <div class="flex items-start space-x-3 pb-3 border-b border-gray-200 last:border-0">
                                <div class="flex-shrink-0 mt-1">
                                    <div class="flex flex-col items-center">
                                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${getLocationColorClass(loc.type)}">
                                            ${idx + 1}
                                        </div>
                                        ${idx < locations.length - 1 ? '<div class="w-0.5 h-6 bg-gray-300 my-1"></div>' : ''}
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <p class="font-semibold text-gray-800 flex items-center">
                                        ${getLocationIcon(loc.type)}
                                        <span class="ml-2">${loc.name}</span>
                                    </p>
                                    <p class="text-xs text-gray-500 mt-1">${getLocationTypeText(loc.type)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getLocationColorClass(type) {
    switch(type) {
        case 'origin': return 'bg-green-500';
        case 'destination': return 'bg-blue-600';
        case 'current': return 'bg-yellow-500 animate-pulse';
        default: return 'bg-blue-400';
    }
}

function getLocationTypeText(type) {
    switch(type) {
        case 'origin': return 'Origin Point';
        case 'destination': return 'Final Destination';
        case 'current': return 'Current Location';
        default: return 'Checkpoint';
    }
}

// Search suggestions as user types
document.getElementById('trackingId').addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    const suggestionsDiv = document.getElementById('searchSuggestions');
    
    if (query.length < 2) {
        suggestionsDiv.classList.add('hidden');
        return;
    }
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/tracking/search?q=${encodeURIComponent(query)}&limit=5`);
            const results = await response.json();
            
            if (results.length > 0) {
                suggestionsDiv.innerHTML = results.map(parcel => `
                    <div class="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 suggestion-item" 
                         data-tracking-id="${parcel.tracking_id}">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-semibold text-gray-800">${parcel.tracking_id}</p>
                                <p class="text-sm text-gray-600">${parcel.sender_name} → ${parcel.receiver_name}</p>
                            </div>
                            <span class="status-badge ${
                                parcel.status === 'Delivered' ? 'status-delivered' :
                                parcel.status === 'In Transit' ? 'status-in-transit' : 'status-pending'
                            }">${parcel.status}</span>
                        </div>
                    </div>
                `).join('');
                
                suggestionsDiv.classList.remove('hidden');
                
                // Add click handlers to suggestions
                document.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        document.getElementById('trackingId').value = item.dataset.trackingId;
                        suggestionsDiv.classList.add('hidden');
                        document.getElementById('trackingForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    });
                });
            } else {
                suggestionsDiv.classList.add('hidden');
            }
        } catch (error) {
            console.error('Search error:', error);
            suggestionsDiv.classList.add('hidden');
        }
    }, 300);
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#trackingId') && !e.target.closest('#searchSuggestions')) {
        document.getElementById('searchSuggestions').classList.add('hidden');
    }
});

// Enhanced tracking form submission
document.getElementById('trackingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const trackingId = document.getElementById('trackingId').value.trim().toUpperCase();
    const resultsDiv = document.getElementById('results');
    const errorDiv = document.getElementById('error');
    const trackButton = document.getElementById('trackButton');
    const trackButtonText = document.getElementById('trackButtonText');
    const trackButtonLoader = document.getElementById('trackButtonLoader');
    
    // Hide previous results and suggestions
    resultsDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    document.getElementById('searchSuggestions').classList.add('hidden');
    
    // Show loading state
    trackButton.disabled = true;
    trackButtonText.textContent = 'Tracking...';
    trackButtonLoader.classList.remove('hidden');
    
    try {
        const response = await fetch(`/api/parcels/${trackingId}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Parcel not found');
        }
        
        // Animate results appearance
        setTimeout(async () => {
            await displayParcelDetails(data);
            displayTrackingHistory(data.tracking_history || []);
            resultsDiv.classList.remove('hidden');
            // Scroll to the "Where is My Item?" section after a brief delay
            setTimeout(() => {
                const locationSection = document.getElementById('current-location')?.closest('.bg-gradient-to-br');
                if (locationSection) {
                    locationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }, 300);
        
    } catch (error) {
        errorDiv.classList.remove('hidden');
        document.getElementById('error-message').textContent = error.message || 'Failed to fetch parcel details. Please check your tracking ID.';
    } finally {
        trackButton.disabled = false;
        trackButtonText.textContent = 'Track Parcel';
        trackButtonLoader.classList.add('hidden');
    }
});

async function displayParcelDetails(parcel) {
    document.getElementById('tracking-id').textContent = parcel.tracking_id;
    
    // Status with badge
    const statusEl = document.getElementById('status');
    statusEl.textContent = parcel.status;
    statusEl.className = 'text-lg font-semibold status-badge ';
    
    if (parcel.status === 'Delivered') {
        statusEl.classList.add('status-delivered');
    } else if (parcel.status === 'In Transit') {
        statusEl.classList.add('status-in-transit');
    } else {
        statusEl.classList.add('status-pending');
    }
    
    document.getElementById('sender-name').textContent = parcel.sender_name;
    document.getElementById('sender-contact').textContent = 
        (parcel.sender_email || '') + (parcel.sender_phone ? ` | ${parcel.sender_phone}` : '');
    
    document.getElementById('receiver-name').textContent = parcel.receiver_name;
    document.getElementById('receiver-contact').textContent = 
        (parcel.receiver_email || '') + (parcel.receiver_phone ? ` | ${parcel.receiver_phone}` : '');
    
    document.getElementById('origin').textContent = parcel.origin;
    document.getElementById('destination').textContent = parcel.destination;
    
    // Format dates
    if (parcel.date_created) {
        document.getElementById('date-created').textContent = new Date(parcel.date_created).toLocaleString();
    }
    if (parcel.last_updated) {
        document.getElementById('last-updated').textContent = new Date(parcel.last_updated).toLocaleString();
    }
    
    // Display current location information
    await displayCurrentLocation(parcel);
}

async function displayCurrentLocation(parcel) {
    // Get current location from tracking history or use origin
    const trackingHistory = parcel.tracking_history || [];
    let currentLocation = parcel.origin;
    let lastUpdate = parcel.date_created;
    
    if (trackingHistory.length > 0) {
        // Get the most recent location
        const sorted = [...trackingHistory].sort((a, b) => new Date(b.update_time) - new Date(a.update_time));
        currentLocation = sorted[0].location;
        lastUpdate = sorted[0].update_time;
    }
    
    // Display current location
    document.getElementById('current-location').textContent = currentLocation;
    document.getElementById('last-location-update').textContent = 
        `Last updated: ${new Date(lastUpdate).toLocaleString()}`;
    
    // Display origin and destination
    document.getElementById('origin-display').textContent = parcel.origin;
    document.getElementById('destination-display').textContent = parcel.destination;
    
    // Status badge
    const statusBadge = document.getElementById('current-status-badge');
    statusBadge.textContent = parcel.status;
    statusBadge.className = 'status-badge text-xl px-6 py-3 ';
    
    if (parcel.status === 'Delivered') {
        statusBadge.classList.add('status-delivered');
    } else if (parcel.status === 'In Transit') {
        statusBadge.classList.add('status-in-transit');
    } else {
        statusBadge.classList.add('status-pending');
    }
    
    // Display journey visualization
    displayJourneyMap(parcel, trackingHistory, currentLocation);
    
    // Display route map
    await displayRouteMap(parcel, trackingHistory, currentLocation);

    // Display Google Map (optional)
    await displayGoogleMap(parcel, trackingHistory, currentLocation);
}

function displayJourneyMap(parcel, history, currentLocation) {
    const journeyDiv = document.getElementById('journey-map');
    
    // Calculate progress
    const locations = [
        { name: parcel.origin, type: 'origin', status: 'completed' },
        ...history.map(h => ({ name: h.location, type: 'checkpoint', status: 'completed' })),
        { name: currentLocation, type: 'current', status: parcel.status === 'Delivered' ? 'completed' : 'current' },
        ...(parcel.status !== 'Delivered' ? [{ name: parcel.destination, type: 'destination', status: 'pending' }] : [])
    ];
    
    // Remove duplicates while preserving order
    const uniqueLocations = [];
    const seen = new Set();
    locations.forEach(loc => {
        if (!seen.has(loc.name)) {
            seen.add(loc.name);
            uniqueLocations.push(loc);
        }
    });
    
    // If delivered, ensure destination is in the list
    if (parcel.status === 'Delivered' && !uniqueLocations.some(l => l.name === parcel.destination)) {
        uniqueLocations.push({ name: parcel.destination, type: 'destination', status: 'completed' });
    }
    
    // Calculate progress percentage
    const completedCount = uniqueLocations.filter(l => l.status === 'completed').length;
    const progress = uniqueLocations.length > 1 ? (completedCount / uniqueLocations.length) * 100 : 0;
    
    // Generate journey visualization
    journeyDiv.innerHTML = `
        <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-600">Journey Progress</span>
                <span class="text-sm font-bold text-blue-600">${Math.round(progress)}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div class="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500" 
                     style="width: ${progress}%"></div>
            </div>
        </div>
        
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 overflow-x-auto pb-4">
            ${uniqueLocations.map((loc, index) => {
                const isActive = loc.status === 'current';
                const isCompleted = loc.status === 'completed';
                const isPending = loc.status === 'pending';
                
                let icon = '📍';
                let bgColor = 'bg-gray-200';
                let textColor = 'text-gray-600';
                
                if (loc.type === 'origin') {
                    icon = '🏁';
                    bgColor = isCompleted ? 'bg-green-500' : 'bg-blue-500';
                    textColor = 'text-white';
                } else if (loc.type === 'destination') {
                    icon = '🎯';
                    bgColor = isCompleted ? 'bg-green-500' : (isPending ? 'bg-gray-300' : 'bg-yellow-500');
                    textColor = isPending ? 'text-gray-500' : 'text-white';
                } else if (loc.type === 'current') {
                    icon = '📍';
                    bgColor = 'bg-yellow-500';
                    textColor = 'text-white';
                } else {
                    bgColor = isCompleted ? 'bg-green-400' : 'bg-blue-400';
                    textColor = 'text-white';
                }
                
                const showArrow = index < uniqueLocations.length - 1;
                
                return `
                    <div class="flex items-center ${showArrow ? 'md:flex-1' : ''}">
                        <div class="flex flex-col items-center flex-1 min-w-[120px]">
                            <div class="${bgColor} ${textColor} w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-2 shadow-lg transform ${isActive ? 'scale-110 animate-pulse' : ''} transition-all">
                                ${icon}
                            </div>
                            <p class="text-sm font-semibold text-gray-800 text-center ${isActive ? 'font-bold text-blue-600' : ''}">
                                ${loc.name}
                            </p>
                            ${loc.type === 'current' ? '<p class="text-xs text-blue-600 font-medium mt-1">📍 Current Location</p>' : ''}
                            ${loc.type === 'origin' ? '<p class="text-xs text-gray-500 mt-1">Origin</p>' : ''}
                            ${loc.type === 'destination' ? '<p class="text-xs text-gray-500 mt-1">Destination</p>' : ''}
                        </div>
                        ${showArrow ? `
                            <div class="hidden md:block mx-2 flex-1">
                                <div class="h-1 bg-gradient-to-r ${isCompleted ? 'from-green-400 to-green-500' : 'from-blue-400 to-blue-500'} rounded-full"></div>
                            </div>
                            <div class="md:hidden text-blue-600 text-xl my-2">↓</div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function displayTrackingHistory(history) {
    const historyDiv = document.getElementById('tracking-history');
    historyDiv.innerHTML = '';
    
    if (history.length === 0) {
        historyDiv.innerHTML = '<p class="text-gray-500">No tracking history available.</p>';
        return;
    }
    
    // Sort by update time (oldest first for timeline)
    history.sort((a, b) => new Date(a.update_time) - new Date(b.update_time));
    
    history.forEach((entry, index) => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'tracking-entry animate-fade-in';
        entryDiv.style.animationDelay = `${index * 0.1}s`;
        
        const statusClass = entry.status === 'Delivered' ? 'status-delivered' : 
                          entry.status === 'In Transit' ? 'status-in-transit' : 
                          'status-pending';
        
        entryDiv.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="status-badge ${statusClass}">${entry.status}</span>
                    <p class="text-gray-800 font-semibold mt-2 flex items-center">
                        <svg class="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        ${entry.location}
                    </p>
                </div>
                <p class="text-sm text-gray-500">${new Date(entry.update_time).toLocaleString()}</p>
            </div>
            ${entry.remarks ? `<p class="text-gray-600 ml-6">💬 ${entry.remarks}</p>` : ''}
        `;
        
        historyDiv.appendChild(entryDiv);
    });
}
