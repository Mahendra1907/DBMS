const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'courier_management.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('Connected to SQLite database.');
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table created/verified.');
    }
  });

  // Parcels table
  db.run(`CREATE TABLE IF NOT EXISTS parcels (
    parcel_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id TEXT UNIQUE NOT NULL,
    sender_name TEXT NOT NULL,
    receiver_name TEXT NOT NULL,
    sender_email TEXT,
    receiver_email TEXT,
    sender_phone TEXT,
    receiver_phone TEXT,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    weight REAL,
    description TEXT,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    courier_id INTEGER
  )`, (err) => {
    if (err) {
      console.error('Error creating parcels table:', err.message);
    } else {
      console.log('Parcels table created/verified.');
    }
  });

  // Tracking table
  db.run(`CREATE TABLE IF NOT EXISTS tracking (
    track_id INTEGER PRIMARY KEY AUTOINCREMENT,
    parcel_id INTEGER NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id)
  )`, (err) => {
    if (err) {
      console.error('Error creating tracking table:', err.message);
    } else {
      console.log('Tracking table created/verified.');
    }
  });

  // Couriers table
  db.run(`CREATE TABLE IF NOT EXISTS couriers (
    courier_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    vehicle_type TEXT,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating couriers table:', err.message);
    } else {
      console.log('Couriers table created/verified.');
    }
  });

  // Delivery agents table
  db.run(`CREATE TABLE IF NOT EXISTS delivery_agents (
    agent_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    assigned_area TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating delivery_agents table:', err.message);
    } else {
      console.log('Delivery agents table created/verified.');
    }
  });

  // Payments table
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    parcel_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id)
  )`, (err) => {
    if (err) {
      console.error('Error creating payments table:', err.message);
    } else {
      console.log('Payments table created/verified.');
    }
  });

  // Feedback table
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    parcel_id INTEGER,
    message TEXT NOT NULL,
    reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id)
  )`, (err) => {
    if (err) {
      console.error('Error creating feedback table:', err.message);
    } else {
      console.log('Feedback table created/verified.');
    }
  });

  // Add extended columns to parcels (best-effort; ignore errors if already exist)
  const alterParcels = [
    "ALTER TABLE parcels ADD COLUMN from_address TEXT",
    "ALTER TABLE parcels ADD COLUMN to_address TEXT",
    "ALTER TABLE parcels ADD COLUMN delivery_type TEXT DEFAULT 'normal'",
    "ALTER TABLE parcels ADD COLUMN dimensions TEXT",
    "ALTER TABLE parcels ADD COLUMN cost REAL",
    "ALTER TABLE parcels ADD COLUMN booking_date DATETIME DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE parcels ADD COLUMN sender_id INTEGER",
    "ALTER TABLE parcels ADD COLUMN agent_id INTEGER",
    "ALTER TABLE parcels ADD COLUMN pickup_time DATETIME",
    "ALTER TABLE parcels ADD COLUMN eta_minutes INTEGER",
    "ALTER TABLE parcels ADD COLUMN price_breakdown TEXT",
    "ALTER TABLE parcels ADD COLUMN otp_code TEXT",
    "ALTER TABLE parcels ADD COLUMN delivered_proof_url TEXT",
    "ALTER TABLE parcels ADD COLUMN delivered_signature TEXT"
  ];
  alterParcels.forEach(sql => {
    db.run(sql, (err) => {
      if (err && !String(err.message).includes('duplicate column name')) {
        console.warn('ALTER parcels warning:', err.message);
      }
    });
  });

  // Create default admin user
  const adminPassword = 'admin123';
  bcrypt.hash(adminPassword, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing admin password:', err.message);
      db.close();
      return;
    }
    
    db.run(`INSERT OR IGNORE INTO users (name, email, password, role) 
            VALUES (?, ?, ?, ?)`,
      ['Admin User', 'admin@cms.com', hash, 'admin'],
      function(err) {
        if (err) {
          console.error('Error creating admin user:', err.message);
        } else if (this.changes > 0) {
          console.log('Default admin user created: admin@cms.com / admin123');
        } else {
          console.log('Admin user already exists.');
        }
        
        // Create sample courier
        db.run(`INSERT OR IGNORE INTO couriers (name, email, phone, vehicle_type) 
                VALUES (?, ?, ?, ?)`,
          ['John Doe', 'john@courier.com', '+1234567890', 'Van'],
          function(err) {
            if (err) {
              console.error('Error creating sample courier:', err.message);
            } else if (this.changes > 0) {
              console.log('Sample courier created.');
            }
            
        // Create sample parcel
            db.run(`INSERT OR IGNORE INTO parcels 
                    (tracking_id, sender_name, receiver_name, origin, destination, status, from_address, to_address, weight, delivery_type, cost) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ['CMS001', 'Alice Smith', 'Bob Johnson', 'New York', 'Los Angeles', 'In Transit', '123 Main St, New York', '987 Sunset Blvd, Los Angeles', 2.5, 'express', 15.0],
              function(err) {
                if (err) {
                  console.error('Error creating sample parcel:', err.message);
                  db.close();
                } else {
                  const parcelId = this.lastID || 1;
                  // Create tracking entry for sample parcel
                  db.run(`INSERT OR IGNORE INTO tracking (parcel_id, location, status, remarks) 
                          VALUES (?, ?, ?, ?)`,
                    [parcelId, 'New York', 'In Transit', 'Package dispatched from origin'],
                    (err) => {
                      if (err) {
                        console.error('Error creating sample tracking:', err.message);
                      } else {
                        console.log('Sample parcel and tracking created.');
                      }
                      
                      // Close database after all operations complete
                      db.close((err) => {
                        if (err) {
                          console.error('Error closing database:', err.message);
                        } else {
                          console.log('\n=== Database Setup Complete ===');
                          console.log('Admin Login: admin@cms.com / admin123');
                          console.log('Sample Tracking ID: CMS001');
                        }
                      });
                    }
                  );
                }
              }
            );
          }
        );
      }
    );
  });
});

