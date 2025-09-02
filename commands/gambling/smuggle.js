const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { getInventory, hasItem, removeItem, addItem } = require('./utils/inventory-manager');

// Smuggling cooldowns
const smugglingCooldowns = {};

// Smuggling routes with different risks and rewards
const SMUGGLING_ROUTES = {
    local_delivery: {
        name: 'Local Delivery',
        emoji: '🚗',
        distance: 'Short',
        time_minutes: 15,
        investment: 500,
        min_profit: 800,
        max_profit: 1200,
        risk: 0.10,
        required_items: [],
        contraband_type: 'electronics',
        description: 'Quick local run with minimal risk'
    },
    cross_state: {
        name: 'Cross-State Run',
        emoji: '🚛',
        distance: 'Medium',
        time_minutes: 45,
        investment: 1500,
        min_profit: 2500,
        max_profit: 4000,
        risk: 0.20,
        required_items: ['fake_id'],
        contraband_type: 'drugs',
        description: 'Interstate smuggling with border checks'
    },
    international: {
        name: 'International Smuggling',
        emoji: '🛢️',
        distance: 'Long',
        time_minutes: 120,
        investment: 5000,
        min_profit: 8000,
        max_profit: 15000,
        risk: 0.35,
        required_items: ['fake_passport', 'bribe_money'],
        contraband_type: 'weapons',
        description: 'High-stakes international operation'
    },
    air_drop: {
        name: 'Air Drop Operation',
        emoji: '✈️',
        distance: 'Special',
        time_minutes: 30,
        investment: 3000,
        min_profit: 5000,
        max_profit: 8000,
        risk: 0.25,
        required_items: ['pilot_license'],
        contraband_type: 'artifacts',
        description: 'Aerial smuggling with drone surveillance risk'
    }
};

// Contraband types that can be smuggled
const CONTRABAND_TYPES = {
    drugs: {
        name: 'Illegal Drugs',
        emoji: '💊',
        value_multiplier: 1.5,
        risk_increase: 0.15,
        description: 'High-value narcotics'
    },
    weapons: {
        name: 'Illegal Weapons',
        emoji: '🔫',
        value_multiplier: 2.0,
        risk_increase: 0.20,
        description: 'Military-grade firearms'
    },
    artifacts: {
        name: 'Stolen Artifacts',
        emoji: '🏺',
        value_multiplier: 1.8,
        risk_increase: 0.10,
        description: 'Priceless historical items'
    },
    electronics: {
        name: 'Black Market Electronics',
        emoji: '📱',
        value_multiplier: 1.3,
        risk_increase: 0.08,
        description: 'Untraceable tech devices'
    }
};

