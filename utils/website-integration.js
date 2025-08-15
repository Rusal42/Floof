const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Website API configuration
const WEBSITE_API_URL = process.env.WEBSITE_API_URL || 'http://localhost:3000/api/stats';
const BOT_API_TOKEN = process.env.BOT_API_TOKEN;

// Stats tracking storage
const statsPath = path.join(__dirname, '..', 'data', 'bot-stats.json');

// Initialize stats file if it doesn't exist
function initializeStats() {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(statsPath)) {
        const initialStats = {
            commandsUsed: 0,
            startTime: Date.now(),
            totalUptime: 0,
            disconnections: 0,
            lastUpdate: Date.now()
        };
        fs.writeFileSync(statsPath, JSON.stringify(initialStats, null, 2));
    }
}

// Load stats from file
function loadStats() {
    try {
        if (fs.existsSync(statsPath)) {
            return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
    return {
        commandsUsed: 0,
        startTime: Date.now(),
        totalUptime: 0,
        disconnections: 0,
        lastUpdate: Date.now()
    };
}

// Save stats to file
function saveStats(stats) {
    try {
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Error saving stats:', error);
    }
}

// Increment command usage counter
function incrementCommandUsage() {
    const stats = loadStats();
    stats.commandsUsed++;
    stats.lastUpdate = Date.now();
    saveStats(stats);
}

// Calculate uptime percentage
function calculateUptimePercentage() {
    const stats = loadStats();
    const currentTime = Date.now();
    const totalTimeRunning = currentTime - stats.startTime;
    const actualUptime = totalTimeRunning - (stats.disconnections * 60000); // Assume 1 min per disconnection
    return Math.max(0, Math.min(100, (actualUptime / totalTimeRunning) * 100));
}

// Record a disconnection
function recordDisconnection() {
    const stats = loadStats();
    stats.disconnections++;
    saveStats(stats);
}

// Get command usage count
function getCommandUsageCount() {
    const stats = loadStats();
    return stats.commandsUsed;
}

// Main function to update website stats
async function updateWebsiteStats(client) {
    try {
        // Calculate real bot statistics
        const serverCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const commandsUsed = getCommandUsageCount();
        const uptime = calculateUptimePercentage();
        const ping = client.ws.ping;

        console.log(`📊 Updating website stats: ${serverCount} servers, ${userCount} users, ${commandsUsed} commands used`);

        // Only send if we have a valid API token and URL
        if (!BOT_API_TOKEN) {
            console.log('⚠️ BOT_API_TOKEN not configured, skipping website update');
            return;
        }

        // Send stats to website
        const response = await fetch(WEBSITE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bot-token': BOT_API_TOKEN
            },
            body: JSON.stringify({
                serverCount,
                userCount,
                commandsUsed,
                uptime,
                ping,
                timestamp: Date.now()
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Website stats updated successfully');
        } else {
            console.error('❌ Failed to update website stats:', result.error);
        }
    } catch (error) {
        console.error('❌ Error updating website stats:', error.message);
    }
}

// Start the stats updater with configurable interval
function startStatsUpdater(client, intervalMinutes = 5) {
    console.log(`🌐 Starting website stats updater (every ${intervalMinutes} minutes)`);
    
    // Initialize stats tracking
    initializeStats();
    
    // Update immediately when bot starts
    setTimeout(() => {
        updateWebsiteStats(client);
    }, 5000); // Wait 5 seconds for bot to fully initialize
    
    // Then update at regular intervals
    const interval = setInterval(() => {
        updateWebsiteStats(client);
    }, intervalMinutes * 60 * 1000);
    
    return interval;
}

// Enhanced stats for changelog updates
async function sendChangelogUpdate(client, changelogData) {
    try {
        if (!BOT_API_TOKEN) {
            console.log('⚠️ BOT_API_TOKEN not configured, skipping changelog update');
            return;
        }

        const response = await fetch(WEBSITE_API_URL.replace('/stats', '/changelog'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bot-token': BOT_API_TOKEN
            },
            body: JSON.stringify({
                ...changelogData,
                timestamp: Date.now(),
                serverCount: client.guilds.cache.size,
                userCount: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Changelog update sent to website');
        } else {
            console.error('❌ Failed to send changelog update:', result.error);
        }
    } catch (error) {
        console.error('❌ Error sending changelog update:', error.message);
    }
}

module.exports = {
    updateWebsiteStats,
    startStatsUpdater,
    incrementCommandUsage,
    calculateUptimePercentage,
    recordDisconnection,
    getCommandUsageCount,
    sendChangelogUpdate,
    initializeStats
};
