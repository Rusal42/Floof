const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    BUSINESS_TYPES,
    EMPLOYEE_TYPES,
    BODYGUARD_TYPES,
    getUserBusinessData,
    purchaseBusiness,
    hireEmployee,
    hireBodyguard,
    collectBusinessIncome,
    formatBusinessDisplay,
    calculateSpecificBusinessIncome
} = require('./utils/business-manager');

const {
    handleNumberedSelection,
    handleNumberedBuyBusiness,
    handleNumberedHireEmployee,
    handleNumberedHireBodyguard
} = require('./business-numbered-handlers');

// Business cooldowns
const businessCooldowns = {};

module.exports = {
    name: 'business',
    description: 'Own and manage businesses, hire employees and bodyguards',
    usage: '%business [buy/manage/hire/fire/income/list] | %biz [action]',
    category: 'gambling',
    aliases: ['biz', 'company', 'enterprise', 'bus', 'work', 'buis'],
    cooldown: 10,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot manage businesses for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 10 * 1000; // 10 seconds
        
        if (businessCooldowns[userId] && now < businessCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((businessCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ You're too busy! Wait **${timeLeft}** more seconds.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await displayBusinessOverview(message, userId);
        }

        const action = args[0].toLowerCase();
        
        // Handle numbered selection for any action
        if (!isNaN(parseInt(action))) {
            const itemNumber = parseInt(action);
            return await handleNumberedBuyBusiness(message, userId, itemNumber);
        }
        
        switch (action) {
            case 'buy':
            case 'purchase':
                // Handle buy with number: %business buy 1
                if (args[1] && !isNaN(parseInt(args[1]))) {
                    const itemNumber = parseInt(args[1]);
                    return await handleNumberedBuyBusiness(message, userId, itemNumber);
                }
                return await handleBuyBusiness(message, userId, args.slice(1));
            case 'hire':
                // Handle hire with number: %business hire 1
                if (args[1] && !isNaN(parseInt(args[1]))) {
                    const itemNumber = parseInt(args[1]);
                    return await handleNumberedHireEmployee(message, userId, itemNumber);
                }
                return await handleHireEmployee(message, userId, args.slice(1));
            case 'bodyguard':
            case 'guard':
                // Handle bodyguard with number: %business bodyguard 1
                if (args[1] && !isNaN(parseInt(args[1]))) {
                    const itemNumber = parseInt(args[1]);
                    return await handleNumberedHireBodyguard(message, userId, itemNumber);
                }
                return await handleHireBodyguard(message, userId, args.slice(1));
            case 'collect':
            case 'income':
                return await handleCollectIncome(message, userId, args.slice(1));
            case 'info':
            case 'stats':
                return await displayBusinessInventory(message, userId);
            case 'shop':
            case 'market':
                return await displayBusinessShop(message, userId);
            case 'inventory':
            case 'inv':
                return await displayBusinessInventory(message, userId);
            default:
                return await displayBusinessOverview(message, userId);
        }
    }
};

async function displayBusinessOverview(message, userId, currentPage = 0) {
    const userBalance = getBalance(userId);
    const userData = getUserBusinessData(userId);
    
    // Get all items (businesses + employees + bodyguards)
    const allItems = [];
    
    // Add businesses
    Object.entries(BUSINESS_TYPES).forEach(([businessId, business]) => {
        allItems.push({
            type: 'business',
            id: businessId,
            data: business
        });
    });
    
    // Add employees
    Object.entries(EMPLOYEE_TYPES).forEach(([employeeId, employee]) => {
        allItems.push({
            type: 'employee',
            id: employeeId,
            data: employee
        });
    });
    
    // Add bodyguards
    Object.entries(BODYGUARD_TYPES).forEach(([bodyguardId, bodyguard]) => {
        allItems.push({
            type: 'bodyguard',
            id: bodyguardId,
            data: bodyguard
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
    
    let description = `**🏢 Business Empire Management**\n\n`;
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**📦 Available Options (Page ${currentPage + 1}/${totalPages}):**\n\n`;
    
    pageItems.forEach((item, index) => {
        const itemNumber = startIndex + index + 1;
        
        if (item.type === 'business') {
            const business = item.data;
            const owned = userData.businesses[item.id] ? ' ✅ **OWNED**' : '';
            const canAfford = userBalance >= business.purchase_price;
            const affordIcon = canAfford ? '✅' : '❌';
            
            description += `**${itemNumber}.** ${business.emoji} **${business.name.replace(/_/g, ' ')}** ${affordIcon}${owned}\n`;
            description += `└ *${business.description}*\n`;
            description += `└ 💰 Cost: ${business.purchase_price.toLocaleString()} • Income: ${business.daily_income.min.toLocaleString()}-${business.daily_income.max.toLocaleString()}\n`;
            description += `└ 👥 Max Employees: ${business.max_employees}\n`;
            if (!owned) {
                description += `└ \`%business buy ${itemNumber}\` or \`%business ${itemNumber}\`\n\n`;
            } else {
                description += `└ \`%business collect ${item.id}\`\n\n`;
            }
        } else if (item.type === 'employee') {
            const employee = item.data;
            const canAfford = userBalance >= employee.hire_cost;
            const affordIcon = canAfford ? '✅' : '❌';
            
            description += `**${itemNumber}.** ${employee.emoji} **${employee.name.replace(/_/g, ' ')}** ${affordIcon}\n`;
            description += `└ *${employee.description}*\n`;
            description += `└ 💰 Hire: ${employee.hire_cost.toLocaleString()} • Daily: ${employee.daily_wage.toLocaleString()}\n`;
            description += `└ \`%business hire ${itemNumber}\`\n\n`;
        } else {
            const bodyguard = item.data;
            const canAfford = userBalance >= bodyguard.hire_cost;
            const affordIcon = canAfford ? '✅' : '❌';
            
            description += `**${itemNumber}.** ${bodyguard.emoji} **${bodyguard.name.replace(/_/g, ' ')}** ${affordIcon}\n`;
            description += `└ *${bodyguard.description}*\n`;
            description += `└ 💰 Hire: ${bodyguard.hire_cost.toLocaleString()} • Daily: ${bodyguard.daily_wage.toLocaleString()}\n`;
            description += `└ 🛡️ Protection: ${Math.floor(bodyguard.attack_reduction * 100)}%\n`;
            description += `└ \`%business bodyguard ${itemNumber}\`\n\n`;
        }
    });
    
    description += '**🎮 Commands:**\n';
    description += '• `%business buy <business>` - Purchase business\n';
    description += '• `%business hire <business> <employee>` - Hire staff\n';
    description += '• `%business collect <business>` - Collect income';

    const embed = new EmbedBuilder()
        .setTitle('🏢 Business Empire Management')
        .setDescription(description)
        .setColor(0x2e8b57)
        .setFooter({ text: `Page ${currentPage + 1}/${totalPages} • Build your criminal empire! 💰` })
        .setTimestamp();

    // Create navigation buttons if multiple pages
    const components = [];
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`business_prev_${userId}_${currentPage}`)
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`business_next_${userId}_${currentPage}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`business_refresh_${userId}`)
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

async function displayBusinessShop(message, userId) {
    const userBalance = getBalance(userId);
    const userData = getUserBusinessData(userId);
    
    let description = '**🏢 Business Marketplace**\n\n';
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    
    description += '**🏪 Available Businesses:**\n';
    Object.entries(BUSINESS_TYPES).forEach(([businessId, business]) => {
        const owned = userData.businesses[businessId] ? ' ✅ **OWNED**' : '';
        const canAfford = userBalance >= business.purchase_price;
        const priceDisplay = canAfford ? `💰 ${business.purchase_price.toLocaleString()}` : `❌ ${business.purchase_price.toLocaleString()}`;
        
        description += `${business.emoji} **${business.name.replace(/_/g, ' ')}** - ${priceDisplay}${owned}\n`;
        description += `└ ${business.description}\n`;
        description += `└ 💵 Daily Income: ${business.daily_income.min.toLocaleString()} - ${business.daily_income.max.toLocaleString()}\n`;
        description += `└ 👥 Max Employees: ${business.max_employees}\n`;
        if (!owned) {
            description += `└ \`%business buy ${businessId}\`\n`;
        }
        description += '\n';
    });
    
    description += '**👥 Employee Types:**\n';
    Object.entries(EMPLOYEE_TYPES).forEach(([employeeId, employee]) => {
        description += `${employee.emoji} **${employee.name.replace(/_/g, ' ')}** - 💰 ${employee.hire_cost.toLocaleString()}\n`;
        description += `└ ${employee.description}\n`;
        description += `└ Daily Wage: ${employee.daily_wage.toLocaleString()} coins\n\n`;
    });
    
    description += '**🛡️ Bodyguard Types:**\n';
    Object.entries(BODYGUARD_TYPES).forEach(([bodyguardId, bodyguard]) => {
        description += `${bodyguard.emoji} **${bodyguard.name.replace(/_/g, ' ')}** - 💰 ${bodyguard.hire_cost.toLocaleString()}\n`;
        description += `└ ${bodyguard.description}\n`;
        description += `└ Daily Wage: ${bodyguard.daily_wage.toLocaleString()} coins\n\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle('🏢 Business Marketplace')
        .setDescription(description)
        .setColor(0x2e8b57)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleBuyBusiness(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify business type to buy!\nExample: `%business buy restaurant`\n\nUse `%business shop` to see available businesses.')
                    .setColor(0xff0000)
            ]
        });
    }

    const businessType = args[0].toLowerCase();
    const businessName = args.slice(1).join(' ');
    
    if (!BUSINESS_TYPES[businessType]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Unknown business type! Use `%business shop` to see available businesses.')
                    .setColor(0xff0000)
            ]
        });
    }

    const business = BUSINESS_TYPES[businessType];
    const userBalance = getBalance(userId);
    
    if (userBalance < business.purchase_price) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Cost:** ${business.purchase_price.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    businessCooldowns[userId] = Date.now();
    const result = purchaseBusiness(userId, businessType, businessName);

    if (!result.success) {
        let errorMsg = '❌ ';
        switch (result.reason) {
            case 'already_owned':
                errorMsg += 'You already own this type of business!';
                break;
            default:
                errorMsg += 'Failed to purchase business!';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    subtractBalance(userId, business.purchase_price);

    const embed = new EmbedBuilder()
        .setTitle('🏢 Business Purchased!')
        .setDescription(`${business.emoji} Congratulations! You now own **${businessName || business.name}**!\n\n💰 **Purchase Price:** ${business.purchase_price.toLocaleString()} coins\n💵 **Daily Income:** ${business.daily_income.min.toLocaleString()} - ${business.daily_income.max.toLocaleString()} coins\n👥 **Employee Slots:** ${business.max_employees}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n💡 Hire employees to boost your income!`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleHireEmployee(message, userId, args) {
    if (args.length < 2) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify business and employee type!\nExample: `%business hire restaurant manager`')
                    .setColor(0xff0000)
            ]
        });
    }

    const businessType = args[0].toLowerCase();
    const employeeType = args[1].toLowerCase();
    
    if (!BUSINESS_TYPES[businessType] || !EMPLOYEE_TYPES[employeeType]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid business or employee type! Use `%business shop` to see options.')
                    .setColor(0xff0000)
            ]
        });
    }

    const employee = EMPLOYEE_TYPES[employeeType];
    const userBalance = getBalance(userId);
    
    if (userBalance < employee.hire_cost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Hire Cost:** ${employee.hire_cost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    businessCooldowns[userId] = Date.now();
    const result = hireEmployee(userId, businessType, employeeType);

    if (!result.success) {
        let errorMsg = '❌ ';
        switch (result.reason) {
            case 'no_business':
                errorMsg += 'You don\'t own that type of business!';
                break;
            case 'employee_limit':
                errorMsg += 'That business has reached its employee limit!';
                break;
            case 'already_hired':
                errorMsg += 'You already have that type of employee at this business!';
                break;
            default:
                errorMsg += 'Failed to hire employee!';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    subtractBalance(userId, employee.hire_cost);

    const embed = new EmbedBuilder()
        .setTitle('👥 Employee Hired!')
        .setDescription(`${employee.emoji} You hired a **${employee.name}** for your ${BUSINESS_TYPES[businessType].name}!\n\n💰 **Hire Cost:** ${employee.hire_cost.toLocaleString()} coins\n💵 **Daily Wage:** ${employee.daily_wage.toLocaleString()} coins\n📈 **Benefits:** ${employee.description}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleHireBodyguard(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify bodyguard type!\nExample: `%business bodyguard professional_bodyguard`')
                    .setColor(0xff0000)
            ]
        });
    }

    const bodyguardType = args[0].toLowerCase();
    
    if (!BODYGUARD_TYPES[bodyguardType]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid bodyguard type! Use `%business shop` to see options.')
                    .setColor(0xff0000)
            ]
        });
    }

    const bodyguard = BODYGUARD_TYPES[bodyguardType];
    const userBalance = getBalance(userId);
    
    if (userBalance < bodyguard.hire_cost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Hire Cost:** ${bodyguard.hire_cost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    businessCooldowns[userId] = Date.now();
    const result = hireBodyguard(userId, bodyguardType);

    if (!result.success) {
        let errorMsg = '❌ ';
        switch (result.reason) {
            case 'already_hired':
                errorMsg += 'You already have that type of bodyguard!';
                break;
            default:
                errorMsg += 'Failed to hire bodyguard!';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    subtractBalance(userId, bodyguard.hire_cost);

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Bodyguard Hired!')
        .setDescription(`${bodyguard.emoji} You hired a **${bodyguard.name}** for personal protection!\n\n💰 **Hire Cost:** ${bodyguard.hire_cost.toLocaleString()} coins\n💵 **Daily Wage:** ${bodyguard.daily_wage.toLocaleString()} coins\n🛡️ **Protection:** ${Math.floor(bodyguard.attack_reduction * 100)}% attack reduction\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleCollectIncome(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify which business to collect from!\nExample: `%business collect restaurant` or `%business collect all`')
                    .setColor(0xff0000)
            ]
        });
    }

    const businessType = args[0].toLowerCase();
    
    // Handle collect all
    if (businessType === 'all') {
        return await handleCollectAllIncome(message, userId);
    }
    
    if (!BUSINESS_TYPES[businessType]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid business type! Use `%business collect all` to collect from all businesses.')
                    .setColor(0xff0000)
            ]
        });
    }

    businessCooldowns[userId] = Date.now();
    const result = collectBusinessIncome(userId, businessType);

    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You don\'t own that type of business!')
                    .setColor(0xff0000)
            ]
        });
    }

    if (result.net_income <= 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('💸 No income to collect! Your employees are costing more than you\'re earning.\n\nConsider waiting longer between collections or hiring fewer employees.')
                    .setColor(0xffa500)
            ]
        });
    }

    addBalance(userId, result.net_income);

    const business = BUSINESS_TYPES[businessType];
    const embed = new EmbedBuilder()
        .setTitle('💰 Income Collected!')
        .setDescription(`${business.emoji} Collected income from your **${business.name}**!\n\n💵 **Gross Income:** ${result.gross_income.toLocaleString()} coins\n👥 **Employee Wages:** -${result.employee_wages.toLocaleString()} coins\n🛡️ **Bodyguard Wages:** -${result.bodyguard_wages.toLocaleString()} coins\n💰 **Net Income:** ${result.net_income.toLocaleString()} coins\n⏰ **Time Period:** ${result.hours_elapsed} hours\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayBusinessInventory(message, userId) {
    const userBalance = getBalance(userId);
    const userData = getUserBusinessData(userId);
    
    if (!userData.businesses || Object.keys(userData.businesses).length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ **No businesses owned**\n\nUse `%business shop` to start your empire!')
                    .setColor(0xff0000)
            ]
        });
    }
    
    let description = `**🏢 Business Portfolio Management**\n\n`;
    description += `💰 **Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    
    Object.entries(userData.businesses).forEach(([businessId, business]) => {
        const businessInfo = BUSINESS_TYPES[businessId];
        if (!businessInfo) return;
        
        description += `${businessInfo.emoji} **${businessInfo.name.replace(/_/g, ' ')}**\n`;
        
        // Calculate income and next collection time
        const timeSinceLastCollection = Date.now() - (business.last_collected || business.purchased_at);
        const hoursElapsed = Math.floor(timeSinceLastCollection / (1000 * 60 * 60));
        const canCollect = hoursElapsed >= 1;
        const nextCollection = canCollect ? 'Ready to collect!' : `${60 - Math.floor((timeSinceLastCollection % (1000 * 60 * 60)) / (1000 * 60))} minutes`;
        
        // Calculate current income with employees
        const income = calculateSpecificBusinessIncome(userId, businessId);
        
        description += `└ 💰 **Income:** ${income.gross.toLocaleString()} coins/hour\n`;
        description += `└ 💸 **Expenses:** ${income.wages.toLocaleString()} coins/hour\n`;
        description += `└ 📈 **Net Profit:** ${income.net.toLocaleString()} coins/hour\n`;
        description += `└ ⏰ **Collection:** ${canCollect ? '✅' : '⏳'} ${nextCollection}\n`;
        
        // Show employees
        if (business.employees && Object.keys(business.employees).length > 0) {
            description += `└ 👥 **Employees:** `;
            const employeeList = Object.entries(business.employees).map(([empType, count]) => {
                const empInfo = EMPLOYEE_TYPES[empType];
                return `${empInfo.emoji} ${empInfo.name.replace(/_/g, ' ')} (${count})`;
            }).join(', ');
            description += `${employeeList}\n`;
        } else {
            description += `└ 👥 **Employees:** None hired\n`;
        }
        
        // Show risk factor
        const riskFactor = businessInfo.illegal ? 'High' : 'Low';
        const riskEmoji = businessInfo.illegal ? '🔴' : '🟢';
        description += `└ ⚠️ **Risk Factor:** ${riskEmoji} ${riskFactor}\n`;
        
        description += `└ 🎮 \`%business collect ${businessId}\`\n\n`;
    });
    
    // Show bodyguards if any
    if (userData.bodyguards && Object.keys(userData.bodyguards).length > 0) {
        description += `**🛡️ Security Force:**\n`;
        Object.entries(userData.bodyguards).forEach(([type, data]) => {
            const info = BODYGUARD_TYPES[type];
            if (info) {
                description += `└ ${info.emoji} ${info.name.replace(/_/g, ' ')} - ${(info.attack_reduction * 100).toFixed(0)}% protection\n`;
            }
        });
        description += '\n';
    }
    
    description += `**📋 Management Commands:**\n`;
    description += `• \`%business hire [business] [employee]\` - Hire staff\n`;
    description += `• \`%business collect [business]\` - Collect income\n`;
    description += `• \`%business shop\` - Browse marketplace`;

    const embed = new EmbedBuilder()
        .setTitle(`🏢 ${message.author.username}'s Business Empire`)
        .setDescription(description)
        .setColor(0x2e8b57)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Collect income every hour for maximum profit!' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleCollectAllIncome(message, userId) {
    const userData = getUserBusinessData(userId);
    
    if (!userData.businesses || Object.keys(userData.businesses).length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You don\'t own any businesses! Use `%business shop` to buy your first business.')
                    .setColor(0xff0000)
            ]
        });
    }

    let totalCollected = 0;
    let collectionsCount = 0;
    let businessResults = [];

    // Collect from each business
    Object.keys(userData.businesses).forEach(businessId => {
        const result = collectBusinessIncome(userId, businessId);
        
        if (result.success && result.amount > 0) {
            totalCollected += result.amount;
            collectionsCount++;
            const businessInfo = BUSINESS_TYPES[businessId];
            businessResults.push(`${businessInfo.emoji} **${businessInfo.name}**: +${result.amount.toLocaleString()} coins`);
        }
    });

    if (totalCollected === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('💸 No income to collect from any businesses!\n\nEither you\'ve already collected recently or your expenses exceed your income.')
                    .setColor(0xffa500)
            ]
        });
    }

    // Add to balance
    addBalance(userId, totalCollected);

    let description = `Successfully collected from **${collectionsCount}** business${collectionsCount !== 1 ? 'es' : ''}!\n\n`;
    description += businessResults.join('\n');
    description += `\n\n💰 **Total Collected:** ${totalCollected.toLocaleString()} coins`;
    description += `\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`;

    const embed = new EmbedBuilder()
        .setTitle('💰 All Income Collected!')
        .setDescription(description)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

// Export functions for interaction handlers
module.exports.displayBusinessOverview = displayBusinessOverview;
module.exports.displayBusinessInventory = displayBusinessInventory;
