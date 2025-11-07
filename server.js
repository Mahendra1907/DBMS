const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Uploads (for proof of delivery)
const uploadDir = path.join(__dirname, 'public', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Database connection
const dbPath = path.join(__dirname, 'courier_management.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Helper function to generate tracking ID
function generateTrackingId() {
  return 'CMS' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    // Fetch full user details including name
    db.get('SELECT user_id, name, email, role FROM users WHERE user_id = ?', [user.userId], (err, fullUser) => {
      if (err || !fullUser) {
        return res.status(403).json({ error: 'User not found' });
      }
      req.user = {
        userId: fullUser.user_id,
        name: fullUser.name,
        email: fullUser.email,
        role: fullUser.role
      };
    next();
    });
  });
};

// ==================== ROUTES ====================

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== AUTHENTICATION ====================

// Generic Login (returns role)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    bcrypt.compare(password, user.password, (err, match) => {
      if (err || !match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.user_id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    });
  });
});

// Registration (Customer by default)
app.post('/api/register', (req, res) => {
  const { name, email, password, role = 'customer' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  const safeRole = ['customer', 'agent'].includes(role) ? role : 'customer';
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Error hashing password' });
    db.run(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
      [name, email, hash, safeRole],
      function (err) {
        if (err) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        res.json({ user_id: this.lastID, message: 'Registration successful' });
      }
    );
  });
});

// Profile endpoints
app.get('/api/user/profile', authenticateToken, (req, res) => {
  db.get(`SELECT user_id, name, email, role FROM users WHERE user_id = ?`, [req.user.userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(user);
  });
});

app.put('/api/user/profile', authenticateToken, (req, res) => {
  const { name } = req.body;
  db.run(`UPDATE users SET name = ? WHERE user_id = ?`, [name, req.user.userId], function (err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Profile updated' });
  });
});

// ==================== USER BOOKING ====================
function calculateCost(weight = 1, delivery_type = 'normal') {
  const base = 5;
  const perKg = 2;
  const expressMultiplier = delivery_type === 'express' ? 1.5 : 1;
  return Number((base + weight * perKg) * expressMultiplier).toFixed(2);
}

// Naive ETA calculator (can be replaced by Maps distance matrix)
function estimateEtaMinutes(origin, destination, delivery_type = 'normal') {
  // Simple heuristic: 45 mins base + 15 per leg; express reduces by 20%
  let eta = 45 + 15;
  if (delivery_type === 'express') eta = Math.round(eta * 0.8);
  return eta;
}

// Quote endpoint: returns cost + ETA + price breakdown
app.post('/api/user/quote', (req, res) => {
  const { origin, destination, weight = 1, delivery_type = 'normal' } = req.body;
  if (!origin || !destination) return res.status(400).json({ error: 'origin and destination required' });
  const cost = Number(calculateCost(Number(weight), delivery_type));
  const eta = estimateEtaMinutes(origin, destination, delivery_type);
  const breakdown = {
    base: 5,
    perKg: 2 * Number(weight),
    expressMultiplier: delivery_type === 'express' ? 1.5 : 1,
    total: cost
  };
  res.json({ cost, eta_minutes: eta, price_breakdown: breakdown });
});

