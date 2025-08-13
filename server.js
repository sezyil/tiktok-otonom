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
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255),
        password VARCHAR(255),
        category VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        risk_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_queue (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        video_path VARCHAR(500),
        status VARCHAR(50) DEFAULT 'pending',
        account_id INTEGER REFERENCES accounts(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scheduled_for TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        task_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Initialize Puppeteer
let browser;
async function initializePuppeteer() {
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
      ],
      executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser'
    });
    console.log('Puppeteer initialized');
  } catch (error) {
    console.error('Puppeteer initialization error:', error);
  }
}

// TikTok Automation Functions
async function createTikTokAccount(accountData) {
  const { username, email, password, phone, proxy } = accountData;
  
  try {
    const page = await browser.newPage();
    
    // Set proxy if provided
    if (proxy) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password
      });
    }
    
    // Set user agent to mobile
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');
    
    // Go to TikTok signup page
    await page.goto('https://www.tiktok.com/signup', { waitUntil: 'networkidle2' });
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Click on "Sign up with email" option
    const emailOption = await page.$('[data-e2e="sign-up-email"]');
    if (emailOption) {
      await emailOption.click();
      await page.waitForTimeout(2000);
    }
    
    // Fill in email
    await page.type('input[placeholder*="email" i]', email);
    await page.waitForTimeout(1000);
    
    // Fill in password
    await page.type('input[type="password"]', password);
    await page.waitForTimeout(1000);
    
    // Fill in username
    const usernameInput = await page.$('input[placeholder*="username" i]');
    if (usernameInput) {
      await usernameInput.type(username);
      await page.waitForTimeout(1000);
    }
    
    // Click sign up button
    const signupButton = await page.$('button[type="submit"]');
    if (signupButton) {
      await signupButton.click();
      await page.waitForTimeout(5000);
    }
    
    // Check for verification requirements
    const verificationElement = await page.$('[data-e2e="verification-code"]');
    if (verificationElement) {
      console.log('Verification required for:', username);
      await page.close();
      return { success: false, message: 'Phone verification required', username };
    }
    
    // Check if account created successfully
    const successIndicator = await page.$('[data-e2e="profile-icon"]');
    if (successIndicator) {
      console.log('Account created successfully:', username);
      await page.close();
      return { success: true, username };
    }
    
    await page.close();
    return { success: false, message: 'Unknown error during signup' };
    
  } catch (error) {
    console.error('Error creating TikTok account:', error);
    return { success: false, message: error.message };
  }
}

async function loginTikTokAccount(accountData) {
  const { username, password, proxy } = accountData;
  
  try {
    const page = await browser.newPage();
    
    // Set proxy if provided
    if (proxy) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password
      });
    }
    
    // Set user agent to mobile
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');
    
    // Go to TikTok login page
    await page.goto('https://www.tiktok.com/login', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
    
    // Click on "Log in with email" option
    const emailOption = await page.$('[data-e2e="login-email"]');
    if (emailOption) {
      await emailOption.click();
      await page.waitForTimeout(2000);
    }
    
    // Fill in username/email
    await page.type('input[placeholder*="email" i]', username);
    await page.waitForTimeout(1000);
    
    // Fill in password
    await page.type('input[type="password"]', password);
    await page.waitForTimeout(1000);
    
    // Click login button
    const loginButton = await page.$('button[type="submit"]');
    if (loginButton) {
      await loginButton.click();
      await page.waitForTimeout(5000);
    }
    
    // Check if login successful
    const profileIcon = await page.$('[data-e2e="profile-icon"]');
    if (profileIcon) {
      console.log('Login successful for:', username);
      
      // Get account stats
      const stats = await getAccountStats(page);
      
      await page.close();
      return { success: true, username, stats };
    }
    
    await page.close();
    return { success: false, message: 'Login failed' };
    
  } catch (error) {
    console.error('Error logging into TikTok account:', error);
    return { success: false, message: error.message };
  }
}

