const fs = require('fs');
const path = require('path');

const vaultDir = path.resolve(__dirname, '../../../data');
const VAULT_FILE = path.join(vaultDir, 'vaults.json');

let userVaults = {};

// Vault upgrade tiers and their properties
const VAULT_TIERS = {
    0: { capacity: 0, upgrade_cost: 1000, name: 'No Vault', emoji: '❌' },
    1: { capacity: 5000, upgrade_cost: 5000, name: 'Basic Vault', emoji: '🗃️' },
    2: { capacity: 15000, upgrade_cost: 15000, name: 'Secure Vault', emoji: '🔒' },
    3: { capacity: 50000, upgrade_cost: 50000, name: 'Bank Vault', emoji: '🏦' },
    4: { capacity: 150000, upgrade_cost: 150000, name: 'Fortress Vault', emoji: '🏰' },
    5: { capacity: 500000, upgrade_cost: 500000, name: 'Swiss Bank', emoji: '🇨🇭' },
    6: { capacity: 1500000, upgrade_cost: 1500000, name: 'Gold Reserve', emoji: '🏛️' },
    7: { capacity: 5000000, upgrade_cost: 5000000, name: 'Federal Reserve', emoji: '💰' },
    8: { capacity: 15000000, upgrade_cost: 15000000, name: 'Dragon\'s Hoard', emoji: '🐉' },
    9: { capacity: 50000000, upgrade_cost: 50000000, name: 'Infinite Vault', emoji: '♾️' },
    10: { capacity: Infinity, upgrade_cost: null, name: 'Floof\'s Personal Vault', emoji: '👑' }
};

