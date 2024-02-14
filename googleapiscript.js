let map;
let markers = [];
let pathpolyine;
let countind = 0;
let completedJobs = [];

const apiUrl = 'http://localhost:3001';

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 28.5195044, lng: 77.3626324 },
    zoom: 8,
  });

  const addressAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("plotaddress")
  );
  const technicianAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("plotTechnician")
  );
}

function plotaddress() {
  const plotaddress = document.getElementById("plotaddress");
  const address = plotaddress.value;

  if (address.trim() !== "") {
    // Geocode the address and add a marker to the map
    geocodeAddress(address);

    // Optional: Center the map on the new marker
    const location = markers.length > 0 ? markers[markers.length - 1].getPosition() : { lat: 28.5195044, lng: 77.3626324 };
    map.setCenter(location);
  }

  plotaddress.value = "";
}

function addTechnicianLocation() {
  const plotTechnician = document.getElementById("plotTechnician");
  const technicianLocation = plotTechnician.value;

  if (technicianLocation.trim() !== "") {
    // Geocode the technician's location and add a marker to the map
    geocodeTechnicianLocation(technicianLocation);

    // Optional: Center the map on the technician's marker
    const location = markers.length > 0 ? markers[markers.length - 1].getPosition() : { lat: 0, lng: 0 };
    map.setCenter(location);
  }

  plotTechnician.value = "";
}

function geocodeAddress(address) {
  // Make an API request to geocode the address and add a marker to the map
  fetch(`${apiUrl}/geocode-address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address }),
  })
    .then(response => response.json())
    .then(data => {
      const coordinates = data.coordinates;

      // Check if coordinates are valid numbers
      if (!isNaN(coordinates.latitude) && !isNaN(coordinates.longitude)) {
        // Add a marker to the map for the address
        const marker = new google.maps.Marker({
          position: { lat: coordinates.latitude, lng: coordinates.longitude },
          map: map,
          title: `Geocoded Location: ${coordinates.latitude}, ${coordinates.longitude}`,
        });

        markers.push(marker);

        // Optional: Center the map on the new marker
        map.setCenter({ lat: coordinates.latitude, lng: coordinates.longitude });
      }
    })
}

function geocodeTechnicianLocation(technicianLocation) {
  // Make an API request to geocode the technician's location and add a marker to the map
  fetch(`${apiUrl}/geocode-technician-location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ technicianLocation }),
  })
    .then(response => response.json())
    .then(data => {

      const coordinates = data.coordinates;

      if (!isNaN(coordinates.latitude) && !isNaN(coordinates.longitude)) {
        

        const marker = new google.maps.Marker({
          position: { lat: coordinates.latitude, lng: coordinates.longitude },
          map: map,
          icon: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
          title: "Technician Location",
        });

        markers.push(marker);
        map.setCenter({ lat: coordinates.latitude, lng: coordinates.longitude });

      } 
    })
}


function planRoute() {
  if (markers.length < 2) {return;}

  const locations = markers.map(marker => marker.getPosition());

  // Make an API request to calculate the optimized route
  fetch(`${apiUrl}/optimize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobLocations: locations }),
  })
    .then(response => response.json())
    .then(data => {
      // Check if the received data is valid
      if (data && data.route && Array.isArray(data.route) && data.route.length > 0) {
        // Clear existing route polyline
        if (pathpolyine) {
          pathpolyine.setMap(null);
        }

        
        pathpolyine = new google.maps.Polyline({
          path: data.route.map(location => new google.maps.LatLng(location.lat, location.lng)),
          geodesic: true,
          strokeColor: "#FF0000",
          strokeOpacity: 1.0,
          strokeWeight: 2,
          map: map,
        });

        const bounds = new google.maps.LatLngBounds();
        data.route.forEach(location => bounds.extend(location));
        map.fitBounds(bounds);

        console.log('Optimized Path:', data.route);
        console.log('Total Distance:', data.totalDistance);
      } 
    })
}


function markJobCompleted(jobType) {
  // Check if there are any jobs left to mark as completed
  if (countind < markers.length) {
    // Make an API request to mark the job as completed
    fetch(`${apiUrl}/mark-completed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId: countind, jobType }), // Include jobType in the request
    })
      .then(response => {
        if (response.ok) {
          // Mark the current job as completed based on jobType
          const completedMarker = markers[countind];
          completedJobs.push(completedMarker);

          // Update marker icon based on jobType
          const iconUrl = jobType === 'address' ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' :
            'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
          updateMarkerIcon(completedMarker, iconUrl);

          countind++;

         
          if (countind < markers.length) {
          
            updatepathpolyine();
          } else {
            
            alert("All jobs completed!");
          }
        }
      })
  }
}

function updateMarkerIcon(marker, iconUrl) {
  marker.setIcon({
    url: iconUrl,
    scaledSize: new google.maps.Size(20, 20), // Adjust size if needed
  });
}



function updateMarkerIcon(marker, iconUrl) {
  marker.setIcon({
    url: iconUrl,
    scaledSize: new google.maps.Size(20, 20), // Adjust size if needed
  });
}

function updatepathpolyine() {
  if (pathpolyine) {
    const remainingLocations = markers.slice(countind).map(marker => marker.getPosition());

    // Update the route polyline to represent the remaining route
    pathpolyine.setPath(remainingLocations);
  }
}
