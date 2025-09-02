const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { getInventory, hasItem, removeItem, addItem } = require('./utils/inventory-manager');

// Cartel operations cooldowns
const cartelCooldowns = {};

// Drug manufacturing operations
const DRUG_OPERATIONS = {
    street_dealing: {
        name: 'Street Dealing',
        emoji: '🏘️',
        investment: 1000,
        time_hours: 2,
        min_return: 1500,
        max_return: 3000,
        risk: 0.20,
        required_items: ['drugs'],
        description: 'Sell drugs on street corners'
    },
    lab_production: {
        name: 'Lab Production',
        emoji: '🧪',
        investment: 5000,
        time_hours: 6,
        min_return: 8000,
        max_return: 15000,
        risk: 0.30,
        required_items: ['chemicals', 'lab_equipment'],
        description: 'Manufacture high-grade narcotics'
    },
    distribution_network: {
        name: 'Distribution Network',
        emoji: '🚚',
        investment: 15000,
        time_hours: 12,
        min_return: 25000,
        max_return: 45000,
        risk: 0.35,
        required_items: ['vehicles', 'corrupt_contacts'],
        description: 'Large-scale drug distribution operation'
    },
    international_trafficking: {
        name: 'International Trafficking',
        emoji: '🌍',
        investment: 50000,
        time_hours: 24,
        min_return: 80000,
        max_return: 150000,
        risk: 0.45,
        required_items: ['fake_passport', 'cartel_connections'],
        description: 'Cross-border drug trafficking empire'
    }
};

// Cartel territories that can be controlled
const TERRITORIES = {
    downtown: {
        name: 'Downtown District',
        emoji: '🏙️',
        control_cost: 25000,
        daily_income: 2000,
        defense_requirement: 3,
        description: 'High-traffic commercial area'
    },
    docks: {
        name: 'Harbor Docks',
        emoji: '⚓',
        control_cost: 40000,
        daily_income: 3500,
        defense_requirement: 5,
        description: 'Strategic smuggling port'
    },
    industrial: {
        name: 'Industrial Zone',
        emoji: '🏭',
        control_cost: 60000,
        daily_income: 5000,
        defense_requirement: 7,
        description: 'Manufacturing and storage facilities'
    },
    airport: {
        name: 'Airport Terminal',
        emoji: '✈️',
        control_cost: 100000,
        daily_income: 8000,
        defense_requirement: 10,
        description: 'International trafficking hub'
    }
};

