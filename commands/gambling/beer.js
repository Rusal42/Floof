const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    getUserBlackmarketItems,
    useBlackmarketItem,
    getActiveEffects,
    hasActiveEffect
} = require('./utils/blackmarket-manager');

// Beer types and effects
const BEER_TYPES = {
    light_beer: {
        name: 'Light Beer',
        emoji: '🍺',
        price: 200,
        effects: { cooldown_reduction: 25, duration: 15 },
        description: 'Reduces cooldowns by 25% for 15 minutes',
        alcohol_content: 0.1
    },
    regular_beer: {
        name: 'Regular Beer',
        emoji: '🍻',
        price: 350,
        effects: { cooldown_reset: true, luck_boost: 5, duration: 20 },
        description: 'Resets cooldowns and gives small luck boost',
        alcohol_content: 0.15
    },
    craft_beer: {
        name: 'Craft Beer',
        emoji: '🍺',
        price: 500,
        effects: { xp_boost: 15, cooldown_reduction: 30, duration: 25 },
        description: 'Premium beer with XP and cooldown benefits',
        alcohol_content: 0.2
    },
    energy_drink: {
        name: 'Energy Drink',
        emoji: '⚡',
        price: 300,
        effects: { speed_boost: 20, attack_boost: 10, duration: 30 },
        description: 'Non-alcoholic energy boost',
        alcohol_content: 0
    }
};

// Drinking cooldowns
const drinkingCooldowns = {};

module.exports = {
    name: 'beer',
    description: 'Buy and drink various beverages for temporary effects',
    usage: '%beer [buy/drink/menu] [type]',
    category: 'gambling',
    aliases: ['drink', 'beverage', 'alcohol'],
    cooldown: 8,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 8 * 1000; // 8 seconds
        
        if (drinkingCooldowns[userId] && now < drinkingCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((drinkingCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ You're drinking too fast! Wait **${timeLeft}** more seconds.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await displayBeerMenu(message, userId);
        }

        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'buy':
            case 'purchase':
                return await handleBuyBeer(message, userId, args.slice(1));
            case 'drink':
            case 'consume':
                return await handleDrinkBeer(message, userId, args.slice(1));
            case 'menu':
            case 'list':
            case 'shop':
                return await displayBeerMenu(message, userId);
            case 'inventory':
            case 'inv':
                return await displayBeerInventory(message, userId);
            default:
                return await displayBeerMenu(message, userId);
        }
    }
};

