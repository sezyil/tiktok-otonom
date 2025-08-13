const express = require('express');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database initialization
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        proxy_ip VARCHAR(50),
        proxy_port INTEGER,
        proxy_username VARCHAR(255),
        proxy_password VARCHAR(255),
        status VARCHAR(50) DEFAULT 'inactive',
        risk_score INTEGER DEFAULT 0,
        followers INTEGER DEFAULT 0,
        following INTEGER DEFAULT 0,
        total_likes INTEGER DEFAULT 0,
        total_views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_queue (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        video_url VARCHAR(500),
        caption TEXT,
        hashtags TEXT,
        scheduled_time TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        task_type VARCHAR(50),
        task_data JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Puppeteer Browser Manager
let browser = null;

async function initBrowser() {
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    console.log('Browser initialized successfully');
  } catch (error) {
    console.error('Browser initialization error:', error);
  }
}

// TikTok Automation Functions
async function tiktokLogin(page, email, password, proxyConfig = null) {
  try {
    if (proxyConfig) {
      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password
      });
    }

    await page.goto('https://www.tiktok.com/login', { waitUntil: 'networkidle2' });
    
    // Wait for login form and fill credentials
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', password);
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    return true;
  } catch (error) {
    console.error('TikTok login error:', error);
    return false;
  }
}

async function warmUpAccount(page) {
  try {
    // Scroll and like random videos for 15-20 minutes
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(Math.random() * 3000 + 2000);
      
      // Random like (30% chance)
      if (Math.random() > 0.7) {
        try {
          await page.click('[data-e2e="like-icon"]');
          await page.waitForTimeout(1000);
        } catch (e) {
          // Like button not found, continue
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Warm up error:', error);
    return false;
  }
}

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'TikTok Orchestrator API',
    version: '1.0.0',
    status: 'running'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: pool.totalCount > 0 ? 'connected' : 'disconnected'
  });
});

// Accounts API
app.get('/api/accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const { email, password, username, proxy_ip, proxy_port, proxy_username, proxy_password } = req.body;
    
    const result = await pool.query(
      'INSERT INTO accounts (email, password, username, proxy_ip, proxy_port, proxy_username, proxy_password) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [email, password, username, proxy_ip, proxy_port, proxy_username, proxy_password]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Content Queue API
app.get('/api/content', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cq.*, a.username 
      FROM content_queue cq 
      JOIN accounts a ON cq.account_id = a.id 
      ORDER BY cq.scheduled_time ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/content', async (req, res) => {
  try {
    const { account_id, video_url, caption, hashtags, scheduled_time } = req.body;
    
    const result = await pool.query(
      'INSERT INTO content_queue (account_id, video_url, caption, hashtags, scheduled_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [account_id, video_url, caption, hashtags, scheduled_time]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Tasks API
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, a.username 
      FROM tasks t 
      JOIN accounts a ON t.account_id = a.id 
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Automation endpoints
app.post('/api/automation/warm-up/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Get account details
    const accountResult = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const account = accountResult.rows[0];
    
    // Create task
    await pool.query(
      'INSERT INTO tasks (account_id, task_type, task_data) VALUES ($1, $2, $3)',
      [accountId, 'warm_up', { duration: '20_minutes' }]
    );
    
    res.json({ message: 'Warm-up task created', accountId });
  } catch (error) {
    console.error('Error creating warm-up task:', error);
    res.status(500).json({ error: 'Task creation error' });
  }
});

// Cron jobs for automation
cron.schedule('*/30 * * * *', async () => {
  console.log('Running scheduled tasks...');
  
  try {
    // Get pending tasks
    const result = await pool.query(`
      SELECT t.*, a.* 
      FROM tasks t 
      JOIN accounts a ON t.account_id = a.id 
      WHERE t.status = 'pending' 
      ORDER BY t.created_at ASC 
      LIMIT 5
    `);
    
    for (const task of result.rows) {
      console.log(`Processing task ${task.id} for account ${task.username}`);
      
      // Update task status
      await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', ['processing', task.id]);
      
      // Process task based on type
      if (task.task_type === 'warm_up') {
        // Implement warm-up logic here
        console.log(`Warming up account ${task.username}`);
      }
      
      // Mark task as completed
      await pool.query(
        'UPDATE tasks SET status = $1, completed_at = $2 WHERE id = $3',
        ['completed', new Date(), task.id]
      );
    }
  } catch (error) {
    console.error('Scheduled task error:', error);
  }
});

// Initialize and start server
async function startServer() {
  try {
    await initDatabase();
    await initBrowser();
    
    app.listen(port, () => {
      console.log(`🚀 TikTok Orchestrator running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`📋 API docs: http://localhost:${port}/`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  await pool.end();
  process.exit(0);
});

startServer();
