// Bot Startup Script - Starts the Discord bot only (Python/AI removed)
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
    this.discordProcess = null;
    this.shutdownInProgress = false;
  }

  startDiscordBot() {
    console.log('🤖 Starting Discord bot...');

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
    console.log('🚀 Starting Floof Bot...');
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
      console.warn('⚠️  OWNER_ID not set - some owner features may be limited');
    }

    // Start Discord bot
    this.startDiscordBot();

    // Setup graceful shutdown
    this.setupShutdownHandlers();

    console.log('✅ Bot startup complete!');
    console.log('💬 Floof is now online!');
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
      discord: false,
      timestamp: new Date().toISOString(),
    };

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
        console.log(`Discord Bot: ${results.discord ? '✅ Running' : '❌ Not Running'}`);
        console.log(`Timestamp: ${results.timestamp}`);
        process.exit(results.discord ? 0 : 1);
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
