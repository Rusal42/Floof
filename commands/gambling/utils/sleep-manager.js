const fs = require('fs');
const path = require('path');

// File to store sleep data
const SLEEP_DATA_FILE = path.join(__dirname, '..', '..', '..', 'data', 'sleep-data.json');

// Load sleep data
function loadSleepData() {
    try {
        if (fs.existsSync(SLEEP_DATA_FILE)) {
            const data = fs.readFileSync(SLEEP_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading sleep data:', error);
    }
    return {};
}

// Save sleep data
function saveSleepData(data) {
    try {
        // Ensure data directory exists
        const dataDir = path.dirname(SLEEP_DATA_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(SLEEP_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving sleep data:', error);
    }
}

// Check if user is sleeping
function isSleeping(userId) {
    const sleepData = loadSleepData();
    const userSleep = sleepData[userId];
    
    if (!userSleep) return false;
    
    const now = Date.now();
    return now < userSleep.sleepUntil;
}

// Get remaining sleep time in milliseconds
function getSleepTimeRemaining(userId) {
    const sleepData = loadSleepData();
    const userSleep = sleepData[userId];
    
    if (!userSleep) return 0;
    
    const now = Date.now();
    const remaining = userSleep.sleepUntil - now;
    
    return Math.max(0, remaining);
}

// Put user to sleep for specified duration (in milliseconds)
function putUserToSleep(userId, durationMs) {
    const sleepData = loadSleepData();
    const sleepUntil = Date.now() + durationMs;
    
    sleepData[userId] = {
        sleepUntil: sleepUntil,
        startedAt: Date.now()
    };
    
    saveSleepData(sleepData);
    return sleepUntil;
}

// Wake user up (remove sleep effect)
function wakeUser(userId) {
    const sleepData = loadSleepData();
    
    if (sleepData[userId]) {
        delete sleepData[userId];
        saveSleepData(sleepData);
        return true;
    }
    
    return false;
}

// Clean up expired sleep effects
function cleanupExpiredSleep() {
    const sleepData = loadSleepData();
    const now = Date.now();
    let cleaned = false;
    
    for (const userId in sleepData) {
        if (now >= sleepData[userId].sleepUntil) {
            delete sleepData[userId];
            cleaned = true;
        }
    }
    
    if (cleaned) {
        saveSleepData(sleepData);
    }
}

// Get all sleeping users (for debugging/admin purposes)
function getAllSleepingUsers() {
    const sleepData = loadSleepData();
    const now = Date.now();
    const sleeping = {};
    
    for (const userId in sleepData) {
        if (now < sleepData[userId].sleepUntil) {
            sleeping[userId] = sleepData[userId];
        }
    }
    
    return sleeping;
}

// Clean up expired sleep effects every 5 minutes
setInterval(cleanupExpiredSleep, 5 * 60 * 1000);

module.exports = {
    isSleeping,
    getSleepTimeRemaining,
    putUserToSleep,
    wakeUser,
    cleanupExpiredSleep,
    getAllSleepingUsers
};