module.exports = {
    name: 'smuggle',
    description: 'Run illegal smuggling operations across borders',
    usage: '%smuggle [route] [contraband] | %smuggle routes',
    category: 'gambling',
    aliases: ['smuggling', 'transport', 'trafficking'],
    cooldown: 20,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot run smuggling operations for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 20 * 1000; // 20 seconds
        
        if (smugglingCooldowns[userId] && now < smugglingCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((smugglingCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ Your smuggling network is busy! Wait **${timeLeft}** more seconds.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await displaySmugglingMenu(message, userId);
        }

        const action = args[0].toLowerCase();
        
        // Handle numbered selection
        if (!isNaN(parseInt(action))) {
            const routeNumber = parseInt(action);
            const contrabandType = args[1] ? args[1].toLowerCase() : 'drugs';
            return await handleNumberedSmuggling(message, userId, routeNumber, contrabandType);
        }

        switch (action) {
            case 'routes':
            case 'list':
                return await displaySmugglingMenu(message, userId);
            case 'contraband':
            case 'goods':
                return await displayContrabandTypes(message, userId);
            default:
                const contrabandType = args[1] ? args[1].toLowerCase() : 'drugs';
                return await handleSmuggling(message, userId, action, contrabandType);
        }
    }
};

async function displaySmugglingMenu(message, userId) {
    const userBalance = getBalance(userId);
    
    let description = '**🚚 International Smuggling Network**\n\n';
    description += '*"Borders are just lines on a map. Money flows where it wants to go."*\n\n';
    description += `💰 **Available Capital:** ${userBalance.toLocaleString()} coins\n\n`;
    description += '**🚚 Smuggling Network Operations:**\n\n';
    description += '*Move fast. Stay quiet. Trust no one.*\n\n';
    
    Object.entries(SMUGGLING_ROUTES).forEach(([routeId, route]) => {
        const inventory = getInventory(userId);
        const hasRequiredItems = route.required_items.every(item => hasItem(userId, item));
        const canAfford = userBalance >= route.investment;
        const status = (canAfford && hasRequiredItems) ? '🚚 READY' : '❌ NOT READY';
        
        description += `${route.emoji} **${route.name}** ${status}\n`;
        description += `└ *${route.description}*\n`;
        description += `└ 💰 Investment: ${route.investment.toLocaleString()} coins\n`;
        description += `└ 💵 Expected Profit: ${route.min_profit.toLocaleString()} - ${route.max_profit.toLocaleString()} coins\n`;
        description += `└ ⏱️ Transit Time: ${route.time_minutes / 60} hours • ⚠️ Heat Level: ${Math.floor(route.risk * 100)}%\n`;
        description += `└ 📦 Cargo Type: ${route.contraband_type}\n`;
        
        if (route.required_items.length > 0) {
            description += `└ 🛠️ Equipment Needed: ${route.required_items.join(', ')}\n`;
        }
        
        description += `└ \`%smuggle ${routeId.replace(/_/g, ' ')}\`\n\n`;
    });
    
    description += '**📦 Contraband Types:**\n';
    Object.entries(CONTRABAND_TYPES).forEach(([contrabandId, contraband]) => {
        description += `${contraband.emoji} **${contraband.name}** - ${contraband.value_multiplier}x value\n`;
    });
    
    description += '\n💡 **Tips:**\n';
    description += '⚠️ **WARNING:** International smuggling is a federal crime!\n';
    description += '🛒 **Supply Chain:** Acquire equipment through blackmarket contacts\n';
    description += '🌐 **Network:** Higher risk routes = higher profits but more heat';

    const embed = new EmbedBuilder()
        .setTitle('📦 Smuggling Operations')
        .setDescription(description)
        .setColor(0x654321)
        .setFooter({ text: 'Move fast, stay quiet, don\'t get caught' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleSmuggling(message, userId, routeId) {
    // Handle spaced route names by converting back to underscore format
    const normalizedRouteId = routeId.replace(/\s+/g, '_');
    const route = SMUGGLING_ROUTES[normalizedRouteId];
    
    if (!route) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid route! Use `%smuggle routes` to see available routes.')
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if user has required items
    const missingItems = route.required_items.filter(item => !hasItem(userId, item));
    if (missingItems.length > 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You're missing required items!\n\n🛠️ **Missing:** ${missingItems.join(', ')}\n\n💡 Get these from the blackmarket!`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if user can afford the investment
    const userBalance = getBalance(userId);
    if (userBalance < route.investment) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have enough capital! You need ${route.investment.toLocaleString()} coins to invest.`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Set cooldown
    smugglingCooldowns[userId] = Date.now();
    
    // Consume required items
    route.required_items.forEach(item => {
        removeItem(userId, item, 1);
    });

    // Subtract investment from user balance
    subtractBalance(userId, route.investment);

    // Calculate final reward and risk
    const finalReward = Math.floor(Math.random() * (route.max_profit - route.min_profit) + route.min_profit);
    const finalRisk = Math.min(0.8, route.risk);
    
    // Simulate the smuggling operation
    const success = Math.random() > finalRisk;
    
    if (!success) {
        // Smuggling failed - get arrested
        const { arrestUser } = require('./utils/crime-manager');
        const arrestTime = 30 + Math.random() * 90; // 30-120 minutes
        const bailAmount = Math.floor(finalReward * 0.8);
        
        arrestUser(userId, arrestTime * 60 * 1000, 'Smuggling', bailAmount);
        
        const arrestStories = [
            `🚨 **FEDERAL TASK FORCE!** DEA agents storm your location with assault rifles drawn. 'HANDS WHERE WE CAN SEE THEM!' echoes through megaphones.`,
            `🚁 **MULTI-AGENCY RAID!** FBI, DEA, and Border Patrol coordinate a massive bust. Helicopters circle overhead as you're surrounded.`,
            `📡 **WIRE TAP EVIDENCE!** Months of surveillance recordings are played back during interrogation. They have everything on tape.`,
            `🌊 **COAST GUARD INTERCEPT!** Military vessels surround your boat in international waters. There's nowhere to run on the open ocean.`,
            `⚖️ **RICO PROSECUTION!** Federal prosecutors charge you under organized crime statutes. This isn't just smuggling - it's conspiracy.`
        ];
        
        const arrestStory = arrestStories[Math.floor(Math.random() * arrestStories.length)];
        
        const embed = new EmbedBuilder()
            .setTitle('🚔 FEDERAL ARREST!')
            .setDescription(`**OPERATION SHUTDOWN!** ${route.emoji} **${route.name}** - BUSTED\n\n${arrestStory}\n\n🔒 **CHARGES:** International Smuggling, Conspiracy, RICO Violations\n⏰ **FEDERAL DETENTION:** ${Math.floor(arrestTime)} minutes\n💸 **Bail Amount:** ${bailAmount.toLocaleString()} coins\n💰 **Assets Seized:** ${route.investment.toLocaleString()} coins\n📦 **Evidence Confiscated:** ${route.contraband_type}\n🛠️ **Equipment Seized:** ${route.required_items.join(', ')}\n\n*International smuggling carries serious time...*\n\nUse \`%bail\` to post bond or call your lawyer!`)
            .setColor(0xff0000)
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }

    // Smuggling succeeded!
    addBalance(userId, finalReward);
    
    // Chance for bonus contraband
    if (Math.random() < 0.2) {
        const bonusItems = ['fake_id', 'bribe_money'];
        const bonusItem = bonusItems[Math.floor(Math.random() * bonusItems.length)];
        addItem(userId, bonusItem, 1);
    }

    const successStories = [
        `🌊 **CLEAN CROSSING!** Your cargo ship slips past coast guard patrols under cover of darkness. The contraband is unloaded at a private dock without incident.`,
        `✈️ **AIR DROP SUCCESS!** Your pilot flies below radar and drops the packages at the designated coordinates. Ground crew secures the cargo before authorities arrive.`,
        `🚛 **HIGHWAY RUNNER!** Your convoy uses decoy trucks and false manifests to move the contraband across state lines. Border agents wave you through.`,
        `🚢 **SUBMARINE DELIVERY!** Your underwater transport surfaces at the rendezvous point. The cargo transfers to speedboats that vanish into the night.`,
        `🚁 **HELICOPTER EXTRACTION!** Your chopper pilot navigates through mountain passes, avoiding detection. The drop zone is secured by your ground team.`
    ];
    
    const successStory = successStories[Math.floor(Math.random() * successStories.length)];
    
    const embed = new EmbedBuilder()
        .setTitle('💰 SMUGGLING SUCCESS!')
        .setDescription(`${route.emoji} **${route.name}** - OPERATION COMPLETE\n\n${successStory}\n\n💰 **Investment:** ${route.investment.toLocaleString()} coins\n💵 **Profit:** ${finalReward.toLocaleString()} coins\n📈 **Net Gain:** ${(finalReward - route.investment).toLocaleString()} coins\n⏱️ **Transit Time:** ${route.time_minutes / 60} hours\n📦 **Contraband Moved:** ${route.contraband_type}\n🛠️ **Equipment Used:** ${route.required_items.join(', ') || 'None'}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n*Another successful run for the organization...*`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleNumberedSmuggling(message, userId, routeNumber) {
    const routes = Object.keys(SMUGGLING_ROUTES);
    
    if (routeNumber < 1 || routeNumber > routes.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid route number! Choose 1-${routes.length}.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const routeId = routes[routeNumber - 1];
    return await handleSmuggling(message, userId, routeId, contrabandType);
}
