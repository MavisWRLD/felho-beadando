/**
 * Pizzázó rendelési rendszer - Node.js/Express Backend
 * AWS RDS MySQL + S3 integrációval
 */

const express = require('express');
const https = require('https');  // Add HTTPS module
const fs = require('fs');        // Add FS module for reading certificates
const cors = require('cors');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 443; // Use 443 for HTTPS

const options = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || './ssl/privatekey.pem'),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || './ssl/certificate.pem')
};

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// AWS S3 Konfiguráció
// ============================================
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'eu-west-1'
});

const S3_BUCKET = process.env.S3_BUCKET;

// ============================================
// MySQL Connection Pool
// ============================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ============================================
// SQL Schema Initialize
// ============================================
async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    // Pizzák táblázat
    await connection.query(`
  CREATE TABLE IF NOT EXISTS pizzas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
;

    // Rendelések táblázat
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        customer_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        address TEXT NOT NULL,
        notes TEXT,
        total_price DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled') DEFAULT 'pending',
        payment_method ENUM('cash', 'card', 'transfer') DEFAULT 'cash',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Rendelési tételek táblázat
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        pizza_id INT NOT NULL,
        pizza_name VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        price_per_unit DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (pizza_id) REFERENCES pizzas(id)
      )
    `);

    console.log('✓ Adatbázis táblákat inicializálva');
  } catch (error) {
    console.error('Adatbázis inicializálási hiba:', error);
  } finally {
    connection.release();
  }
}

// ============================================
// Pizzák inicializálása
// ============================================
async function seedPizzas() {
  const connection = await pool.getConnection();
  try {
    const pizzas = [
      { name: 'Margherita', description: 'Paradicsomszósz, mozzarella, bazsalikom', price: 1200, image: '1. Margherita.png' },
      { name: 'Quattro Formaggi', description: 'Négy fajta sajt', price: 1500, image: '2. Quattro Formaggi.png' },
      { name: 'Pepperoni', description: 'Paradicsomszósz, mozzarella, pepperoni', price: 1300, image: '3. Pepperoni.png' },
      { name: 'Carnivore', description: 'Szalonna, sonka, kolbász, hagyma', price: 1600, image: '4. Carnivore.png' },
      { name: 'Vegetariana', description: 'Paradicsom, paprika, gomba, zöldségek', price: 1250, image: '5. Vegetariana.png' },
      { name: 'Prosciutto e Rucola', description: 'Prosciutto, rukkola, parmezan', price: 1450, image: '6. Prosciutto e Rucola.png' },
      { name: 'BBQ Chicken', description: 'BBQ szósz, csirke, lilahagyma, bacon', price: 1400, image: '7. BBQ Chicken.png' },
      { name: 'Quattro Stagioni', description: 'Négy évszak: szalonna, gomba, tojás, olajbogyó', price: 1550, image: '8. Quattro Stagioni.png' },
      { name: 'Calzone', description: 'Zárható: ricotta, sonka, mozzarella', price: 1350, image: '9. Calzone.png' },
      { name: 'Spicy Diavola', description: 'Csípős: pepperoni, chilipaprika, garlic', price: 1300, image: '10. Spicy Diavola.png' },
      { name: 'Seafood Deluxe', description: 'Garnéla, kagyló, tintahal, olívaolaj', price: 1800, image: '11. Seafood Deluxe.png' },
      { name: 'Mushroom Paradise', description: 'Kiváló gombák', price: 1280, image: '12. Mushroom Paradise.png' },
      { name: 'Hawaiian Surprise', description: 'Sonka, ananász, szalonna', price: 1400, image: '13. Hawaiian Surprise.png' },
      { name: 'Truffle Deluxe', description: 'Fehér szarvasgomba, prosciutto, parmezan', price: 2000, image: '14. Truffle Deluxe.png' },
      { name: 'Bianca', description: 'Fehér szósz, mozzarella, ricotta, spinát', price: 1150, image: '15. Bianca.png' }
    ];

    // Ellenőrzés: vannak-e már pizzák


    const [rows] = await connection.query('SELECT COUNT(*) as count FROM pizzas');
    if (rows[0].count === 0) {
      for (const pizza of pizzas) {
        await connection.query(
          'INSERT INTO pizzas (name, description, price, image_filename) VALUES (?, ?, ?, ?)',
          [pizza.name, pizza.description, pizza.price, pizza.image]
        );
      }
      console.log('✓ Pizzák feltöltve képfájl nevekkel');
    }
  } catch (error) {
    console.error('Pizza seed hiba:', error);
  } finally {
    connection.release();
  }
}


// ============================================
// EMAIL Konfiguráció (Nodemailer)
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ============================================
// API ROUTES
// ============================================

