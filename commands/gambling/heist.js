const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { getInventory, hasItem, removeItem, addItem } = require('./utils/inventory-manager');

// Heist cooldowns and active heists
const heistCooldowns = {};
const activeHeists = new Map();

// Heist targets with different difficulty and rewards
const HEIST_TARGETS = {
    convenience_store: {
        name: 'Convenience Store',
        emoji: '🏪',
        difficulty: 1,
        min_reward: 500,
        max_reward: 2000,
        risk: 0.15,
        required_items: [],
        description: 'Quick and easy target for beginners'
    },
    jewelry_store: {
        name: 'Jewelry Store',
        emoji: '💎',
        difficulty: 2,
        min_reward: 2000,
        max_reward: 8000,
        risk: 0.25,
        required_items: ['lockpicks'],
        description: 'Valuable gems but better security'
    },
    bank_vault: {
        name: 'Bank Vault',
        emoji: '🏦',
        difficulty: 3,
        min_reward: 8000,
        max_reward: 25000,
        risk: 0.35,
        required_items: ['explosives', 'hacking_device'],
        description: 'High-security target with massive payouts'
    },
    casino_vault: {
        name: 'Casino Vault',
        emoji: '🎰',
        difficulty: 4,
        min_reward: 15000,
        max_reward: 50000,
        risk: 0.45,
        required_items: ['keycard', 'thermal_drill'],
        description: 'Ultimate score but extremely dangerous'
    },
    armored_truck: {
        name: 'Armored Truck',
        emoji: '🚚',
        difficulty: 3,
        min_reward: 5000,
        max_reward: 20000,
        risk: 0.30,
        required_items: ['explosives'],
        description: 'Mobile target with heavy security'
    }
};

