// Bot Startup Script - Manages both Python server and Discord bot
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment from repo root .env so we can use DISCORD_BOT_TOKEN
try {
  const dotenvPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(dotenvPath)) {
    require('dotenv').config({ path: dotenvPath });
  }
} catch {}

class BotManager {
  constructor() {
    this.pythonProcess = null;
    this.discordProcess = null;
    this.shutdownInProgress = false;
  }

  async startPythonServer() {
    console.log('🐍 Starting Python AI server...');

    const pythonScript = path.join(__dirname, '..', 'py-floof-ai', 'server.py');
    // Prefer project venv if available
    const venvPython = process.platform === 'win32'
      ? path.join(__dirname, '..', 'py-floof-ai', '.venv', 'Scripts', 'python.exe')
      : path.join(__dirname, '..', 'py-floof-ai', '.venv', 'bin', 'python');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';

    this.pythonProcess = spawn(pythonCmd, [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.pythonProcess.stdout.on('data', (data) => {
      process.stdout.write(`🐍 ${data.toString()}`);
    });

    this.pythonProcess.stderr.on('data', (data) => {
      process.stderr.write(`🐍 ERROR: ${data.toString()}`);
    });

    this.pythonProcess.on('close', (code) => {
      console.log(`🐍 Python server exited with code ${code}`);
      if (!this.shutdownInProgress) {
        console.log('🔄 Attempting to restart Python server...');
        setTimeout(() => this.startPythonServer(), 5000);
      }
    });

    // Wait for server to be ready
    await this.waitForPythonServer();
  }

  async waitForPythonServer(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch('http://127.0.0.1:8000/health', { method: 'GET' });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          console.log('✅ Python AI server is ready!');
          if (data && data.model) console.log(`🤖 Using model: ${data.model}`);
          return true;
        }
      } catch (error) {
        console.log(`⏳ Waiting for Python server... (${i + 1}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    console.warn('⚠️  Python server not responding, Discord bot will use JavaScript fallback');
    return false;
  }

  startDiscordBot() {
    console.log('🤖 Starting Discord bot...');

    // We integrated the AI bridge into index.js, so start that
    const botScript = path.join(__dirname, '..', 'index.js');
    this.discordProcess = spawn('node', [botScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.discordProcess.stdout.on('data', (data) => {
      process.stdout.write(`🤖 ${data.toString()}`);
    });

    this.discordProcess.stderr.on('data', (data) => {
      process.stderr.write(`🤖 ERROR: ${data.toString()}`);
    });

    this.discordProcess.on('close', (code) => {
      console.log(`🤖 Discord bot exited with code ${code}`);
      if (!this.shutdownInProgress) {
        console.log('🔄 Attempting to restart Discord bot...');
        setTimeout(() => this.startDiscordBot(), 3000);
      }
    });
  }

  async start() {
    console.log('🚀 Starting Floof AI Bot System...');
    console.log('================================');

    // Validate environment
    // Map DISCORD_BOT_TOKEN -> DISCORD_TOKEN for compatibility
    if (!process.env.DISCORD_TOKEN && process.env.DISCORD_BOT_TOKEN) {
      process.env.DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
    }
    if (!process.env.DISCORD_TOKEN) {
      console.error('❌ DISCORD_TOKEN (or DISCORD_BOT_TOKEN) is required');
      process.exit(1);
    }

    if (!process.env.OWNER_ID) {
      console.warn('⚠️  OWNER_ID not set - bot may not work properly in DMs');
    }

    // Start Python server first (best-effort)
    try {
      await this.startPythonServer();
    } catch (error) {
      console.warn('⚠️  Could not start Python server, continuing with JavaScript fallback');
    }

    // Start Discord bot
    this.startDiscordBot();

    // Setup graceful shutdown
    this.setupShutdownHandlers();

    console.log('✅ Bot system startup complete!');
    console.log('💬 Floof is now online and ready to chat!');
  }

  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      if (this.shutdownInProgress) return;

      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      this.shutdownInProgress = true;

      if (this.discordProcess) {
        console.log('🤖 Stopping Discord bot...');
        this.discordProcess.kill('SIGTERM');
      }

      if (this.pythonProcess) {
        console.log('🐍 Stopping Python server...');
        this.pythonProcess.kill('SIGTERM');
      }

      setTimeout(() => {
        console.log('👋 Goodbye!');
        process.exit(0);
      }, 3000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Windows console handling
    if (process.platform === 'win32') {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.on('SIGINT', () => shutdown('SIGINT'));
    }
  }

  async healthCheck() {
    const results = {
      python: false,
      discord: false,
      timestamp: new Date().toISOString(),
    };

    // Check Python server
    try {
      const res = await fetch('http://127.0.0.1:8000/health', { method: 'GET' });
      results.python = res.ok;
    } catch (error) {
      results.python = false;
    }

    // Check Discord bot (simplified - just check if process is running)
    results.discord = !!(this.discordProcess && !this.discordProcess.killed);

    return results;
  }
}

// CLI interface
if (require.main === module) {
  const manager = new BotManager();
  const command = process.argv[2];

  switch (command) {
    case 'health':
      manager.healthCheck().then((results) => {
        console.log('🏥 Health Check Results:');
        console.log(`Python Server: ${results.python ? '✅ Online' : '❌ Offline'}`);
        console.log(`Discord Bot: ${results.discord ? '✅ Running' : '❌ Not Running'}`);
        console.log(`Timestamp: ${results.timestamp}`);
        process.exit(results.python && results.discord ? 0 : 1);
      });
      break;
    case 'start':
    default:
      manager.start().catch((error) => {
        console.error('💥 Failed to start bot system:', error);
        process.exit(1);
      });
      break;
  }
}

module.exports = { BotManager };
