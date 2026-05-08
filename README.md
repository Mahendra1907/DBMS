<<<<<<< HEAD
=======
# ShipZen-Courier-Management(CM)

A modern, responsive web application for managing courier operations digitally. The system automates courier processing, provides real-time tracking, and ensures accuracy and efficiency.

## Features

### 🌟 Core Features
- **Digital Automation**: Moves all key details—customer info, parcel status, delivery updates—from paper to a single, secure digital platform
- **Real-Time Tracking**: Enables instant parcel tracking, minimizing confusion and delay for both staff and end customers
- **Accuracy & Efficiency**: Reduces human error significantly, saving time and ensuring data integrity across all operations

### 📋 System Modules
1. **Customer Management**: Efficiently manage customer information and contact details
2. **Parcel Registration**: Quickly register new parcels with automatic tracking ID generation
3. **Route Optimization**: Smart algorithms optimize delivery routes
4. **Delivery Tracking**: Real-time tracking updates from origin to destination
5. **Analytics Dashboard**: Comprehensive insights with charts and reports

## Tech Stack

- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript
- **Backend**: Node.js with Express
- **Database**: SQLite
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs

## Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd "DBMS PROJECT"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   npm run init-db
   ```
   This will create the database with sample data:
   - Admin user: `admin@cms.com` / `admin123`
   - Sample parcel with tracking ID: `CMS001`

4. **Start the server**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
   - The server will run on port 3000 by default

## Database Schema

### Tables

1. **users**
   - `user_id` (PRIMARY KEY)
   - `name`
   - `email` (UNIQUE)
   - `password` (hashed)
   - `role` (admin/customer)
   - `created_at`

2. **parcels**
   - `parcel_id` (PRIMARY KEY)
   - `tracking_id` (UNIQUE)
   - `sender_name`, `receiver_name`
   - `sender_email`, `receiver_email`
   - `sender_phone`, `receiver_phone`
   - `origin`, `destination`
   - `status` (Pending/In Transit/Delivered)
   - `weight`, `description`
   - `date_created`, `last_updated`
   - `courier_id`

3. **tracking**
   - `track_id` (PRIMARY KEY)
   - `parcel_id` (FOREIGN KEY)
   - `location`
   - `status`
   - `update_time`
   - `remarks`

4. **couriers**
   - `courier_id` (PRIMARY KEY)
   - `name`, `email`, `phone`
   - `vehicle_type`
   - `status`
   - `created_at`

## API Endpoints

### Public Endpoints
- `GET /api/parcels/:trackingId` - Get parcel details by tracking ID

### Authentication
- `POST /api/login` - Admin login

### Admin Endpoints (Protected - Requires JWT)
- `GET /api/admin/parcels` - Get all parcels
- `POST /api/admin/parcels` - Create new parcel
- `PUT /api/admin/parcels/:id` - Update parcel status
- `DELETE /api/admin/parcels/:id` - Delete parcel
- `GET /api/admin/couriers` - Get all couriers
- `POST /api/admin/couriers` - Create courier
- `DELETE /api/admin/couriers/:id` - Delete courier
- `GET /api/admin/statistics` - Get dashboard statistics

## Usage

### For Customers
1. Visit the home page to learn about the system
2. Navigate to "Track Parcel" to enter a tracking ID
3. View real-time parcel status and tracking history

### For Administrators
1. Login at the Admin Login page
   - Email: `admin@cms.com`
   - Password: `admin123`
2. Access the Admin Dashboard with three tabs:
   - **Manage Parcels**: View, add, edit, update status, and delete parcels
   - **Manage Couriers**: View, add, and delete couriers
   - **Analytics**: View statistics and charts

## Design Features

- Clean, corporate look with soft blue-gray tones
- Rounded info cards with icons
- Consistent typography and white-space for readability
- Subtle animations for feature cards and button hovers
- Fully responsive design for mobile and desktop

## Project Structure

```
DBMS PROJECT/
├── server.js              # Express server and API routes
├── init-db.js             # Database initialization script
├── package.json           # Node.js dependencies
├── courier_management.db  # SQLite database (created after init-db)
├── public/                # Frontend files
│   ├── index.html         # Home page
│   ├── features.html      # Features page
│   ├── tracking.html      # Parcel tracking page
│   ├── admin-login.html   # Admin login page
│   ├── admin-dashboard.html # Admin dashboard
│   ├── styles.css         # Custom styles
│   ├── tracking.js        # Tracking functionality
│   ├── admin-login.js     # Admin login functionality
│   └── admin-dashboard.js # Admin dashboard functionality
└── README.md              # This file
```

## Security Features

- Password hashing using bcryptjs
- JWT-based authentication for admin routes
- Protected API endpoints with token validation
- SQL injection prevention using parameterized queries

## Future Enhancements (Optional)

- Email notifications for delivery updates
- PDF invoice generation
- Enhanced analytics dashboard with more charts
- Role-based access control (Admin, Staff, Customer)
- Multi-language support
- Mobile app integration

## License

This project is created for educational purposes as part of a DBMS project.

## Notes

- Make sure to run `npm run init-db` before starting the server for the first time
- The database file `courier_management.db` will be created automatically
- Default admin credentials are provided for initial access
- Sample parcel with tracking ID `CMS001` is created for testing
>>>>>>> 7852480 (Initial commit: Courier Management System)