module.exports = {
    name: 'heist',
    description: 'Plan and execute criminal heists for massive payouts',
    usage: '%heist [target] | %heist plan [target] | %heist execute',
    category: 'gambling',
    aliases: ['robbery', 'rob', 'steal', 'crime'],
    cooldown: 30,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot plan heists for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 30 * 1000; // 30 seconds
        
        if (heistCooldowns[userId] && now < heistCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((heistCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ You're still casing the joint! Wait **${timeLeft}** more seconds.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await displayHeistMenu(message, userId, 0);
        }

        const action = args[0].toLowerCase();
        
        // Handle numbered selection
        if (!isNaN(parseInt(action))) {
            const targetNumber = parseInt(action);
            return await handleNumberedHeist(message, userId, targetNumber);
        }

        switch (action) {
            case 'plan':
                return await handlePlanHeist(message, userId, args.slice(1));
            case 'execute':
            case 'start':
                return await handleExecuteHeist(message, userId);
            case 'cancel':
                return await handleCancelHeist(message, userId);
            case 'targets':
            case 'list':
                return await displayHeistMenu(message, userId);
            default:
                return await handlePlanHeist(message, userId, args);
        }
    }
};

async function displayHeistMenu(message, userId, currentPage = 0) {
    const userBalance = getBalance(userId);
    const activeHeist = activeHeists.get(userId);
    
    let description = '**🎯 Criminal Heist Network**\n\n';
    description += '*"Every job is a risk. Every risk is a choice. Choose wisely."*\n\n';
    description += `💰 **Available Funds:** ${userBalance.toLocaleString()} coins\n\n`;
    
    if (activeHeist) {
        const heist = HEIST_TARGETS[activeHeist.target];
        description += `**🎯 Active Plan:** ${heist.emoji} ${heist.name}\n`;
        description += `└ ⏰ Planned for: ${new Date(activeHeist.planned_time).toLocaleTimeString()}\n`;
        description += `└ 🎲 Success Chance: ${Math.floor((1 - heist.risk) * 100)}%\n`;
        description += `└ \`%heist execute\` to start the heist!\n\n`;
    }
    // Get all heist targets
    const allTargets = Object.entries(HEIST_TARGETS);
    
    const itemsPerPage = 6;
    const totalPages = Math.ceil(allTargets.length / itemsPerPage);
    
    // Ensure current page is valid
    if (currentPage >= totalPages) currentPage = 0;
    if (currentPage < 0) currentPage = totalPages - 1;
    
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allTargets.length);
    const pageTargets = allTargets.slice(startIndex, endIndex);
    
    description = '**🎯 Criminal Heist Operations:**\n\n';
    description += '*Plan carefully. Execute flawlessly. Escape clean.*\n\n';
    description += `**🎯 Available Targets (Page ${currentPage + 1}/${totalPages}):**\n\n`;
    
    pageTargets.forEach(([heistId, heist], index) => {
        const targetNumber = startIndex + index + 1;
        const inventory = getInventory(userId);
        const hasRequiredItems = heist.required_items.every(item => hasItem(userId, item));
        const canAfford = userBalance >= (heist.investment || 0);
        const status = (canAfford && hasRequiredItems) ? '🎯 READY' : '❌ NOT READY';
        
        description += `**${targetNumber}.** ${heist.emoji} **${heist.name}** ${status}\n`;
        description += `└ *${heist.description}*\n`;
        description += `└ 💵 Expected Take: ${heist.min_reward.toLocaleString()} - ${heist.max_reward.toLocaleString()} coins\n`;
        description += `└ ⚠️ Risk Level: ${Math.floor(heist.risk * 100)}% • 🎲 Difficulty: ${heist.difficulty}/5\n`;
        description += `└ 🛠️ Required: ${heist.required_items.join(', ') || 'None'}\n`;
        description += `└ \`%heist plan ${heistId}\` or \`%heist ${targetNumber}\`\n\n`;
    });
    
    description += '**📋 Commands:**\n';
    description += '• `%heist plan <target>` - Plan a heist\n';
    description += '• `%heist execute` - Start planned heist\n';
    description += '• `%heist status` - Check active plans\n';
    description += '• Higher investment = better team = higher success rate\n';
    description += '• Higher difficulty = higher rewards but more risk\n';
    description += '• Plan carefully - getting caught means arrest!';

    const embed = new EmbedBuilder()
        .setTitle('🎯 Criminal Heist Network')
        .setDescription(description)
        .setColor(0x2c2c2c)
        .setFooter({ text: `Page ${currentPage + 1}/${totalPages} • High risk, high reward. Choose wisely.` })
        .setTimestamp();

    // Create navigation buttons if multiple pages
    const components = [];
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`heist_prev_${userId}_${currentPage}`)
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`heist_next_${userId}_${currentPage}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`heist_refresh_${userId}`)
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Primary)
            );
        components.push(row);
    }

    await sendAsFloofWebhook(message, { 
        embeds: [embed],
        components: components
    });
}

async function handlePlanHeist(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify a target to plan!\nExample: `%heist plan bank_vault`')
                    .setColor(0xff0000)
            ]
        });
    }

    const targetId = args[0].toLowerCase();
    const heist = HEIST_TARGETS[targetId];
    
    if (!heist) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid target! Use `%heist` to see available targets.')
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if user has required items
    const missingItems = heist.required_items.filter(item => !hasItem(userId, item));
    if (missingItems.length > 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You're missing required items!\n\n🛠️ **Missing:** ${missingItems.join(', ')}\n\n💡 Buy these from the blackmarket first!`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if user can afford the investment
    const userBalance = getBalance(userId);
    if (userBalance < heist.investment) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have enough funds for the investment!\n\n💰 **Required:** ${heist.investment.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Plan the heist
    const plannedTime = Date.now() + (heist.planning_hours * 60 * 60 * 1000); // planning hours from now
    activeHeists.set(userId, {
        target: targetId,
        planned_time: plannedTime,
        items_used: [...heist.required_items]
    });

    const embed = new EmbedBuilder()
        .setTitle('🎯 Heist Planned!')
        .setDescription(`${heist.emoji} **Target:** ${heist.name}\n\n⏰ **Execution Time:** ${new Date(plannedTime).toLocaleTimeString()}\n💰 **Investment:** ${heist.investment.toLocaleString()} coins\n💵 **Expected Take:** ${heist.min_payout.toLocaleString()} - ${heist.max_payout.toLocaleString()} coins\n⚠️ **Risk Level:** ${Math.floor(heist.risk * 100)}%\n🎲 **Success Chance:** ${Math.floor((1 - heist.risk) * 100)}%\n\n*The crew is assembling... Use \`%heist execute\` when ready!*`)
        .setColor(0xffa500)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleExecuteHeist(message, userId) {
    const activeHeist = activeHeists.get(userId);
    
    if (!activeHeist) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You have no active heist plan! Use `%heist plan <target>` first.')
                    .setColor(0xff0000)
            ]
        });
    }

    const heist = HEIST_TARGETS[activeHeist.target];
    const now = Date.now();
    
    if (now < activeHeist.planned_time) {
        const timeLeft = Math.ceil((activeHeist.planned_time - now) / 60000);
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`⏰ The heist isn't ready yet! Wait **${timeLeft}** more minutes.\n\n*The crew is still preparing...*`)
                    .setColor(0xffa500)
            ]
        });
    }

    // Set cooldown
    heistCooldowns[userId] = Date.now();
    
    // Remove the heist plan
    activeHeists.delete(userId);
    
    // Consume required items
    activeHeist.items_used.forEach(item => {
        removeItem(userId, item, 1);
    });

    // Calculate success/failure
    const success = Math.random() > heist.risk;
    
    if (!success) {
        // Heist failed - get arrested
        const { arrestUser } = require('./utils/crime-manager');
        const arrestTime = 45 + Math.random() * 75; // 45-120 minutes
        const bailAmount = Math.floor(heist.max_payout * 0.5);
        
        arrestUser(userId, arrestTime * 60 * 1000, 'Armed Robbery', bailAmount);
        
        const arrestStories = [
            `🚁 **FEDERAL TASK FORCE!** FBI helicopters descend as tactical teams storm the building. You're face-down on concrete with assault rifles aimed at your head.`,
            `🔫 **SWAT BREACH!** Flashbangs explode as armored officers pour through every entrance. 'GET ON THE GROUND!' echoes through the smoke.`,
            `📡 **SURVEILLANCE STING!** Months of federal surveillance culminate in your capture. They knew every move before you made it.`,
            `💀 **MAXIMUM SECURITY!** You're dragged away in federal custody while news helicopters circle overhead. This is going to be all over the media.`,
            `⚖️ **RICO CHARGES!** Federal prosecutors are building a racketeering case. This isn't just robbery - it's organized crime.`
        ];
        
        const arrestStory = arrestStories[Math.floor(Math.random() * arrestStories.length)];
        
        const embed = new EmbedBuilder()
            .setTitle('🚔 FEDERAL ARREST!')
            .setDescription(`**OPERATION SHUTDOWN!** ${heist.emoji} **${heist.name}** - BUSTED\n\n${arrestStory}\n\n🔒 **CHARGES:** Armed Robbery, Conspiracy, RICO Violations\n⏰ **FEDERAL DETENTION:** ${Math.floor(arrestTime)} minutes\n💸 **Bail Amount:** ${bailAmount.toLocaleString()} coins\n💰 **Assets Seized:** ${heist.investment.toLocaleString()} coins\n🛠️ **Evidence Confiscated:** ${heist.required_items.join(', ')}\n\n*The feds don't play games...*\n\nUse \`%bail\` to post bond or wait for your lawyer!`)
            .setColor(0xff0000)
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }

    // Heist succeeded!
    const payout = Math.floor(heist.min_payout + Math.random() * (heist.max_payout - heist.min_payout));
    const netProfit = payout - heist.investment;
    addBalance(userId, payout);
    
    // Chance to find bonus items
    const bonusItems = ['bullets', 'energy', 'fuel'];
    if (Math.random() < 0.3) {
        const bonusItem = bonusItems[Math.floor(Math.random() * bonusItems.length)];
        const bonusAmount = Math.floor(Math.random() * 5) + 1;
        addItem(userId, bonusItem, bonusAmount);
    }

    const successStories = [
        `🎯 **PERFECT EXECUTION!** Your crew moves like shadows through the ${heist.name.toLowerCase()}. Security cameras loop old footage while you work.`,
        `💀 **SILENT TAKEDOWN!** Guards never saw it coming. Your team neutralizes threats with military precision and vanishes into the night.`,
        `🔥 **EXPLOSIVE ENTRY!** Thermite charges blow the vault door clean off. Alarms scream but you're already loading the cash.`,
        `⚡ **TECH MASTERY!** Your hacker disables all security systems. You walk out the front door with bags of money like you own the place.`,
        `🚁 **HELICOPTER ESCAPE!** Police sirens wail below as your extraction team pulls you up to safety with the loot.`
    ];
    
    const successStory = successStories[Math.floor(Math.random() * successStories.length)];
    
    const embed = new EmbedBuilder()
        .setTitle('💥 HEIST SUCCESS!')
        .setDescription(`${heist.emoji} **${heist.name}** - OPERATION COMPLETE\n\n${successStory}\n\n💰 **Investment:** ${heist.investment.toLocaleString()} coins\n💵 **Payout:** ${payout.toLocaleString()} coins\n📈 **Net Profit:** ${netProfit.toLocaleString()} coins\n⏱️ **Planning Time:** ${heist.planning_hours} hours\n🛠️ **Equipment Used:** ${heist.required_items.join(', ') || 'None'}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n*Another successful job for the crew...*`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleCancelHeist(message, userId) {
    const activeHeist = activeHeists.get(userId);
    
    if (!activeHeist) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You have no active heist to cancel.')
                    .setColor(0xff0000)
            ]
        });
    }

    activeHeists.delete(userId);
    
    const embed = new EmbedBuilder()
        .setDescription('🚫 Heist plan cancelled. The crew has been dismissed.')
        .setColor(0x95a5a6);

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleNumberedHeist(message, userId, targetNumber) {
    const targets = Object.keys(HEIST_TARGETS);
    
    if (targetNumber < 1 || targetNumber > targets.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid target number! Choose 1-${targets.length}.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const targetId = targets[targetNumber - 1];
    return await handlePlanHeist(message, userId, [targetId]);
}