async function displayBeerMenu(message, userId) {
    const userBalance = getBalance(userId);
    
    let description = '**🍺 Floof\'s Bar & Grill**\n\n';
    description += '*Welcome to the finest establishment in town!*\n\n';
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += '**🍻 Drink Menu:**\n';
    
    Object.entries(BEER_TYPES).forEach(([beerId, beer]) => {
        const canAfford = userBalance >= beer.price;
        const priceDisplay = canAfford ? `💰 ${beer.price.toLocaleString()}` : `❌ ${beer.price.toLocaleString()}`;
        
        description += `${beer.emoji} **${beer.name}** - ${priceDisplay}\n`;
        description += `└ ${beer.description}\n`;
        description += `└ 🍷 Alcohol: ${Math.floor(beer.alcohol_content * 100)}%\n`;
        description += `└ \`%beer buy ${beerId}\`\n\n`;
    });
    
    description += '💡 **Tip:** Drinks provide temporary boosts to gambling and combat!';

    const embed = new EmbedBuilder()
        .setTitle('🍺 Floof\'s Bar & Grill')
        .setDescription(description)
        .setColor(0xf39c12)
        .setFooter({ text: 'Drink responsibly! 🍻' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleBuyBeer(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify drink to buy!\nExample: `%beer buy regular_beer`')
                    .setColor(0xff0000)
            ]
        });
    }

    const beerId = args[0].toLowerCase();
    const quantity = parseInt(args[1]) || 1;
    
    if (!BEER_TYPES[beerId]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Unknown drink type! Use `%beer menu` to see available drinks.')
                    .setColor(0xff0000)
            ]
        });
    }

    if (quantity < 1 || quantity > 5) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Quantity must be between 1 and 5!')
                    .setColor(0xff0000)
            ]
        });
    }

    const beer = BEER_TYPES[beerId];
    const totalCost = beer.price * quantity;
    const userBalance = getBalance(userId);

    if (userBalance < totalCost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Set cooldown
    drinkingCooldowns[userId] = Date.now();

    // Add to blackmarket inventory (reusing the system)
    const userData = getUserBlackmarketItems(userId);
    if (!userData.items[beerId]) {
        userData.items[beerId] = 0;
    }
    userData.items[beerId] += quantity;
    
    // Save the data
    const fs = require('fs');
    const path = require('path');
    const BLACKMARKET_DATA_FILE = path.join(__dirname, '../../../blackmarket-data.json');
    const data = JSON.parse(fs.readFileSync(BLACKMARKET_DATA_FILE, 'utf8') || '{}');
    data[userId] = userData;
    fs.writeFileSync(BLACKMARKET_DATA_FILE, JSON.stringify(data, null, 2));

    subtractBalance(userId, totalCost);

    const embed = new EmbedBuilder()
        .setTitle('🍺 Purchase Successful!')
        .setDescription(`*The bartender slides you the drinks...*\n\n${beer.emoji} Successfully purchased **${quantity}x ${beer.name}**!\n\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n💡 Use \`%beer drink ${beerId}\` to consume!`)
        .setColor(0xf39c12)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleDrinkBeer(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify drink to consume!\nExample: `%beer drink regular_beer`')
                    .setColor(0xff0000)
            ]
        });
    }

    const beerId = args[0].toLowerCase();
    const beer = BEER_TYPES[beerId];
    
    if (!beer) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Unknown drink type!')
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if user has the drink
    const userData = getUserBlackmarketItems(userId);
    if (!userData.items[beerId] || userData.items[beerId] < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have any ${beer.name}!\n\nUse \`%beer buy ${beerId}\` to purchase some.`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Consume the drink
    userData.items[beerId]--;
    if (userData.items[beerId] <= 0) {
        delete userData.items[beerId];
    }

    // Apply effects
    const now = Date.now();
    if (beer.effects.duration) {
        const effectEnd = now + (beer.effects.duration * 60 * 1000);
        userData.active_effects[beerId] = {
            ...beer.effects,
            expires_at: effectEnd
        };
    }

    // Handle cooldown reset
    if (beer.effects.cooldown_reset) {
        // Reset all gambling cooldowns
        const cooldownFiles = [
            require('./slots'),
            require('./blackjack'),
            require('./coinflip'),
            require('./attack'),
            require('./beatup')
        ];
        
        cooldownFiles.forEach(command => {
            if (command.cooldowns) {
                delete command.cooldowns[userId];
            }
        });
    }

    // Save data
    const fs = require('fs');
    const path = require('path');
    const BLACKMARKET_DATA_FILE = path.join(__dirname, '../../../blackmarket-data.json');
    const data = JSON.parse(fs.readFileSync(BLACKMARKET_DATA_FILE, 'utf8') || '{}');
    data[userId] = userData;
    fs.writeFileSync(BLACKMARKET_DATA_FILE, JSON.stringify(data, null, 2));

    let effectMsg = `${beer.emoji} *Glug glug glug...* You drank **${beer.name}**!\n\n`;
    
    // Describe effects
    if (beer.effects.luck_boost) {
        effectMsg += `🍀 **Luck Boost:** +${beer.effects.luck_boost}% for ${beer.effects.duration} minutes\n`;
    }
    if (beer.effects.cooldown_reduction) {
        effectMsg += `⏰ **Cooldown Reduction:** -${beer.effects.cooldown_reduction}% for ${beer.effects.duration} minutes\n`;
    }
    if (beer.effects.cooldown_reset) {
        effectMsg += `🔄 **All gambling cooldowns have been reset!**\n`;
    }
    if (beer.effects.xp_boost) {
        effectMsg += `⭐ **XP Boost:** +${beer.effects.xp_boost}% for ${beer.effects.duration} minutes\n`;
    }
    if (beer.effects.speed_boost) {
        effectMsg += `💨 **Speed Boost:** +${beer.effects.speed_boost}% for ${beer.effects.duration} minutes\n`;
    }
    if (beer.effects.attack_boost) {
        effectMsg += `⚔️ **Attack Boost:** +${beer.effects.attack_boost}% for ${beer.effects.duration} minutes\n`;
    }
    
    effectMsg += '\n🍻 *You feel the effects kicking in...*';

    const embed = new EmbedBuilder()
        .setTitle('🍺 Cheers!')
        .setDescription(effectMsg)
        .setColor(0xf39c12)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayBeerInventory(message, userId) {
    const userData = getUserBlackmarketItems(userId);
    
    let beerItems = {};
    Object.entries(userData.items).forEach(([itemId, quantity]) => {
        if (BEER_TYPES[itemId] && quantity > 0) {
            beerItems[itemId] = quantity;
        }
    });
    
    if (Object.keys(beerItems).length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('🍺 Your bar is empty! Visit the bar to buy some drinks.')
                    .setColor(0x95a5a6)
            ]
        });
    }
    
    let description = '**🍺 Your Personal Bar:**\n\n';
    
    Object.entries(beerItems).forEach(([beerId, quantity]) => {
        const beer = BEER_TYPES[beerId];
        description += `${beer.emoji} **${beer.name}** x${quantity}\n`;
        description += `└ ${beer.description}\n`;
        description += `└ \`%beer drink ${beerId}\`\n\n`;
    });
    
    // Show active drinking effects
    const activeEffects = getActiveEffects(userId);
    const drinkingEffects = Object.entries(activeEffects).filter(([effectId]) => BEER_TYPES[effectId]);
    
    if (drinkingEffects.length > 0) {
        description += '**🍻 Active Drinking Effects:**\n';
        drinkingEffects.forEach(([effectId, effect]) => {
            const beer = BEER_TYPES[effectId];
            const timeLeft = Math.ceil((effect.expires_at - Date.now()) / 60000);
            description += `${beer.emoji} ${beer.name} (${timeLeft}m remaining)\n`;
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(`🍺 ${message.author.username}'s Personal Bar`)
        .setDescription(description)
        .setColor(0xf39c12)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}
