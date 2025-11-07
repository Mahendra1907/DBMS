# Geoapify Maps Integration Guide

## Overview
The Courier Management System now includes Geoapify maps integration for visualizing parcel routes and locations.

## Features Implemented

### 1. Route Visualization
- Interactive map showing parcel journey from origin to destination
- Visual markers for origin, checkpoints, current location, and destination
- Timeline view with location history

### 2. Where It's Used
- **Tracking Page** (`tracking.html`): Displays route map when tracking a parcel

## Setup Instructions

### Step 1: Get Your Geoapify API Key
1. Visit [Geoapify](https://www.geoapify.com/)
2. Sign up for a free account
3. Navigate to your dashboard and create an API key
4. Copy your API key

### Step 2: Add API Key to Project
1. Open `public/tracking.js`
2. Find line 5:
   ```javascript
   const GEOAPIFY_API_KEY = 'YOUR_GEOAPIFY_API_KEY';
   ```
3. Replace `YOUR_GEOAPIFY_API_KEY` with your actual API key:
   ```javascript
   const GEOAPIFY_API_KEY = 'your-actual-api-key-here';
   ```
4. **Example**: If your API key is `2e582ecc460546f6a217bc46566ccdbc`, the line should be:
   ```javascript
   const GEOAPIFY_API_KEY = '2e582ecc460546f6a217bc46566ccdbc';
   ```

### Step 3: Save and Test
1. Save the file
2. **Important**: Open your browser's Developer Console (F12 or Right-click > Inspect)
3. Visit the tracking page: http://localhost:3000/tracking.html
4. Track a parcel (use tracking ID like `CMS001` or any valid ID from your database)
5. Check the console for debug messages like:
   - `🗺️ Displaying map for locations: [...]`
   - `Geocoding location 1: New York`
   - `✓ Got coordinates for New York: {lat: 40.7128, lon: -74.006}`
   - `🗺️ Static map URL: ...`

**If maps are not loading:**
- Check browser console for errors
- Verify API key is correct and not expired
- Ensure parcel has valid origin and destination cities
- Check Geoapify API usage limits in your dashboard

## Current Implementation

### Map Display Modes

#### Mode 1: With API Key + Geocoding Success
When you have a valid API key and addresses geocode successfully:
- Display static map image from Geoapify
- Show colored markers for each location (green=origin, orange=current, red=destination, blue=checkpoints)
- Automatic zoom to fit all locations
- Location badges overlaid on map

#### Mode 2: With API Key but Geocoding Fails
When API key is configured but geocoding fails:
- Fallback to timeline view
- Route information in structured list format
- Location timeline with visual indicators

#### Mode 3: Without API Key
When no API key is configured:
- A message prompting to add the API key
- Route information in structured list format

### Location Types Displayed
- **Origin** 🏁: Starting point of the shipment
- **Checkpoints** 📍: Intermediate locations from tracking history
- **Current Location** 📍: Most recent location (pulsing animation)
- **Destination** 🎯: Final delivery location

## API Usage

### Geocoding Function
The system includes a geocoding function to convert addresses to coordinates:
```javascript
async function geocodeAddress(address) {
    const response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${GEOAPIFY_API_KEY}`
    );
    const data = await response.json();
    // Returns { lat, lon } coordinates
}
```

## Enhanced Features (Future)

### Planned Improvements
1. **Interactive Map**: Replace static visualization with Leaflet/Mapbox
2. **Route Calculation**: Show actual driving/transit routes between points
3. **Geocoding Integration**: Automatic coordinate lookup for city names
4. **Real-time Updates**: Live location tracking with GPS integration
5. **Multi-stop Routes**: Support for multiple delivery stops

## Testing

### Test Tracking ID
Use the sample tracking ID from the database:
```
CMS001
```

Or create a new booking through:
- User Dashboard (http://localhost:3000/user-dashboard.html)
- Login: customer@test.com / test123

### Test Locations
The system works with:
- City names: "New York", "Los Angeles", "Chicago", etc.
- Full addresses: "123 Main St, New York, NY"
- Any location string that can be geocoded

### Quick Test Page
Visit `http://localhost:3000/test-map.html` to test if your API key and basic map loading works.

**What you should see:**
- A map showing the United States
- Green marker at New York (left side)
- Red marker at Los Angeles (right side)
- If you see this, your API key is working correctly!

## Troubleshooting

### Map Not Showing
- **Check API Key**: Ensure your API key is correct
- **Console Errors**: Check browser console for API errors
- **Rate Limits**: Free tier has request limits
- **Network**: Ensure Geoapify API is accessible

### Display Issues
- **No Locations**: Parcel must have origin and destination
- **Single Location**: Map needs at least 2 points to display
- **Styling**: Check if Tailwind CSS is loading properly

## API Documentation
- [Geoapify Geocoding API](https://apidocs.geoapify.com/docs/geocoding/api/)
- [Geoapify Static Maps](https://apidocs.geoapify.com/docs/maps/api/)
- [Geoapify Routing](https://apidocs.geoapify.com/docs/routing/api/)

## Support
For issues or questions:
1. Check the browser console for errors
2. Verify API key is correct
3. Test with sample data
4. Review Geoapify documentation

## License
Geoapify has a free tier suitable for development and small projects.
For production use, consider their paid plans for higher limits.