function loadVaults() {
    try {
        if (!fs.existsSync(vaultDir)) {
            fs.mkdirSync(vaultDir, { recursive: true });
        }
        if (fs.existsSync(VAULT_FILE)) {
            const data = fs.readFileSync(VAULT_FILE, 'utf8');
            userVaults = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading vaults.json:', err);
        userVaults = {};
    }
    return userVaults;
}

function saveVaults() {
    try {
        fs.writeFileSync(VAULT_FILE, JSON.stringify(userVaults, null, 2));
    } catch (err) {
        console.error('Error saving vaults.json:', err);
    }
}

function getVault(userId) {
    if (!userVaults[userId]) {
        userVaults[userId] = {
            tier: 0,
            balance: 0,
            last_interest: Date.now()
        };
        saveVaults();
    }
    return userVaults[userId];
}

function getVaultCapacity(userId) {
    const vault = getVault(userId);
    return VAULT_TIERS[vault.tier].capacity;
}

function getVaultBalance(userId) {
    const vault = getVault(userId);
    return vault.balance;
}

function canDeposit(userId, amount) {
    const vault = getVault(userId);
    const capacity = VAULT_TIERS[vault.tier].capacity;
    
    if (capacity === Infinity) return true;
    return (vault.balance + amount) <= capacity;
}

function deposit(userId, amount) {
    const vault = getVault(userId);
    const capacity = VAULT_TIERS[vault.tier].capacity;
    
    if (vault.tier === 0) {
        return { success: false, reason: 'no_vault' };
    }
    
    if (amount <= 0) {
        return { success: false, reason: 'invalid_amount' };
    }
    
    if (capacity !== Infinity && (vault.balance + amount) > capacity) {
        return { success: false, reason: 'capacity_exceeded', max_deposit: capacity - vault.balance };
    }
    
    vault.balance += amount;
    saveVaults();
    return { success: true, new_balance: vault.balance };
}

function withdraw(userId, amount) {
    const vault = getVault(userId);
    
    if (vault.tier === 0) {
        return { success: false, reason: 'no_vault' };
    }
    
    if (amount <= 0) {
        return { success: false, reason: 'invalid_amount' };
    }
    
    if (vault.balance < amount) {
        return { success: false, reason: 'insufficient_funds', available: vault.balance };
    }
    
    vault.balance -= amount;
    saveVaults();
    return { success: true, new_balance: vault.balance };
}

function upgradeVault(userId) {
    const vault = getVault(userId);
    
    if (vault.tier >= 10) {
        return { success: false, reason: 'max_tier' };
    }
    
    const nextTier = vault.tier + 1;
    const upgradeCost = VAULT_TIERS[nextTier].upgrade_cost;
    
    return {
        success: false,
        reason: 'needs_payment',
        cost: upgradeCost,
        next_tier: nextTier,
        next_tier_info: VAULT_TIERS[nextTier]
    };
}

function completeVaultUpgrade(userId) {
    const vault = getVault(userId);
    
    if (vault.tier >= 10) {
        return { success: false, reason: 'max_tier' };
    }
    
    vault.tier += 1;
    saveVaults();
    
    return {
        success: true,
        new_tier: vault.tier,
        tier_info: VAULT_TIERS[vault.tier]
    };
}

function calculateInterest(userId) {
    const vault = getVault(userId);
    
    if (vault.tier === 0 || vault.balance === 0) {
        return 0;
    }
    
    const now = Date.now();
    const timeDiff = now - vault.last_interest;
    const hoursPassed = timeDiff / (1000 * 60 * 60);
    
    // Interest rate: 0.1% per hour for vault money
    const interestRate = 0.001;
    const interest = Math.floor(vault.balance * interestRate * hoursPassed);
    
    if (interest > 0) {
        vault.balance += interest;
        vault.last_interest = now;
        saveVaults();
    }
    
    return interest;
}

function getVaultInfo(userId) {
    const vault = getVault(userId);
    const tierInfo = VAULT_TIERS[vault.tier];
    const nextTierInfo = vault.tier < 10 ? VAULT_TIERS[vault.tier + 1] : null;
    
    return {
        tier: vault.tier,
        balance: vault.balance,
        capacity: tierInfo.capacity,
        tier_name: tierInfo.name,
        tier_emoji: tierInfo.emoji,
        next_tier: nextTierInfo,
        upgrade_cost: nextTierInfo?.upgrade_cost || null,
        can_upgrade: vault.tier < 10
    };
}

function formatVaultDisplay(userId) {
    const info = getVaultInfo(userId);
    const interest = calculateInterest(userId);
    
    let display = `**${info.tier_emoji} ${info.tier_name}**\n`;
    
    if (info.tier === 0) {
        display += `❌ You don't have a vault yet!\n`;
        display += `💡 **Tip:** Buy a vault upgrade to safely store your coins!\n`;
        display += `💰 **Cost:** ${info.next_tier.upgrade_cost.toLocaleString()} coins\n`;
        display += `🔒 **Capacity:** ${info.next_tier.capacity.toLocaleString()} coins`;
        return display;
    }
    
    display += `💰 **Balance:** ${info.balance.toLocaleString()} coins\n`;
    
    if (info.capacity === Infinity) {
        display += `♾️ **Capacity:** Unlimited\n`;
    } else {
        const usedPercent = Math.round((info.balance / info.capacity) * 100);
        display += `📊 **Capacity:** ${info.balance.toLocaleString()}/${info.capacity.toLocaleString()} (${usedPercent}%)\n`;
    }
    
    if (interest > 0) {
        display += `📈 **Interest Earned:** +${interest.toLocaleString()} coins\n`;
    }
    
    if (info.can_upgrade) {
        display += `\n**⬆️ Next Upgrade:**\n`;
        display += `${info.next_tier.emoji} ${info.next_tier.name}\n`;
        display += `💰 **Cost:** ${info.next_tier.upgrade_cost.toLocaleString()} coins\n`;
        if (info.next_tier.capacity === Infinity) {
            display += `♾️ **Capacity:** Unlimited`;
        } else {
            display += `📊 **Capacity:** ${info.next_tier.capacity.toLocaleString()} coins`;
        }
    } else {
        display += `\n👑 **Maximum tier reached!**`;
    }
    
    return display;
}

function getAllVaultTiers() {
    return VAULT_TIERS;
}

// Load vaults on startup
loadVaults();

module.exports = {
    getVault,
    getVaultCapacity,
    getVaultBalance,
    canDeposit,
    deposit,
    withdraw,
    upgradeVault,
    completeVaultUpgrade,
    calculateInterest,
    getVaultInfo,
    formatVaultDisplay,
    getAllVaultTiers,
    saveVaults,
    loadVaults,
    VAULT_TIERS
};