// Book a courier (customer)
app.post('/api/user/book', authenticateToken, (req, res) => {
  const {
    receiver_name,
    receiver_email,
    receiver_phone,
    origin,
    destination,
    from_address,
    to_address,
    weight,
    description,
    delivery_type = 'normal',
    pickup_time
  } = req.body;

  const tracking_id = generateTrackingId();
  const cost = calculateCost(Number(weight || 1), delivery_type);
  const eta_minutes = estimateEtaMinutes(origin, destination, delivery_type);
  const price_breakdown = JSON.stringify({ base: 5, perKg: 2 * Number(weight || 1), expressMultiplier: delivery_type === 'express' ? 1.5 : 1, total: Number(cost) });
  const otp_code = Math.floor(100000 + Math.random() * 900000).toString();

  db.run(
    `INSERT INTO parcels (tracking_id, sender_name, sender_email, sender_phone, receiver_name, receiver_email, receiver_phone, origin, destination, status, weight, description, from_address, to_address, delivery_type, cost, sender_id, pickup_time, eta_minutes, price_breakdown, otp_code)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tracking_id,
      req.user.name || 'Unknown',
      req.user.email || '',
      receiver_name,
      receiver_email || null,
      receiver_phone || null,
      origin,
      destination,
      Number(weight || 1),
      description || '',
      from_address || origin,
      to_address || destination,
      delivery_type,
      cost,
      req.user.userId,
      pickup_time || null,
      eta_minutes,
      price_breakdown,
      otp_code
    ],
    function (err) {
      if (err) {
        console.error('Booking error:', err);
        return res.status(500).json({ error: 'Failed to create booking', details: err.message });
      }

      // initial tracking entry
      db.run(
        `INSERT INTO tracking (parcel_id, location, status, remarks) VALUES (?, ?, ?, ?)`,
        [this.lastID, origin, 'Pending', 'Booking created'],
        () => {}
      );

      res.json({ parcel_id: this.lastID, tracking_id, cost: Number(cost), eta_minutes, otp_preview: '******' });
    }
  );
});

// User shipments history
app.get('/api/user/shipments', authenticateToken, (req, res) => {
  db.all(
    `SELECT * FROM parcels WHERE sender_id = ? ORDER BY date_created DESC`,
    [req.user.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

// User feedback
app.post('/api/user/feedback', authenticateToken, (req, res) => {
  const { parcel_id, message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  db.run(
    `INSERT INTO feedback (user_id, parcel_id, message) VALUES (?, ?, ?)`,
    [req.user.userId, parcel_id || null, message],
    function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ feedback_id: this.lastID, message: 'Feedback submitted' });
    }
  );
});

// ==================== AGENT MODULE ====================
// Agent login (via users with role 'agent' or delivery_agents table)
app.post('/api/agent/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ? AND role = 'agent'`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, user.password, (err, ok) => {
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ userId: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token });
    });
  });
});

// Agent tasks
app.get('/api/agent/tasks', authenticateToken, (req, res) => {
  if (req.user.role !== 'agent') return res.status(403).json({ error: 'Agent access required' });
  db.all(
    `SELECT * FROM parcels WHERE agent_id = (SELECT user_id FROM users WHERE user_id = ?) ORDER BY last_updated DESC` ,
    [req.user.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

// Agent updates parcel status with location
app.put('/api/agent/tasks/:parcelId', authenticateToken, (req, res) => {
  if (req.user.role !== 'agent') return res.status(403).json({ error: 'Agent access required' });
  const { parcelId } = req.params;
  const { status, location, remarks } = req.body;
  db.run(
    `UPDATE parcels SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE parcel_id = ?`,
    [status, parcelId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Parcel not found' });
      db.run(
        `INSERT INTO tracking (parcel_id, location, status, remarks) VALUES (?, ?, ?, ?)`,
        [parcelId, location, status, remarks || ''],
        () => res.json({ message: 'Status updated' })
      );
    }
  );
});

// Agent completes delivery with OTP and optional proof upload
app.post('/api/agent/tasks/:parcelId/deliver', authenticateToken, upload.single('proof'), (req, res) => {
  if (req.user.role !== 'agent') return res.status(403).json({ error: 'Agent access required' });
  const { parcelId } = req.params;
  const { otp } = req.body;
  const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;

  db.get(`SELECT otp_code FROM parcels WHERE parcel_id = ?`, [parcelId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Parcel not found' });
    if (row.otp_code !== otp) return res.status(401).json({ error: 'Invalid OTP' });

    db.run(`UPDATE parcels SET status = 'Delivered', last_updated = CURRENT_TIMESTAMP, delivered_proof_url = ? WHERE parcel_id = ?`, [proofUrl, parcelId], function (err) {
      if (err) return res.status(500).json({ error: 'Update failed' });
      db.run(`INSERT INTO tracking (parcel_id, location, status, remarks) VALUES (?, ?, ?, ?)`, [parcelId, 'Destination', 'Delivered', 'Delivered with OTP verification'], () => {});
      res.json({ message: 'Delivery confirmed', proof_url: proofUrl });
    });
  });
});

// ==================== ANALYTICS: STAFF PERFORMANCE ====================
app.get('/api/admin/analytics/performance', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const result = {};
  db.all(`SELECT agent_id, COUNT(*) as deliveries FROM parcels WHERE status = 'Delivered' GROUP BY agent_id`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    result.deliveries_by_agent = rows;
    db.all(`SELECT AVG(eta_minutes) as avg_eta FROM parcels WHERE eta_minutes IS NOT NULL`, (err2, rows2) => {
      result.avg_eta_minutes = rows2 && rows2[0] ? rows2[0].avg_eta : null;
      res.json(result);
    });
  });
});

// ==================== ADMIN EXTRAS ====================
// Assign agent to parcel
app.post('/api/admin/parcels/:id/assign', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { id } = req.params;
  const { agent_user_id } = req.body; // user_id with role 'agent'
  db.run(`UPDATE parcels SET agent_id = ? WHERE parcel_id = ?`, [agent_user_id, id], function (err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Parcel not found' });
    res.json({ message: 'Agent assigned' });
  });
});

// ==================== PARCEL TRACKING ====================

// Get parcel by tracking ID
app.get('/api/parcels/:trackingId', (req, res) => {
  const { trackingId } = req.params;

  db.get(
    `SELECT p.*, 
     GROUP_CONCAT(t.location || ' | ' || t.status || ' | ' || datetime(t.update_time) || ' | ' || COALESCE(t.remarks, ''), ';;')
     as tracking_history
     FROM parcels p
     LEFT JOIN tracking t ON p.parcel_id = t.parcel_id
     WHERE p.tracking_id = ?
     GROUP BY p.parcel_id`,
    [trackingId],
    (err, parcel) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!parcel) {
        return res.status(404).json({ error: 'Parcel not found' });
      }

      // Parse tracking history
      const trackingHistory = parcel.tracking_history
        ? parcel.tracking_history.split(';;').map(entry => {
            const [location, status, update_time, remarks] = entry.split(' | ');
            return { location, status, update_time, remarks: remarks || '' };
          })
        : [];

      res.json({
        ...parcel,
        tracking_history: trackingHistory
      });
    }
  );
});

