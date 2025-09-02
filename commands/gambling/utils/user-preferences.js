const fs = require('fs');
const path = require('path');

const PREFERENCES_FILE = path.join(__dirname, '../../../data/user-preferences.json');

// Default user preferences
const DEFAULT_PREFERENCES = {
    // Crime & Attack Settings
    allow_attacks: true,           // Can be attacked by other users
    allow_robberies: true,         // Can have businesses robbed
    allow_pet_attacks: true,       // Can have pets attacked
    
    // Defense Settings
    bodyguard_protection: true,    // Bodyguards will protect user
    pet_defense: true,             // Pets will defend when AFK
    auto_bail_friends: true,       // Allow friends to auto-bail user
    
    // Notification Settings
    crime_notifications: true,     // Get notified of crimes against you
    arrest_notifications: true,    // Get notified when arrested
    bail_notifications: true,      // Get notified of bail requests
    business_notifications: true,  // Get notified of business events
    
    // Privacy Settings
    show_in_leaderboards: true,    // Appear in crime/business leaderboards
    allow_friend_requests: true,   // Allow NPC friend requests for bail
    public_business_info: true,    // Others can see your business info
    
    // Interaction Settings
    allow_drug_deals: true,        // Can buy/sell drugs with other users
    allow_business_partnerships: true, // Can form business partnerships
    receive_crime_invites: true,   // Can be invited to group crimes
    
    // Advanced Settings
    auto_collect_income: false,    // Auto-collect business income
    smart_bodyguard_mode: true,    // Bodyguards use smart protection
    pet_auto_feed: false,          // Auto-feed pets when hungry
    crime_risk_warnings: true      // Show risk warnings before crimes
};

// Load user preferences
function getUserPreferences(userId) {
    try {
        if (!fs.existsSync(PREFERENCES_FILE)) {
            fs.writeFileSync(PREFERENCES_FILE, JSON.stringify({}));
        }
        
        const allPreferences = JSON.parse(fs.readFileSync(PREFERENCES_FILE, 'utf8'));
        
        if (!allPreferences[userId]) {
            allPreferences[userId] = { ...DEFAULT_PREFERENCES };
            fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(allPreferences, null, 2));
        }
        
        // Merge with defaults to ensure all preferences exist
        return { ...DEFAULT_PREFERENCES, ...allPreferences[userId] };
    } catch (error) {
        console.error('Error loading user preferences:', error);
        return { ...DEFAULT_PREFERENCES };
    }
}

