const fs = require('fs');
const path = require('path');

const balancesDir = path.resolve(__dirname, '../../../data');
const BALANCES_FILE = path.join(balancesDir, 'balances.json');
const STARTING_BALANCE = 1000;

let userBalances = {};

function loadBalances() {
    try {
        if (!fs.existsSync(balancesDir)) {
            fs.mkdirSync(balancesDir, { recursive: true });
        }
        if (fs.existsSync(BALANCES_FILE)) {
            const data = fs.readFileSync(BALANCES_FILE, 'utf8');
            userBalances = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading balances.json:', err);
        userBalances = {};
    }
    return userBalances;
}

function saveBalances() {
    try {
        fs.writeFileSync(BALANCES_FILE, JSON.stringify(userBalances, null, 2));
    } catch (err) {
        console.error('Error saving balances.json:', err);
    }
}

function getBalance(userId) {
    if (!userBalances[userId]) {
        userBalances[userId] = STARTING_BALANCE;
        saveBalances();
    }
    return userBalances[userId];
}

function setBalance(userId, amount) {
    userBalances[userId] = Math.max(0, amount);
    saveBalances();
    return userBalances[userId];
}

function addBalance(userId, amount) {
    const currentBalance = getBalance(userId);
    return setBalance(userId, currentBalance + amount);
}

function subtractBalance(userId, amount) {
    const currentBalance = getBalance(userId);
    return setBalance(userId, currentBalance - amount);
}

function hasBalance(userId, amount) {
    return getBalance(userId) >= amount;
}

// Load balances on startup
loadBalances();

module.exports = {
    getBalance,
    setBalance,
    addBalance,
    subtractBalance,
    hasBalance,
    saveBalances,
    loadBalances,
    STARTING_BALANCE
};