// GET: Pizzák listája
app.get('/api/pizzas', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [pizzas] = await connection.query('SELECT * FROM pizzas');
    connection.release();
    res.json(pizzas);
  } catch (error) {
    console.error('Pizza lista hiba:', error);
    res.status(500).json({ error: 'Adatbázis hiba' });
  }
});

// GET: Presigned URL lekérése S3-ból pizza képekhez
app.get('/api/get-image-url', async (req, res) => {
  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename paraméter kötelező' });
    }

    const params = {
      Bucket: S3_BUCKET,
      Key: `pizzas/${filename}`,
      Expires: 3600 // 1 óra lejárat
    };

    // Presigned URL generálása AWS SDK v2-vel
    const url = s3.getSignedUrl('getObject', params);
    
    res.json({ url: url });
  } catch (error) {
    console.error('Presigned URL generálás hiba:', error);
    res.status(500).json({ error: 'Nem sikerült az URL generálása', details: error.message });
  }
});

// GET: Rendelés adatok (admin)
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const connection = await pool.getConnection();
    
    const [order] = await connection.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );
    
    const [items] = await connection.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );
    
    connection.release();
    
    if (order.length === 0) {
      return res.status(404).json({ error: 'Rendelés nem található' });
    }
    
    res.json({ ...order[0], items });
  } catch (error) {
    console.error('Rendelés lekérés hiba:', error);
    res.status(500).json({ error: 'Adatbázis hiba' });
  }
});

// POST: Új rendelés
app.post('/api/orders', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const {
      customer_name,
      email,
      phone,
      address,
      notes,
      items,
      total
    } = req.body;

    // Validálás
    if (!customer_name || !email || !phone || !address || !items || items.length === 0) {
      return res.status(400).json({ error: 'Hiányzó adatok' });
    }

    // Tranzakció kezdése
    await connection.beginTransaction();

    try {
      // Rendelés beszúrása
      const [orderResult] = await connection.query(
        `INSERT INTO orders (customer_name, email, phone, address, notes, total_price, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, 'cash', 'pending')`,
        [customer_name, email, phone, address, notes || null, total]
      );

      const orderId = orderResult.insertId;

      // Rendelési tételek beszúrása
      for (const item of items) {
        await connection.query(
          `INSERT INTO order_items (order_id, pizza_id, pizza_name, quantity, price_per_unit, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.pizza_id,
            item.pizza_name,
            item.quantity,
            item.price,
            item.quantity * item.price
          ]
        );
      }

      // Tranzakció véglegesítése
      await connection.commit();

      // EMAIL küldése (opcionális)
      try {
        await sendOrderConfirmationEmail(email, customer_name, orderId, items, total);
      } catch (emailError) {
        console.warn('Email küldési hiba (de rendelés OK):', emailError.message);
      }

      res.json({
        success: true,
        orderId,
        message: `Rendelés #${orderId} sikeresen rögzítve. Utánvéttel 30-45 perc alatt érkezik.`
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Rendelés beszúrás hiba:', error);
    res.status(500).json({ error: 'Rendelés rögzítési hiba', details: error.message });
  } finally {
    connection.release();
  }
});

// S3 Képfeltöltés (admin panel később)
app.post('/api/upload', async (req, res) => {
  try {
    const { filename, fileBuffer, filetype } = req.body;

    const params = {
      Bucket: S3_BUCKET,
      Key: `pizzas/${Date.now()}_${filename}`,
      Body: Buffer.from(fileBuffer),
      ContentType: filetype,
      ACL: 'private'
    };

    const data = await s3.upload(params).promise();
    
    res.json({
      success: true,
      url: data.Location,
      key: data.Key
    });
  } catch (error) {
    console.error('S3 feltöltés hiba:', error);
    res.status(500).json({ error: 'Feltöltési hiba' });
  }
});

// ============================================
// Helper: Email küldés
// ============================================
async function sendOrderConfirmationEmail(email, customerName, orderId, items, total) {
  const itemsList = items
    .map(item => `${item.pizza_name} x${item.quantity} - ${item.quantity * item.price} Ft`)
    .join('<br>');

  const html = `
    <h2>Rendelés megerősítés</h2>
    <p>Kedves ${customerName}!</p>
    <p>Rendelésed sikeresen rögzítve lett.</p>
    <h3>Rendelés #${orderId}</h3>
    <p><strong>Tételek:</strong><br>${itemsList}</p>
    <p><strong>Összesen: ${total} Ft</strong></p>
    <p>Szállítás: Utánvét (30-45 perc)</p>
    <p>Köszönjük az ételed rendelést!</p>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Rendelés megerősítés #${orderId}`,
    html
  });
}

// ============================================
// Szerver indítása
// ============================================
https.createServer(options, app).listen(PORT, async () => {
  console.log(`🍕 Pizzázó HTTPS szerver indult: https://localhost:${PORT}`);
  
  // Adatbázis inicializálása
  await initializeDatabase();
  await seedPizzas();
});
