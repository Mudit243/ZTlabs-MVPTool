const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const NodeGeocoder = require('node-geocoder');
const port = 3001;
const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('route_planning.db');

db.run(`
  CREATE TABLE IF NOT EXISTS Technician_loc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status BOOLEAN DEFAULT 0
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS Address_loc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT,
    x REAL,
    y REAL,
    completed BOOLEAN DEFAULT 0
  )
`);





function computeDistance(pointA, pointB) {
  const EARTH_RADIUS = 6371; // Radius of the Earth in kilometers
  const latitudeA = pointA.lat;
  const longitudeA = pointA.lng;
  const latitudeB = pointB.lat;
  const longitudeB = pointB.lng;

  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) *
    Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS * c;

  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function computeShortestRoute(locations) {
  // Ensure there are locations to visit
  if (!locations || locations.length < 2) {
    return { route: [], totalDistance: 0 };
  }

  const totalLocations = locations.length;
  const unvisitedLocations = [...locations];
  const startingPoint = unvisitedLocations.shift(); // Start at the first location
  const shortestRoute = [startingPoint];
  let totalDistance = 0;

  while (unvisitedLocations.length > 0) {
    const currentLocation = shortestRoute[shortestRoute.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Number.MAX_VALUE;

    // Find the nearest unvisited location
    for (let i = 0; i < unvisitedLocations.length; i++) {
      const distance = computeDistance(currentLocation, unvisitedLocations[i]);

      if (distance < nearestDistance) {
        nearestIndex = i;
        nearestDistance = distance;
      }
    }

    // Move to the nearest unvisited location
    shortestRoute.push(unvisitedLocations.splice(nearestIndex, 1)[0]);
    totalDistance += nearestDistance;
  }

  // Return to the starting location to complete the route
  shortestRoute.push(shortestRoute[0]);

  return { route: shortestRoute, totalDistance };
}




// // Dijkstra's algorithm to calculate the shortest route
// function calculateShortestRoute(startLocation, jobLocations) {
//   if (!Array.isArray(jobLocations) || jobLocations.length < 2) {
//     console.error('Invalid jobLocations array:', jobLocations);
//     return { route: [], totalDistance: 0 };
//   }

//   const distances = {};
//   const previous = {};
//   const visited = {};

//   jobLocations.forEach(location => {
//     distances[location] = Infinity;
//     previous[location] = null;
//   });

//   distances[startLocation] = 0;

//   while (Object.keys(visited).length < jobLocations.length) {
//     let current = null;
//     let shortestDistance = Infinity;

//     for (const location in distances) {
//       if (!visited[location] && distances[location] < shortestDistance) {
//         current = location;
//         shortestDistance = distances[location];
//       }
//     }

//     if (current === null) {
//       break;
//     }

//     visited[current] = true;

//     jobLocations.forEach(neighbor => {
//       if (!visited[neighbor]) {
//         const distance = calculateDistance(current, neighbor);
//         const totalDistance = distances[current] + distance;

//         if (totalDistance < distances[neighbor]) {
//           distances[neighbor] = totalDistance;
//           previous[neighbor] = current;
//         }
//       }
//     });
//   }

//   let current = jobLocations[jobLocations.length - 1];
//   const path = [current];

//   while (current !== startLocation) {
//     current = previous[current];
//     path.unshift(current);
//   }

//   return { route: path, totalDistance: distances[jobLocations[jobLocations.length - 1]] };
// }


const geocode = {
  provider: 'google',
  apiKey: 'AIzaSyC3FqeaNMevABlI83EbJodYxsnmpoxi1Ls', 
};
const geocoder = NodeGeocoder(geocode);

app.post('/geocode-address', async (req, res) => {
  const { address } = req.body;

  try {
    // Perform geocoding using the configured geocoder
    const geooutput = await geocoder.geocode(address);

    // Check if there is a result
    if (geooutput.length > 0) {
      const { latitude, longitude } = geooutput[0];
      res.json({ coordinates: { latitude, longitude } });
    } else {
      res.status(404).json({ error: 'Geocoding unsuccessful' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Glitch' });
  }
});

app.post('/geocode-technician-location', async (req, res) => {
  const { technicianLocation } = req.body;

  try {
    // Perform geocoding using the configured geocoder
    const geooutput = await geocoder.geocode(technicianLocation);

    // Check if there is a result
    if (geooutput && geooutput.length > 0) {
      const { latitude, longitude } = geooutput[0];
      res.json({ coordinates: { latitude, longitude } });
    } else {
      res.status(404).json({ error: 'Geocoding unsuccessful' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Glitch' });
  }
});



// API endpoint to receive job locations, return optimized route, and store data
app.post('/optimize-route', express.json(), (req, res) => {
  const { jobLocations } = req.body;
  // Calculate optimized route
  const { route, totalDistance } = computeShortestRoute(jobLocations);

  console.log('Optimized Route:', route);
  console.log('Total Distance:', totalDistance);

  // Store job locations and optimized route in the database
  jobLocations.forEach(location => {
    db.run('INSERT INTO job_locations (name, x, y) VALUES (?, ?, ?)',
      location.name, location.x, location.y, (err) => {
        if (err) {
          res.status(500).send('Internal Glitch');
          return;
        }
      });
  });

  // Return optimized route and total distance to the client
  res.json({ route, totalDistance });
});


app.post('/mark-completed', express.json(), (req, res) => {
  const { jobId, jobType } = req.body;

  // Update job completion status in the database based on jobType
  const tableName = jobType === 'address' ? 'job_locations' : 'technician_locations';

  db.run(`UPDATE ${tableName} SET completed = 1 WHERE id = ?`,
    jobId, (err) => {
      if (err) {
        res.status(500).send('Internal Glitch');
        return;
      }

      res.status(200).send('Job marked as completed successfully');
    });
});



app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