module.exports = {
    name: 'cartel',
    description: 'Run drug cartel operations and control territories',
    usage: '%cartel [operation/territory] | %cartel operations | %cartel territories',
    category: 'gambling',
    aliases: ['drugs', 'trafficking', 'narcos'],
    cooldown: 25,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot run cartel operations for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 25 * 1000; // 25 seconds
        
        if (cartelCooldowns[userId] && now < cartelCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((cartelCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ Your cartel is busy with other operations! Wait **${timeLeft}** more seconds.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await displayCartelMenu(message, userId, 0);
        }

        const action = args[0].toLowerCase();
        
        // Handle numbered selection
        if (!isNaN(parseInt(action))) {
            const operationNumber = parseInt(action);
            return await handleNumberedOperation(message, userId, operationNumber);
        }

        switch (action) {
            case 'operations':
            case 'ops':
                return await displayOperations(message, userId);
            case 'territories':
            case 'territory':
            case 'control':
                return await displayTerritories(message, userId);
            case 'empire':
            case 'status':
                return await displayCartelEmpire(message, userId);
            default:
                return await handleOperation(message, userId, action);
        }
    }
};

async function displayCartelMenu(message, userId, currentPage = 0) {
    const userBalance = getBalance(userId);
    
    // Get all items (operations + territories)
    const allItems = [];
    
    // Add operations
    Object.entries(DRUG_OPERATIONS).forEach(([opId, operation]) => {
        allItems.push({
            type: 'operation',
            id: opId,
            data: operation
        });
    });
    
    // Add territories
    Object.entries(TERRITORIES).forEach(([territoryId, territory]) => {
        allItems.push({
            type: 'territory',
            id: territoryId,
            data: territory
        });
    });
    
    const itemsPerPage = 8;
    const totalPages = Math.ceil(allItems.length / itemsPerPage);
    
    // Ensure current page is valid
    if (currentPage >= totalPages) currentPage = 0;
    if (currentPage < 0) currentPage = totalPages - 1;
    
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allItems.length);
    const pageItems = allItems.slice(startIndex, endIndex);
    
    let description = `**🏴‍☠️ Drug Cartel Operations**\n\n`;
    description += `*Welcome to the underworld, jefe...*\n\n`;
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**📦 Available Operations & Territories (Page ${currentPage + 1}/${totalPages}):**\n\n`;
    
    pageItems.forEach((item, index) => {
        const itemNumber = startIndex + index + 1;
        
        if (item.type === 'operation') {
            const operation = item.data;
            const canAfford = userBalance >= operation.investment;
            const affordIcon = canAfford ? '✅' : '❌';
            
            description += `**${itemNumber}.** ${operation.emoji} **${operation.name}** ${affordIcon}\n`;
            description += `└ *${operation.description}*\n`;
            description += `└ 💰 Investment: ${operation.investment.toLocaleString()} • Return: ${operation.min_return.toLocaleString()}-${operation.max_return.toLocaleString()}\n`;
            description += `└ ⏱️ ${operation.time_hours}h • ⚠️ ${Math.floor(operation.risk * 100)}% risk\n`;
            description += `└ \`%cartel ${item.id}\` or \`%cartel ${itemNumber}\`\n\n`;
        } else {
            const territory = item.data;
            const canAfford = userBalance >= territory.control_cost;
            const affordIcon = canAfford ? '✅' : '❌';
            
            description += `**${itemNumber}.** ${territory.emoji} **${territory.name}** ${affordIcon}\n`;
            description += `└ *${territory.description}*\n`;
            description += `└ 💰 Control Cost: ${territory.control_cost.toLocaleString()} • Daily: ${territory.daily_income.toLocaleString()}\n`;
            description += `└ 🛡️ Defense: ${territory.defense_requirement} enforcers\n`;
            description += `└ \`%cartel control ${item.id}\`\n\n`;
        }
    });
    
    description += '**🎮 Commands:**\n';
    description += '• `%cartel operations` - View detailed operations\n';
    description += '• `%cartel territories` - Control territory\n';
    description += '• `%cartel empire` - View your cartel status';

    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Drug Cartel Empire')
        .setDescription(description)
        .setColor(0x8b0000)
        .setFooter({ text: `Page ${currentPage + 1}/${totalPages} • Power, money, respect... or prison.` })
        .setTimestamp();

    // Create navigation buttons if multiple pages
    const components = [];
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`cartel_prev_${userId}_${currentPage}`)
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`cartel_next_${userId}_${currentPage}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`cartel_refresh_${userId}`)
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

async function displayOperations(message, userId) {
    const userBalance = getBalance(userId);
    
    let description = '**💊 Available Drug Operations:**\n\n';
    
    Object.entries(DRUG_OPERATIONS).forEach(([opId, operation]) => {
        const inventory = getInventory(userId);
        const hasRequiredItems = operation.required_items.every(item => hasItem(userId, item));
        const canAfford = userBalance >= operation.investment;
        const status = (canAfford && hasRequiredItems) ? '✅ Ready' : '❌ Not Ready';
        
        description += `${operation.emoji} **${operation.name}** ${status}\n`;
        description += `└ ${operation.description}\n`;
        description += `└ 💰 Investment: ${operation.investment.toLocaleString()} coins\n`;
        description += `└ 💵 Return: ${operation.min_return.toLocaleString()} - ${operation.max_return.toLocaleString()} coins\n`;
        description += `└ ⏱️ Time: ${operation.time_hours} hours • ⚠️ Risk: ${Math.floor(operation.risk * 100)}%\n`;
        
        if (operation.required_items.length > 0) {
            description += `└ 🛠️ Required: ${operation.required_items.join(', ')}\n`;
        }
        
        description += `└ \`%cartel ${opId}\`\n\n`;
    });
    
    description += '⚠️ **Warning:** All operations carry risk of DEA raids!\n';
    description += '💡 Get required items from the blackmarket';

    const embed = new EmbedBuilder()
        .setTitle('💊 Drug Operations')
        .setDescription(description)
        .setColor(0x8b0000)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayTerritories(message, userId) {
    let description = '**🗺️ Territory Control:**\n\n';
    description += '*Control territories to generate passive income*\n\n';
    
    Object.entries(TERRITORIES).forEach(([territoryId, territory]) => {
        description += `${territory.emoji} **${territory.name}**\n`;
        description += `└ ${territory.description}\n`;
        description += `└ 💰 Control Cost: ${territory.control_cost.toLocaleString()} coins\n`;
        description += `└ 💵 Daily Income: ${territory.daily_income.toLocaleString()} coins\n`;
        description += `└ 🛡️ Defense Required: ${territory.defense_requirement} enforcers\n`;
        description += `└ \`%cartel control ${territoryId}\`\n\n`;
    });
    
    description += '💡 **Tips:**\n';
    description += '• Hire enforcers to defend territories\n';
    description += '• Territories generate daily passive income\n';
    description += '• Rival cartels may try to take your territory';

    const embed = new EmbedBuilder()
        .setTitle('🗺️ Territory Control')
        .setDescription(description)
        .setColor(0x8b0000)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleOperation(message, userId, operationId) {
    const operation = DRUG_OPERATIONS[operationId];
    
    if (!operation) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid operation! Use `%cartel operations` to see available operations.')
                    .setColor(0xff0000)
            ]
        });
    }

    const userBalance = getBalance(userId);
    
    if (userBalance < operation.investment) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Required:** ${operation.investment.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if user has required items
    const missingItems = operation.required_items.filter(item => !hasItem(userId, item));
    if (missingItems.length > 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You're missing required items!\n\n🛠️ **Missing:** ${missingItems.join(', ')}\n\n💡 Get these from the blackmarket!`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Set cooldown
    cartelCooldowns[userId] = Date.now();
    
    // Deduct investment
    subtractBalance(userId, operation.investment);
    
    // Consume required items
    operation.required_items.forEach(item => {
        removeItem(userId, item, 1);
    });

    // Calculate success/failure
    const success = Math.random() > operation.risk;
    
    if (!success) {
        // Operation failed - DEA raid
        try {
            const { arrestUser } = require('./utils/crime-manager');
            const arrestTime = 60 + Math.random() * 120; // 60-180 minutes
            const bailAmount = Math.floor(operation.investment * 3);
            
            arrestUser(userId, arrestTime * 60 * 1000, 'Drug Trafficking', bailAmount);
            
            const embed = new EmbedBuilder()
                .setTitle('🚨 DEA RAID!')
                .setDescription(`**FEDERAL BUST!** Your ${operation.emoji} **${operation.name}** was raided by the DEA!\n\n🚔 **ARRESTED** for ${Math.floor(arrestTime)} minutes!\n💸 **Bail Amount:** ${bailAmount.toLocaleString()} coins\n💰 **Investment Lost:** ${operation.investment.toLocaleString()} coins\n🛠️ **Items Lost:** ${operation.required_items.join(', ')}\n\n*Someone snitched to the feds...*\n\nUse \`%bail\` to pay bail or wait for help!`)
                .setColor(0xff0000)
                .setTimestamp();

            return await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            // If crime manager not available, just lose investment
            const embed = new EmbedBuilder()
                .setTitle('💥 OPERATION FAILED!')
                .setDescription(`Your ${operation.emoji} **${operation.name}** was compromised!\n\n💰 **Investment Lost:** ${operation.investment.toLocaleString()} coins\n🛠️ **Items Lost:** ${operation.required_items.join(', ')}\n\n*The operation went sideways...*`)
                .setColor(0xff0000)
                .setTimestamp();

            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }

    // Operation succeeded!
    const profit = Math.floor(operation.min_return + Math.random() * (operation.max_return - operation.min_return));
    addBalance(userId, profit);
    
    // Chance for bonus items
    if (Math.random() < 0.25) {
        const bonusItems = ['corrupt_contacts', 'cartel_connections', 'vehicles'];
        const bonusItem = bonusItems[Math.floor(Math.random() * bonusItems.length)];
        addItem(userId, bonusItem, 1);
    }

    const netProfit = profit - operation.investment;
    const embed = new EmbedBuilder()
        .setTitle('💊 OPERATION SUCCESS!')
        .setDescription(`${operation.emoji} **${operation.name}** completed successfully!\n\n💰 **Investment:** ${operation.investment.toLocaleString()} coins\n💵 **Return:** ${profit.toLocaleString()} coins\n📈 **Net Profit:** ${netProfit.toLocaleString()} coins\n⏱️ **Time:** ${operation.time_hours} hours\n🛠️ **Items Used:** ${operation.required_items.join(', ') || 'None'}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n*The product moved successfully through your network!*`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleNumberedOperation(message, userId, operationNumber) {
    const operations = Object.keys(DRUG_OPERATIONS);
    
    if (operationNumber < 1 || operationNumber > operations.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid operation number! Choose 1-${operations.length}.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const operationId = operations[operationNumber - 1];
    return await handleOperation(message, userId, operationId);
}

async function displayCartelEmpire(message, userId) {
    const userBalance = getBalance(userId);
    // This would integrate with a cartel data system to show controlled territories, etc.
    
    let description = '**🏴‍☠️ Your Cartel Empire:**\n\n';
    description += `💰 **Current Balance:** ${userBalance.toLocaleString()} coins\n`;
    description += `🗺️ **Controlled Territories:** 0 (Coming Soon)\n`;
    description += `👥 **Cartel Members:** 1 (You)\n`;
    description += `💊 **Operations Completed:** Track with future updates\n\n`;
    description += '*Build your empire through drug operations and territory control!*';

    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Cartel Empire Status')
        .setDescription(description)
        .setColor(0x8b0000)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

// Export functions for interaction handlers
module.exports.displayCartelMenu = displayCartelMenu;
