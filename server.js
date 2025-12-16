
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const dbName = process.env.DB_NAME || 'dahanu_db';

let pool;

// Initialize Database
const initDb = async () => {
  try {
    // 1. Create Connection to create DB if not exists
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();

    console.log(`Database ${dbName} checked/created.`);

    // 2. Initialize Pool with Database
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName
    });

    console.log('Connected to MySQL Database.');

    // 3. Create Tables
    
    // USERS Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255),
        phone VARCHAR(20),
        role ENUM('USER', 'VENDOR', 'ADMIN') DEFAULT 'USER',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Categories
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50),
        description TEXT,
        parent_id VARCHAR(50),
        theme_color VARCHAR(20) DEFAULT '#9C81A4',
        registration_fee DECIMAL(10,2) DEFAULT 999.00,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    // Vendors
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        rating DECIMAL(3,1),
        lat DECIMAL(10,8),
        lng DECIMAL(11,8),
        address TEXT,
        contact VARCHAR(50),
        masked_contact VARCHAR(50),
        is_verified BOOLEAN DEFAULT FALSE,
        is_approved BOOLEAN DEFAULT FALSE,
        image_url TEXT,
        promotional_banner_url TEXT,
        supports_delivery BOOLEAN DEFAULT FALSE,
        price_start DECIMAL(10,2),
        email VARCHAR(100),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Vendor Categories (Junction Table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_categories (
        vendor_id VARCHAR(50),
        category_id VARCHAR(50),
        PRIMARY KEY (vendor_id, category_id),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);

    // Products
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id VARCHAR(50),
        name VARCHAR(100),
        price DECIMAL(10,2),
        image_url TEXT,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      )
    `);

    // Banners
    await pool.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id VARCHAR(50) PRIMARY KEY,
        image_url TEXT,
        link TEXT,
        alt_text VARCHAR(255)
      )
    `);

    // Orders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        vendor_id VARCHAR(50),
        customer_name VARCHAR(100),
        customer_phone VARCHAR(20),
        service_requested VARCHAR(100),
        date VARCHAR(50),
        status VARCHAR(20),
        address TEXT,
        amount DECIMAL(10,2),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
      )
    `);

    console.log("Tables initialized.");

    // 4. Seed Data
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM categories");
    if (rows[0].count === 0) {
      console.log("Seeding Database...");
      await seedData();
    }
    
    // Seed Admin if not exists
    const [adminRows] = await pool.query("SELECT * FROM users WHERE role = 'ADMIN'");
    if (adminRows.length === 0) {
       console.log("Creating default Admin user...");
       await pool.query(
         "INSERT INTO users (id, name, email, password, phone, role) VALUES (?, ?, ?, ?, ?, ?)",
         ['u_admin', 'System Admin', 'admin@dahanu.com', 'admin123', '9876543210', 'ADMIN']
       );
    }

  } catch (err) {
    console.error("Database Initialization Error:", err);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // --- 1. CATEGORIES ---
    const categories = [
      ['dahanu_fresh', 'Dahanu Fresh', 'Apple', 'Fresh fruits, vegetables and organic produce.', '#43A047', null],
      ['dahanu_mart', 'Dahanu Mart', 'ShoppingBasket', 'Groceries, daily essentials, and supermarket.', '#FF5722', null],
      ['events', 'Events Services', 'PartyPopper', 'Everything you need for your special occasions.', '#9C27B0', null],
      ['medical', 'Medical & Health', 'Stethoscope', 'Healthcare services, clinics, and emergency support.', '#2196F3', null],
      ['transport', 'Transport', 'Truck', 'Logistics, travel agencies, and vehicle rentals.', '#FF9800', null],
      ['beauty', 'Beauty & Wellness', 'Sparkles', 'Salons, spas, and fitness centers.', '#E91E63', null],
      ['home', 'Home & Maintenance', 'Hammer', 'Repairs, renovations, and handyman services.', '#4CAF50', null],
      ['housekeeping', 'Housekeeping', 'SprayCan', 'Maids, cooks, and daily utility supplies.', '#009688', null],
      ['food', 'Food & Beverages', 'Utensils', 'Restaurants, cafes, and street food.', '#F44336', null],
      ['accom', 'Accommodation', 'Hotel', 'Hotels, lodges, and guest houses.', '#FFC107', null]
    ];

    for (const c of categories) {
      await pool.query(
        "INSERT IGNORE INTO categories (id, name, icon, description, theme_color, parent_id) VALUES (?,?,?,?,?,?)",
        c
      );
    }
    
    // Sub-Categories (Hospitals, etc)
    const subCategories = [
      ['hospitals', 'Hospitals & Clinics', null, null, null, 'medical'],
      ['clinic', 'Clinics', null, null, null, 'medical'],
      ['dentist', 'Dentists', null, null, null, 'medical'],
      ['diagnostics', 'Diagnostics', null, null, null, 'medical'],
      ['pharmacy', 'Pharmacies', null, null, null, 'medical'],
      ['ambulance', 'Ambulance', null, null, null, 'medical'],
      
      ['restaurant', 'Restaurants', null, null, null, 'food'],
      ['beverage', 'Beverages', null, null, null, 'food'],
      
      ['hotel', 'Hotels', null, null, null, 'accom'],
      ['agro', 'Agro Tourism', null, null, null, 'accom'],
      
      ['fruits', 'Fresh Fruits', null, null, null, 'dahanu_fresh'],
      ['organic', 'Organic Produce', null, null, null, 'dahanu_fresh'],
      
      ['daily_needs', 'Daily Essentials', null, null, null, 'dahanu_mart'],
      ['snacks', 'Snacks', null, null, null, 'dahanu_mart'],
      
      ['event_planning', 'Event Planning', null, null, null, 'events'],
      ['decorators', 'Decorators', null, null, null, 'events'],
      
      ['private_car', 'Private Cars', null, null, null, 'transport'],
      ['bus', 'Buses', null, null, null, 'transport'],
      ['auto_service', 'Automobile Services', null, null, null, 'transport']
    ];
    for (const s of subCategories) {
       await pool.query(
        "INSERT IGNORE INTO categories (id, name, icon, description, theme_color, parent_id) VALUES (?,?,?,?,?,?)",
        s
      );
    }

    // --- 2. VENDORS (Dahanu Specific Data) ---
    const vendors = [
      // Hospitals & Medical
      ['med_gov_1', 'Sub District Hospital (Cottage)', 'Government hospital providing emergency and general healthcare services. Trauma care available.', 4.0, 19.9720, 72.7150, 'Seaface Road, Dahanu West', '02528-222222', '02528 22****', true, true, 'https://images.unsplash.com/photo-1587351021759-3e566b9af953?auto=format&fit=crop&w=300&q=80', null, false, 0],
      ['med_pvt_1', 'Ashirwad Nursing Home', 'Multispeciality hospital with Maternity and Surgical care.', 4.6, 19.9735, 72.7320, 'Irani Road, Dahanu East', '+919922001122', '+91 99220 *****', true, true, 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=300&q=80', null, false, 500],
      ['med_eye_1', 'Dahanu Eye Hospital', 'Specialized eye care centre, cataract surgeries.', 4.8, 19.9750, 72.7300, 'Masoli, Dahanu', '+919822334455', '+91 98223 *****', true, true, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=300&q=80', null, false, 300],
      ['med_dent_1', 'Dr. Shah Dental Care', 'Advanced dental treatments, root canals, and implants.', 4.9, 19.9765, 72.7290, 'Station Road, Dahanu East', '+919000000002', '+91 90000 *****', true, true, 'https://images.unsplash.com/photo-1606811971618-4486d14f3f72?auto=format&fit=crop&w=300&q=80', null, false, 200],
      ['med_diag_1', 'Care Diagnostic Centre', 'Pathology, X-Ray, Sonography and ECG.', 4.3, 19.9740, 72.7310, 'Near Railway Station, Dahanu', '+919890000003', '+91 98900 *****', true, true, 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=300&q=80', null, false, 150],
      ['med_phar_1', 'Sanjeevani Medical Store', '24/7 Chemist and druggist. Free home delivery nearby.', 4.5, 19.9710, 72.7180, 'Main Market, Dahanu West', '+919890000004', '+91 98900 *****', true, true, 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=300&q=80', null, true, 10],

      // Food
      ['fd_1', 'Crazy Crab Restaurant', 'Famous for seafood and seaside dining experience. Must try: Crab Masala.', 4.7, 19.9680, 72.7100, 'Dahanu Beach', '02528-223344', '02528 22****', true, true, 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80', null, true, 300],
      ['fd_2', 'Hotel Shetkar', 'Authentic Maharashtrian Thali and non-veg delicacies.', 4.2, 19.9760, 72.7330, 'Near Flyover, Dahanu East', '+919988776655', '+91 99887 *****', false, true, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80', null, true, 120],
      ['fd_3', 'Beach Classic Restaurant', 'Garden restaurant with sea view. Chinese and Indian cuisine.', 4.4, 19.9690, 72.7110, 'Seaface, Dahanu', '02528-224455', '02528 22****', true, true, 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=300&q=80', null, true, 180],

      // Accom
      ['ht_1', 'Pearline Beach Resort', 'Luxury stay near the beach with swimming pool and AC rooms.', 4.5, 19.9650, 72.7120, 'Agar, Dahanu', '+919922334455', '+91 99223 *****', true, true, 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=300&q=80', null, false, 2500],
      ['ht_2', 'Save Farm', 'Authentic agro-tourism experience. Stay in nature, organic food.', 4.8, 20.0100, 72.7600, 'Gholvad, Dahanu', '02528-241130', '02528 24****', true, true, 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=300&q=80', null, false, 1500],

      // Fresh & Mart
      ['fr_1', 'Dahanu Organic Farms', 'Famous Gholvad Chikoos, Mangoes and Neera.', 4.9, 20.0050, 72.7550, 'Bordi Road', '+919800099999', '+91 98000 *****', true, true, 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=300&q=80', null, true, 60],
      ['mt_1', 'Dahanu Super Mart', 'One stop shop for all grocery needs.', 4.3, 19.9750, 72.7350, 'Main Market, Dahanu East', '+919888877777', '+91 98888 *****', true, true, 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80', null, true, 20],

      // Services
      ['ev_1', 'Royal Celebrations Hall', 'Spacious AC hall for weddings, birthdays and corporate events.', 4.4, 19.9800, 72.7400, 'Kosbad Road', '+919000000001', '+91 90000 *****', true, true, 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=300&q=80', null, false, 15000],
      ['tr_1', 'Om Sai Travels', 'Car rentals, Bus booking for Mumbai/Gujarat.', 4.2, 19.9745, 72.7315, 'Near Bus Stand, Dahanu', '+919998887776', '+91 99988 *****', true, true, 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=300&q=80', null, false, 1500],
      ['rep_1', 'Dahanu Auto Garage', 'Two wheeler and four wheeler repair, puncture and washing.', 4.1, 19.9730, 72.7250, 'Parnaka, Dahanu', '+917777777777', '+91 77777 *****', false, true, 'https://images.unsplash.com/photo-1597500746977-2c974c0b4629?auto=format&fit=crop&w=300&q=80', null, false, 50]
    ];

    for (const v of vendors) {
      await pool.query(
        `INSERT IGNORE INTO vendors 
        (id, name, description, rating, lat, lng, address, contact, masked_contact, is_verified, is_approved, image_url, promotional_banner_url, supports_delivery, price_start) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        v
      );
    }

    // --- 3. VENDOR CATEGORIES MAPPING ---
    const vc = [
      ['med_gov_1', 'hospitals'], ['med_gov_1', 'ambulance'],
      ['med_pvt_1', 'hospitals'], ['med_pvt_1', 'nursing'],
      ['med_eye_1', 'hospitals'], ['med_eye_1', 'clinic'],
      ['med_dent_1', 'dentist'], ['med_dent_1', 'clinic'],
      ['med_diag_1', 'diagnostics'],
      ['med_phar_1', 'pharmacy'],
      ['fd_1', 'restaurant'], ['fd_1', 'beverage'],
      ['fd_2', 'restaurant'],
      ['fd_3', 'restaurant'], ['fd_3', 'beverage'],
      ['ht_1', 'hotel'], ['ht_1', 'agro'],
      ['ht_2', 'agro'], ['ht_2', 'dahanu_fresh'],
      ['fr_1', 'dahanu_fresh'], ['fr_1', 'fruits'],
      ['mt_1', 'dahanu_mart'], ['mt_1', 'daily_needs'],
      ['ev_1', 'event_planning'], ['ev_1', 'decorators'],
      ['tr_1', 'private_car'], ['tr_1', 'bus'],
      ['rep_1', 'auto_service']
    ];
    for (const item of vc) {
      await pool.query("INSERT IGNORE INTO vendor_categories (vendor_id, category_id) VALUES (?,?)", item);
    }

    // --- 4. PRODUCTS ---
    const products = [
      ['med_phar_1', 'Paracetamol Strip', 20, null],
      ['med_phar_1', 'Cough Syrup', 85, null],
      ['med_phar_1', 'First Aid Kit', 250, null],
      ['fd_1', 'Crab Masala', 450, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=200&q=80'],
      ['fd_1', 'Pomfret Fry', 350, 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?auto=format&fit=crop&w=200&q=80'],
      ['fd_2', 'Chicken Thali', 200, null],
      ['fr_1', 'Dahanu Chikoo (1kg)', 60, 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=200&q=80'],
      ['fr_1', 'Kesar Mango (1 Dozen)', 800, null],
      ['mt_1', 'Sunflower Oil (1L)', 140, null],
      ['mt_1', 'Basmati Rice (1kg)', 90, null]
    ];
    for (const p of products) {
      await pool.query("INSERT INTO products (vendor_id, name, price, image_url) VALUES (?,?,?,?)", p);
    }

    // --- 5. BANNERS ---
    const banners = [
      ['1', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80', '#', 'Dahanu Fresh Chikoos'],
      ['2', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80', '#', 'Best Seafood in Town'],
      ['3', 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80', '#', 'Emergency Medical Services']
    ];
    for (const b of banners) {
      await pool.query("INSERT IGNORE INTO banners (id, image_url, link, alt_text) VALUES (?,?,?,?)", b);
    }

    console.log("Database Seeded Successfully with Dahanu Data.");
  } catch (err) {
    console.error("Seeding Error:", err);
  }
};

initDb();

// --- API ROUTES ---

// ========================
// AUTHENTICATION & OTP
// ========================

// In-memory OTP Store (NOTE: Use Redis or DB in production)
const otpStore = new Map();

// Request OTP
app.post('/api/auth/otp/request', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number required" });
  
  // Generate 4 digit OTP (Mocked)
  const otp = Math.floor(1000 + Math.random() * 9000).toString(); 
  
  console.log(`[AUTH] OTP generated for ${phone}: ${otp}`);
  otpStore.set(phone, { otp, expires: Date.now() + 300000 }); // 5 mins expiration

  // TODO: Integrate SMS Gateway here (e.g. Twilio, Msg91)
  res.json({ success: true, message: 'OTP sent successfully' });
});

// Verify OTP
app.post('/api/auth/otp/verify', async (req, res) => {
  const { phone, otp } = req.body;
  
  // Backdoor for demo/admin testing
  if (phone === '9876543210' && otp === '1234') {
     // Proceed to check user
  } else {
      const record = otpStore.get(phone);
      if (!record) return res.status(400).json({ error: "OTP not requested or expired" });
      if (record.otp !== otp) return res.status(400).json({ error: "Invalid OTP" });
      if (Date.now() > record.expires) {
          otpStore.delete(phone);
          return res.status(400).json({ error: "OTP Expired" });
      }
      otpStore.delete(phone); // Burn OTP after use
  }

  try {
    // Check if user exists
    const [users] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
    
    if (users.length > 0) {
       const user = users[0];
       delete user.password;
       res.json({ success: true, isNewUser: false, user });
    } else {
       res.json({ success: true, isNewUser: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Register User (Complete profile after OTP or direct)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { id, name, email, phone, role, password } = req.body;
    
    if (!id || !name || !email || !phone) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Check duplicates
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone]);
    if (existing.length > 0) return res.status(409).json({ error: "User already exists with this email or phone" });

    // Insert
    await pool.query(
        'INSERT INTO users (id, name, email, phone, role, password) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, email, phone, role || 'USER', password || null]
    );

    // Fetch created user
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    const user = users[0];
    delete user.password;

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Login (Password based - e.g. for Admin or specific users)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    
    const user = users[0];
    // NOTE: In production, compare hashed password (e.g., bcrypt.compare)
    if (user.password !== password) return res.status(401).json({ error: "Invalid credentials" }); 
    
    delete user.password;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// USER MANAGEMENT
// ========================

// Get All Users (Admin)
app.get('/api/users', async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single User
app.get('/api/users/:id', async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(users[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User
app.put('/api/users/:id', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        // Basic validation
        if (!name && !email && !phone) return res.status(400).json({error: "Nothing to update"});

        // Construct dynamic query
        let fields = [];
        let params = [];
        if (name) { fields.push('name = ?'); params.push(name); }
        if (email) { fields.push('email = ?'); params.push(email); }
        if (phone) { fields.push('phone = ?'); params.push(phone); }
        
        params.push(req.params.id);

        await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
        res.json({ success: true, message: "User updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// EXISTING APP ROUTES
// ========================

// 1. Get Categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories');
    
    // Recursive function to build tree
    const buildTree = (parentId) => {
      return rows
        .filter(cat => cat.parent_id === parentId)
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          description: cat.description,
          themeColor: cat.theme_color,
          registrationFee: parseFloat(cat.registration_fee),
          subCategories: buildTree(cat.id)
        }));
    };

    res.json(buildTree(null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Vendors
app.get('/api/vendors', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = `
      SELECT v.*, GROUP_CONCAT(vc.category_id) as categoryIds 
      FROM vendors v 
      LEFT JOIN vendor_categories vc ON v.id = vc.vendor_id
    `;
    
    let conditions = [];
    let params = [];

    // Filter only approved vendors for public API
    conditions.push("v.is_approved = TRUE");

    if (category) {
      conditions.push("vc.category_id = ?");
      params.push(category);
    }
    if (search) {
      conditions.push("(v.name LIKE ? OR v.description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " GROUP BY v.id";

    const [vendors] = await pool.query(sql, params);

    // Fetch products and format data
    for (let v of vendors) {
      const [products] = await pool.query("SELECT name, price, image_url FROM products WHERE vendor_id = ?", [v.id]);
      
      // Map product image_url to image
      v.products = products.map(p => ({
        name: p.name,
        price: parseFloat(p.price),
        image: p.image_url
      }));

      v.categoryIds = v.categoryIds ? v.categoryIds.split(',') : [];
      v.location = { lat: parseFloat(v.lat), lng: parseFloat(v.lng), address: v.address };
      v.maskedContact = v.masked_contact;
      v.isVerified = Boolean(v.is_verified);
      v.isApproved = Boolean(v.is_approved);
      v.imageUrl = v.image_url;
      v.promotionalBannerUrl = v.promotional_banner_url;
      v.supportsDelivery = Boolean(v.supports_delivery);
      v.priceStart = parseFloat(v.price_start);
      
      // Remove DB specific snake_case keys
      delete v.masked_contact;
      delete v.is_verified;
      delete v.is_approved;
      delete v.image_url;
      delete v.promotional_banner_url;
      delete v.supports_delivery;
      delete v.price_start;
      delete v.lat;
      delete v.lng;
    }

    res.json(vendors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Banners
app.get('/api/banners', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, image_url as imageUrl, link, alt_text as altText FROM banners");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create Order
app.post('/api/orders', async (req, res) => {
  try {
    const { vendorId, customerName, customerPhone, serviceRequested, date, address, amount } = req.body;
    const id = 'o' + Date.now();
    
    await pool.query(
      `INSERT INTO orders (id, vendor_id, customer_name, customer_phone, service_requested, date, status, address, amount)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [id, vendorId, customerName, customerPhone, serviceRequested, date, address, amount]
    );

    res.json({ success: true, orderId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Admin Routes (Categories)
app.post('/api/admin/categories', async (req, res) => {
    try {
        const { name, fee, parentId } = req.body;
        const id = name.toLowerCase().replace(/\s/g, '_');
        
        await pool.query(
            "INSERT INTO categories (id, name, registration_fee, parent_id) VALUES (?, ?, ?, ?)",
            [id, name, fee || 999, parentId || null]
        );
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/categories/:id', async (req, res) => {
    try {
        const { fee } = req.body;
        await pool.query("UPDATE categories SET registration_fee = ? WHERE id = ?", [fee, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/categories/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM categories WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Admin Routes (Vendors)
app.delete('/api/admin/vendors/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM vendors WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/vendors/:id/approve', async (req, res) => {
    try {
        await pool.query("UPDATE vendors SET is_approved = TRUE WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