// Save user preferences
function saveUserPreferences(userId, preferences) {
    try {
        let allPreferences = {};
        
        if (fs.existsSync(PREFERENCES_FILE)) {
            allPreferences = JSON.parse(fs.readFileSync(PREFERENCES_FILE, 'utf8'));
        }
        
        allPreferences[userId] = preferences;
        fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(allPreferences, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving user preferences:', error);
        return false;
    }
}

// Update specific preference
function updatePreference(userId, preferenceKey, value) {
    const preferences = getUserPreferences(userId);
    
    if (!(preferenceKey in DEFAULT_PREFERENCES)) {
        return { success: false, reason: 'invalid_preference' };
    }
    
    preferences[preferenceKey] = value;
    const saved = saveUserPreferences(userId, preferences);
    
    return { 
        success: saved, 
        preference: preferenceKey, 
        value: value,
        preferences: preferences
    };
}

// Check if user allows specific action
function userAllows(userId, action) {
    const preferences = getUserPreferences(userId);
    return preferences[action] === true;
}

// Get preference categories for display
function getPreferenceCategories() {
    return {
        'Crime & Attack Settings': [
            { key: 'allow_attacks', name: 'Allow Attacks', description: 'Other users can attack you' },
            { key: 'allow_robberies', name: 'Allow Robberies', description: 'Your businesses can be robbed' },
            { key: 'allow_pet_attacks', name: 'Allow Pet Attacks', description: 'Your pets can be attacked in battles' }
        ],
        'Defense Settings': [
            { key: 'bodyguard_protection', name: 'Bodyguard Protection', description: 'Hired bodyguards will protect you' },
            { key: 'pet_defense', name: 'Pet Defense', description: 'Pets defend you when AFK' },
            { key: 'auto_bail_friends', name: 'Auto Bail Friends', description: 'Friends can automatically bail you out' }
        ],
        'Notification Settings': [
            { key: 'crime_notifications', name: 'Crime Notifications', description: 'Get notified when targeted by crimes' },
            { key: 'arrest_notifications', name: 'Arrest Notifications', description: 'Get notified when arrested' },
            { key: 'bail_notifications', name: 'Bail Notifications', description: 'Get notified of bail requests' },
            { key: 'business_notifications', name: 'Business Notifications', description: 'Get notified of business events' }
        ],
        'Privacy Settings': [
            { key: 'show_in_leaderboards', name: 'Show in Leaderboards', description: 'Appear in public leaderboards' },
            { key: 'allow_friend_requests', name: 'Allow Friend Requests', description: 'NPCs can befriend you for bail help' },
            { key: 'public_business_info', name: 'Public Business Info', description: 'Others can view your business details' }
        ],
        'Interaction Settings': [
            { key: 'allow_drug_deals', name: 'Allow Drug Deals', description: 'Can participate in drug trading' },
            { key: 'allow_business_partnerships', name: 'Business Partnerships', description: 'Can form business partnerships' },
            { key: 'receive_crime_invites', name: 'Crime Invites', description: 'Can be invited to group crimes' }
        ],
        'Advanced Settings': [
            { key: 'auto_collect_income', name: 'Auto Collect Income', description: 'Automatically collect business income' },
            { key: 'smart_bodyguard_mode', name: 'Smart Bodyguard Mode', description: 'Bodyguards use intelligent protection' },
            { key: 'pet_auto_feed', name: 'Pet Auto Feed', description: 'Automatically feed hungry pets' },
            { key: 'crime_risk_warnings', name: 'Crime Risk Warnings', description: 'Show risk warnings before crimes' }
        ]
    };
}

// Format preferences display
function formatPreferencesDisplay(userId) {
    const preferences = getUserPreferences(userId);
    const categories = getPreferenceCategories();
    
    let display = '**Your Crime & Privacy Settings:**\n\n';
    
    Object.entries(categories).forEach(([categoryName, settings]) => {
        display += `**${categoryName}:**\n`;
        
        settings.forEach(setting => {
            const enabled = preferences[setting.key];
            const status = enabled ? '✅ Enabled' : '❌ Disabled';
            display += `• **${setting.name}:** ${status}\n`;
        });
        
        display += '\n';
    });
    
    display += '**Usage:**\n';
    display += '• `%preferences toggle <setting>` - Toggle a setting\n';
    display += '• `%preferences enable <setting>` - Enable a setting\n';
    display += '• `%preferences disable <setting>` - Disable a setting\n';
    display += '• `%preferences reset` - Reset to defaults\n';
    display += '• `%preferences help <setting>` - Get help for a setting';
    
    return display;
}

// Get setting help text
function getSettingHelp(settingKey) {
    const categories = getPreferenceCategories();
    
    for (const [categoryName, settings] of Object.entries(categories)) {
        const setting = settings.find(s => s.key === settingKey);
        if (setting) {
            return {
                category: categoryName,
                name: setting.name,
                description: setting.description,
                key: settingKey
            };
        }
    }
    
    return null;
}

// Reset preferences to default
function resetPreferences(userId) {
    const saved = saveUserPreferences(userId, { ...DEFAULT_PREFERENCES });
    return { success: saved, preferences: DEFAULT_PREFERENCES };
}

// Check if user can be targeted for crime
function canTargetUser(userId, crimeType) {
    const preferences = getUserPreferences(userId);
    
    switch (crimeType) {
        case 'attack':
            return preferences.allow_attacks;
        case 'robbery':
            return preferences.allow_robberies;
        case 'pet_attack':
            return preferences.allow_pet_attacks;
        case 'drug_deal':
            return preferences.allow_drug_deals;
        default:
            return true;
    }
}

module.exports = {
    DEFAULT_PREFERENCES,
    getUserPreferences,
    saveUserPreferences,
    updatePreference,
    userAllows,
    getPreferenceCategories,
    formatPreferencesDisplay,
    getSettingHelp,
    resetPreferences,
    canTargetUser
};