// Search parcels by tracking ID (partial match)
app.get('/api/tracking/search', (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  db.all(
    `SELECT tracking_id, sender_name, receiver_name, origin, destination, status, date_created
     FROM parcels
     WHERE tracking_id LIKE ? OR sender_name LIKE ? OR receiver_name LIKE ?
     ORDER BY date_created DESC
     LIMIT ?`,
    [`%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit)],
    (err, parcels) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(parcels);
    }
  );
});

// Get recent tracking updates (for dashboard)
app.get('/api/tracking/recent', (req, res) => {
  const { limit = 10 } = req.query;

  db.all(
    `SELECT t.*, p.tracking_id, p.sender_name, p.receiver_name, p.origin, p.destination
     FROM tracking t
     JOIN parcels p ON t.parcel_id = p.parcel_id
     ORDER BY t.update_time DESC
     LIMIT ?`,
    [parseInt(limit)],
    (err, updates) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(updates);
    }
  );
});

// Get tracking statistics
app.get('/api/tracking/stats', (req, res) => {
  db.all(
    `SELECT 
      status,
      COUNT(*) as count,
      COUNT(*) * 100.0 / (SELECT COUNT(*) FROM parcels) as percentage
     FROM parcels
     GROUP BY status`,
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(stats);
    }
  );
});

// Get parcels by status
app.get('/api/tracking/status/:status', (req, res) => {
  const { status } = req.params;

  db.all(
    `SELECT * FROM parcels WHERE status = ? ORDER BY date_created DESC`,
    [status],
    (err, parcels) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(parcels);
    }
  );
});

// ==================== ADMIN ROUTES (Protected) ====================

// Get all parcels with optional filters
app.get('/api/admin/parcels', authenticateToken, (req, res) => {
  const { status, search, sortBy = 'date_created', order = 'DESC' } = req.query;
  let query = `SELECT p.*, c.name as courier_name 
               FROM parcels p 
               LEFT JOIN couriers c ON p.courier_id = c.courier_id 
               WHERE 1=1`;
  const params = [];

  if (status) {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (p.tracking_id LIKE ? OR p.sender_name LIKE ? OR p.receiver_name LIKE ? OR p.origin LIKE ? OR p.destination LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
  }

  // Validate sortBy to prevent SQL injection
  const allowedSortBy = ['date_created', 'last_updated', 'tracking_id', 'status'];
  const sortColumn = allowedSortBy.includes(sortBy) ? sortBy : 'date_created';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY p.${sortColumn} ${sortOrder}`;

  db.all(query, params, (err, parcels) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(parcels);
  });
});

// Export parcels (CSV/JSON)
app.get('/api/admin/parcels/export', authenticateToken, (req, res) => {
  const { format = 'json' } = req.query;

  db.all(
    `SELECT p.*, c.name as courier_name 
     FROM parcels p 
     LEFT JOIN couriers c ON p.courier_id = c.courier_id 
     ORDER BY p.date_created DESC`,
    (err, parcels) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (format === 'csv') {
        // Convert to CSV
        if (parcels.length === 0) {
          return res.status(404).json({ error: 'No parcels to export' });
        }

        const headers = Object.keys(parcels[0]).join(',');
        const rows = parcels.map(p => Object.values(p).map(v => `"${v}"`).join(','));
        const csv = [headers, ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=parcels.csv');
        res.send(csv);
      } else {
        res.json(parcels);
      }
    }
  );
});

// Create new parcel
app.post('/api/admin/parcels', authenticateToken, (req, res) => {
  const {
    sender_name,
    receiver_name,
    sender_email,
    receiver_email,
    sender_phone,
    receiver_phone,
    origin,
    destination,
    weight,
    description,
    courier_id
  } = req.body;

  const tracking_id = generateTrackingId();
  const status = 'Pending';

  db.run(
    `INSERT INTO parcels 
     (tracking_id, sender_name, receiver_name, sender_email, receiver_email, 
      sender_phone, receiver_phone, origin, destination, status, weight, description, courier_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tracking_id, sender_name, receiver_name, sender_email, receiver_email,
      sender_phone, receiver_phone, origin, destination, status, weight, description, courier_id
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create parcel' });
      }

      // Create initial tracking entry
      db.run(
        `INSERT INTO tracking (parcel_id, location, status, remarks)
         VALUES (?, ?, ?, ?)`,
        [this.lastID, origin, 'Pending', 'Parcel registered'],
        (err) => {
          if (err) {
            console.error('Error creating tracking entry:', err);
          }
        }
      );

      res.json({
        parcel_id: this.lastID,
        tracking_id,
        message: 'Parcel created successfully'
      });
    }
  );
});

// Update parcel status
app.put('/api/admin/parcels/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status, location, remarks } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  db.run(
    `UPDATE parcels SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE parcel_id = ?`,
    [status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update parcel' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Parcel not found' });
      }

      // Add tracking entry
      if (location) {
        db.run(
          `INSERT INTO tracking (parcel_id, location, status, remarks)
           VALUES (?, ?, ?, ?)`,
          [id, location, status, remarks || ''],
          (err) => {
            if (err) {
              console.error('Error creating tracking entry:', err);
            }
          }
        );
      }

      res.json({ message: 'Parcel updated successfully' });
    }
  );
});

// Delete parcel
app.delete('/api/admin/parcels/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Delete tracking entries first
  db.run('DELETE FROM tracking WHERE parcel_id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete tracking entries' });
    }

    // Delete parcel
    db.run('DELETE FROM parcels WHERE parcel_id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete parcel' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Parcel not found' });
      }

      res.json({ message: 'Parcel deleted successfully' });
    });
  });
});

// ==================== COURIER MANAGEMENT ====================

// Get all couriers
app.get('/api/admin/couriers', authenticateToken, (req, res) => {
  db.all('SELECT * FROM couriers ORDER BY created_at DESC', (err, couriers) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(couriers);
  });
});

// Create courier
app.post('/api/admin/couriers', authenticateToken, (req, res) => {
  const { name, email, phone, vehicle_type } = req.body;

  db.run(
    `INSERT INTO couriers (name, email, phone, vehicle_type) VALUES (?, ?, ?, ?)`,
    [name, email, phone, vehicle_type],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create courier' });
      }
      res.json({
        courier_id: this.lastID,
        message: 'Courier created successfully'
      });
    }
  );
});

// Delete courier
app.delete('/api/admin/couriers/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM couriers WHERE courier_id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete courier' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Courier not found' });
    }

    res.json({ message: 'Courier deleted successfully' });
  });
});

// ==================== ANALYTICS ====================

// Get dashboard statistics
app.get('/api/admin/statistics', authenticateToken, (req, res) => {
  const stats = {};

  // Total parcels
  db.get('SELECT COUNT(*) as total FROM parcels', (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.total_parcels = result.total;

    // Status breakdown
    db.all(
      'SELECT status, COUNT(*) as count FROM parcels GROUP BY status',
      (err, statusCounts) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.status_breakdown = statusCounts;

        // Recent parcels
        db.all(
          'SELECT * FROM parcels ORDER BY date_created DESC LIMIT 5',
          (err, recent) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            stats.recent_parcels = recent;

            // Total couriers
            db.get('SELECT COUNT(*) as total FROM couriers', (err, courierResult) => {
              if (err) return res.status(500).json({ error: 'Database error' });
              stats.total_couriers = courierResult.total;

              res.json(stats);
            });
          }
        );
      }
    );
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure to run "npm run init-db" to initialize the database.');
});