async function getAccountStats(page) {
  try {
    // Go to profile page
    await page.goto('https://www.tiktok.com/@' + await getCurrentUsername(page), { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
    
    // Extract follower count
    const followerElement = await page.$('[data-e2e="follower-count"]');
    const followers = followerElement ? await followerElement.textContent() : '0';
    
    // Extract following count
    const followingElement = await page.$('[data-e2e="following-count"]');
    const following = followingElement ? await followingElement.textContent() : '0';
    
    // Extract like count
    const likeElement = await page.$('[data-e2e="like-count"]');
    const likes = likeElement ? await likeElement.textContent() : '0';
    
    return {
      followers: parseInt(followers.replace(/[^0-9]/g, '')) || 0,
      following: parseInt(following.replace(/[^0-9]/g, '')) || 0,
      likes: parseInt(likes.replace(/[^0-9]/g, '')) || 0
    };
  } catch (error) {
    console.error('Error getting account stats:', error);
    return { followers: 0, following: 0, likes: 0 };
  }
}

async function getCurrentUsername(page) {
  try {
    const usernameElement = await page.$('[data-e2e="profile-username"]');
    return usernameElement ? await usernameElement.textContent() : '';
  } catch (error) {
    return '';
  }
}

async function postVideo(accountData, videoData) {
  const { username, password } = accountData;
  const { videoPath, caption, hashtags } = videoData;
  
  try {
    const page = await browser.newPage();
    
    // Login first
    const loginResult = await loginTikTokAccount({ username, password });
    if (!loginResult.success) {
      await page.close();
      return { success: false, message: 'Login failed' };
    }
    
    // Go to upload page
    await page.goto('https://www.tiktok.com/upload', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
    
    // Upload video file
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(videoPath);
      await page.waitForTimeout(5000);
    }
    
    // Add caption
    if (caption) {
      const captionInput = await page.$('[data-e2e="video-caption"]');
      if (captionInput) {
        await captionInput.type(caption);
        await page.waitForTimeout(1000);
      }
    }
    
    // Add hashtags
    if (hashtags) {
      const hashtagInput = await page.$('[data-e2e="hashtag-input"]');
      if (hashtagInput) {
        await hashtagInput.type(hashtags);
        await page.waitForTimeout(1000);
      }
    }
    
    // Click post button
    const postButton = await page.$('[data-e2e="post-button"]');
    if (postButton) {
      await postButton.click();
      await page.waitForTimeout(10000);
    }
    
    await page.close();
    return { success: true, message: 'Video posted successfully' };
    
  } catch (error) {
    console.error('Error posting video:', error);
    return { success: false, message: error.message };
  }
}

async function performWarmup(accountData) {
  const { username, password } = accountData;
  
  try {
    const page = await browser.newPage();
    
    // Login first
    const loginResult = await loginTikTokAccount({ username, password });
    if (!loginResult.success) {
      await page.close();
      return { success: false, message: 'Login failed' };
    }
    
    // Go to For You page
    await page.goto('https://www.tiktok.com/foryou', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
    
    // Scroll and like some videos (simulate human behavior)
    for (let i = 0; i < 5; i++) {
      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(2000);
      
      // Like video (50% chance)
      if (Math.random() > 0.5) {
        const likeButton = await page.$('[data-e2e="like-icon"]');
        if (likeButton) {
          await likeButton.click();
          await page.waitForTimeout(1000);
        }
      }
      
      // Comment occasionally (20% chance)
      if (Math.random() > 0.8) {
        const commentButton = await page.$('[data-e2e="comment-icon"]');
        if (commentButton) {
          await commentButton.click();
          await page.waitForTimeout(1000);
          
          const commentInput = await page.$('[data-e2e="comment-input"]');
          if (commentInput) {
            const comments = ['Nice!', 'Great video!', 'Love this!', 'Amazing!', 'Keep it up!'];
            const randomComment = comments[Math.floor(Math.random() * comments.length)];
            await commentInput.type(randomComment);
            await page.waitForTimeout(1000);
            
            const postButton = await page.$('[data-e2e="post-comment"]');
            if (postButton) {
              await postButton.click();
              await page.waitForTimeout(2000);
            }
          }
        }
      }
    }
    
    await page.close();
    return { success: true, message: 'Warmup completed successfully' };
    
  } catch (error) {
    console.error('Error during warmup:', error);
    return { success: false, message: error.message };
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/dashboard.html');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: pool.totalCount > 0 ? 'connected' : 'disconnected'
  });
});

// Basic API Routes
app.get('/api/accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/content', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM content_queue ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/content/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM content_queue WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Enhanced API Routes
app.post('/api/accounts/create', async (req, res) => {
  try {
    const { username, email, password, phone, category, proxy } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Check if account already exists
    const existingAccount = await pool.query(
      'SELECT id FROM accounts WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingAccount.rows.length > 0) {
      return res.status(400).json({ error: 'Account already exists' });
    }
    
    // Create TikTok account
    const createResult = await createTikTokAccount({ username, email, password, phone, proxy });
    
    if (createResult.success) {
      // Save to database
      const result = await pool.query(
        'INSERT INTO accounts (username, email, password, category, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [username, email, password, category, 'active']
      );
      
      res.json({
        success: true,
        message: 'TikTok account created successfully',
        account: result.rows[0]
      });
    } else {
      res.status(400).json({
        success: false,
        message: createResult.message
      });
    }
    
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/accounts/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Get account from database
    const accountResult = await pool.query(
      'SELECT * FROM accounts WHERE username = $1 OR email = $1',
      [username]
    );
    
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const account = accountResult.rows[0];
    
    // Try to login to TikTok
    const loginResult = await loginTikTokAccount({ username: account.username, password: account.password });
    
    if (loginResult.success) {
      // Update last activity
      await pool.query(
        'UPDATE accounts SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
        [account.id]
      );
      
      res.json({
        success: true,
        message: 'Login successful',
        account: { ...account, stats: loginResult.stats }
      });
    } else {
      res.status(400).json({
        success: false,
        message: loginResult.message
      });
    }
    
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/content/post', async (req, res) => {
  try {
    const { account_id, video_path, caption, hashtags } = req.body;
    
    // Get account from database
    const accountResult = await pool.query('SELECT * FROM accounts WHERE id = $1', [account_id]);
    
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const account = accountResult.rows[0];
    
    // Post video to TikTok
    const postResult = await postVideo(account, { video_path, caption, hashtags });
    
    if (postResult.success) {
      // Update content status
      await pool.query(
        'UPDATE content_queue SET status = $1 WHERE account_id = $2 AND status = $3',
        ['posted', account_id, 'pending']
      );
      
      res.json({
        success: true,
        message: 'Video posted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: postResult.message
      });
    }
    
  } catch (error) {
    console.error('Error posting video:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/automation/warmup', async (req, res) => {
  try {
    const { account_id } = req.body;
    
    // Get account from database
    const accountResult = await pool.query('SELECT * FROM accounts WHERE id = $1', [account_id]);
    
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const account = accountResult.rows[0];
    
    // Create task
    const taskResult = await pool.query(
      'INSERT INTO tasks (account_id, task_type, status) VALUES ($1, $2, $3) RETURNING *',
      [account_id, 'warmup', 'pending']
    );
    
    // Perform warmup
    const warmupResult = await performWarmup(account);
    
    if (warmupResult.success) {
      // Update task status
      await pool.query(
        'UPDATE tasks SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', taskResult.rows[0].id]
      );
      
      res.json({
        success: true,
        message: 'Warmup completed successfully',
        task: taskResult.rows[0]
      });
    } else {
      // Update task status
      await pool.query(
        'UPDATE tasks SET status = $1 WHERE id = $2',
        ['failed', taskResult.rows[0].id]
      );
      
      res.status(400).json({
        success: false,
        message: warmupResult.message
      });
    }
    
  } catch (error) {
    console.error('Error during warmup:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    await initializeDatabase();
    await initializePuppeteer();
    
    app.listen(PORT, () => {
      console.log(`🚀 TikTok Orchestrator running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 API docs: http://localhost:${PORT}/`);
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
