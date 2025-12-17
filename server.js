
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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
  host: process.env.DB_HOST || 'my-dahanu-jigneshkadu-7964.j.aivencloud.com',
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD || 'AVNS_PS_nZ0bc8sFwx0Dyxq8', 
  database: process.env.DB_NAME || 'dahanu_db',
  port: process.env.DB_PORT || 18109, // Added support for custom port (Required for Aiven)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

// Initialize Database
const initDb = async () => {
  try {
    // 1. Create Pool directly (Aiven DBs usually exist already, so we skip the CREATE DATABASE step to avoid permission errors)
    pool = mysql.createPool(dbConfig);

    // Test connection
    const connection = await pool.getConnection();
    console.log(`Connected to MySQL Database: ${dbConfig.database} on port ${dbConfig.port}`);
    connection.release();

    // 2. Create Tables
    
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

    // Vendor Categories
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
    await seedData();
    
    // Create Admin
    const [adminRows] = await pool.query("SELECT * FROM users WHERE role = 'ADMIN'");
    if (adminRows.length === 0) {
       await pool.query(
         "INSERT INTO users (id, name, email, password, phone, role) VALUES (?, ?, ?, ?, ?, ?)",
         ['u_admin', 'System Admin', 'admin@dahanu.com', 'admin123', '9876543210', 'ADMIN']
       );
    }

  } catch (err) {
    console.error("DB Init Error:", err);
  }
};

const seedData = async () => {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM categories");
    if (rows[0].count > 0) return;

    console.log("Seeding Database...");
    
    // Categories
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
    
    // Sub-Categories
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
    console.log("Seeding Complete.");
  } catch (err) {
    console.error("Seeding Error:", err);
  }
};

initDb();

// --- API ROUTES ---

app.get('/', (req, res) => res.send('Dahanu Backend Running'));

// 1. Get Categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories');
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
    let conditions = ["v.is_approved = TRUE"];
    let params = [];

    if (category) {
      conditions.push("vc.category_id = ?");
      params.push(category);
    }
    if (search) {
      conditions.push("(v.name LIKE ? OR v.description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " GROUP BY v.id";

    const [vendors] = await pool.query(sql, params);

    for (let v of vendors) {
      const [products] = await pool.query("SELECT name, price, image_url FROM products WHERE vendor_id = ?", [v.id]);
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
      
      delete v.masked_contact; delete v.is_verified; delete v.is_approved; 
      delete v.image_url; delete v.promotional_banner_url; delete v.supports_delivery; 
      delete v.price_start; delete v.lat; delete v.lng;
    }

    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Register Vendor (POST)
app.post('/api/vendors', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id, name, description, rating, location, contact, maskedContact, isVerified, isApproved, imageUrl, supportsDelivery, priceStart, categoryIds, products } = req.body;
        
        // Insert Vendor
        await connection.query(
            `INSERT INTO vendors (id, name, description, rating, lat, lng, address, contact, masked_contact, is_verified, is_approved, image_url, supports_delivery, price_start)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, description, rating || 4.0, location.lat, location.lng, location.address, contact, maskedContact, isVerified || false, isApproved || false, imageUrl, supportsDelivery || false, priceStart || 0]
        );

        // Insert Categories
        if (categoryIds && categoryIds.length > 0) {
            for (const catId of categoryIds) {
                await connection.query('INSERT INTO vendor_categories (vendor_id, category_id) VALUES (?, ?)', [id, catId]);
            }
        }

        // Insert Products
        if (products && products.length > 0) {
            for (const p of products) {
                await connection.query('INSERT INTO products (vendor_id, name, price, image_url) VALUES (?, ?, ?, ?)', [id, p.name, p.price, p.image || null]);
            }
        }

        await connection.commit();
        res.json({ success: true, message: "Vendor registered successfully" });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// 4. Get Banners
app.get('/api/banners', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, image_url as imageUrl, link, alt_text as altText FROM banners");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create Order
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
    res.status(500).json({ error: err.message });
  }
});

// Admin & Auth routes omitted for brevity (Keep existing logic if needed)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
