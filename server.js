const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.tailwindcss.com',
          'https://cdnjs.cloudflare.com',
          'https://unpkg.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.tailwindcss.com',
          'https://cdnjs.cloudflare.com',
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", 'https:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Form submission rate limiting (more restrictive)
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 form submissions per 15 minutes
  message: 'Too many form submissions, please try again later.'
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('.'));

// Database setup
const db = new sqlite3.Database('./inquiries.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    // Create inquiries table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      service TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    )`);
  }
});

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to your preferred email service
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// API Routes

// Submit contact form
app.post('/api/contact', formLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, service, message } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Validate required fields
    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please fill in all required fields.' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid email address.' 
      });
    }

    // Insert into database
    const stmt = db.prepare(`INSERT INTO inquiries 
      (firstName, lastName, email, phone, service, message, ip_address) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    
    stmt.run([firstName, lastName, email, phone, service, message, ipAddress], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to save inquiry. Please try again.' 
        });
      }

      const inquiryId = this.lastID;

      // Send email notification to admin
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@mikhongeloprojects.com',
        to: process.env.ADMIN_EMAIL || 'admin@mikhongeloprojects.com',
        subject: `New Inquiry from ${firstName} ${lastName} - Mikhongelo Projects`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Inquiry ID:</strong> #${inquiryId}</p>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Service:</strong> ${service || 'Not specified'}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>IP Address:</strong> ${ipAddress}</p>
          <hr>
          <p><em>This is an automated message from Mikhongelo Projects website.</em></p>
        `
      };

      // Send confirmation email to customer
      const customerMailOptions = {
        from: process.env.EMAIL_USER || 'noreply@mikhongeloprojects.com',
        to: email,
        subject: 'Thank you for contacting Mikhongelo Projects',
        html: `
          <h2>Thank you for your inquiry!</h2>
          <p>Dear ${firstName},</p>
          <p>We have received your message and will get back to you within 24 hours.</p>
          <p><strong>Your inquiry details:</strong></p>
          <p><strong>Service:</strong> ${service || 'General inquiry'}</p>
          <p><strong>Message:</strong> ${message}</p>
          <p>For urgent matters, please call us directly at <strong>+27 82 123 4567</strong>.</p>
          <br>
          <p>Best regards,<br>Mikhongelo Projects Team</p>
          <hr>
          <p><em>This is an automated confirmation email.</em></p>
        `
      };

      // Send both emails
      Promise.all([
        transporter.sendMail(mailOptions),
        transporter.sendMail(customerMailOptions)
      ]).then(() => {
        res.json({ 
          success: true, 
          message: 'Thank you! Your message has been sent successfully. We will contact you soon.',
          inquiryId: inquiryId
        });
      }).catch((emailError) => {
        console.error('Email error:', emailError);
        // Still return success since the inquiry was saved
        res.json({ 
          success: true, 
          message: 'Your inquiry has been saved. We will contact you soon.',
          inquiryId: inquiryId,
          note: 'Email notification may be delayed.'
        });
      });
    });

    stmt.finalize();

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
});

// Get all inquiries (admin endpoint)
app.get('/api/admin/inquiries', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const status = req.query.status || 'all';

  let query = 'SELECT * FROM inquiries';
  let countQuery = 'SELECT COUNT(*) as total FROM inquiries';
  let params = [];

  if (status !== 'all') {
    query += ' WHERE status = ?';
    countQuery += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  // Get total count
  db.get(countQuery, status !== 'all' ? [status] : [], (err, countResult) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Get inquiries
    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({
        success: true,
        inquiries: rows,
        pagination: {
          page: page,
          limit: limit,
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// Update inquiry status
app.put('/api/admin/inquiries/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['new', 'in-progress', 'resolved', 'closed'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  db.run('UPDATE inquiries SET status = ? WHERE id = ?', [status, id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    res.json({ success: true, message: 'Status updated successfully' });
  });
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});