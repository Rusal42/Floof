const { EmbedBuilder } = require('discord.js');
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

// Business cooldowns
const businessCooldowns = {};

module.exports = {
    name: 'business',
    description: 'Own and manage businesses, hire employees and bodyguards',
    usage: '%business [buy/manage/hire/fire/income/list] | %biz [action]',
    category: 'gambling',
    aliases: ['biz', 'company', 'enterprise', 'bus', 'work'],
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
        
        switch (action) {
            case 'buy':
            case 'purchase':
                return await handleBuyBusiness(message, userId, args.slice(1));
            case 'hire':
                return await handleHireEmployee(message, userId, args.slice(1));
            case 'bodyguard':
            case 'guard':
                return await handleHireBodyguard(message, userId, args.slice(1));
            case 'collect':
            case 'income':
                return await handleCollectIncome(message, userId, args.slice(1));
            case 'info':
            case 'stats':
                return await displayBusinessOverview(message, userId);
            case 'shop':
            case 'market':
                return await displayBusinessShop(message, userId);
            default:
                return await displayBusinessOverview(message, userId);
        }
    }
};

async function displayBusinessOverview(message, userId) {
    const businessDisplay = formatBusinessDisplay(userId);
    const userData = getUserBusinessData(userId);
    
    const embed = new EmbedBuilder()
        .setTitle(`🏢 ${message.author.username}'s Business Empire`)
        .setDescription(businessDisplay)
        .setColor(0x2e8b57)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '💼 Commands', value: '`buy` • `hire` • `bodyguard` • `collect` • `shop`', inline: false }
        )
        .setFooter({ text: 'Build your criminal empire! 💰' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
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
        
        description += `${business.emoji} **${business.name}** - ${priceDisplay}${owned}\n`;
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
        description += `${employee.emoji} **${employee.name}** - 💰 ${employee.hire_cost.toLocaleString()}\n`;
        description += `└ ${employee.description}\n`;
        description += `└ Daily Wage: ${employee.daily_wage.toLocaleString()} coins\n\n`;
    });
    
    description += '**🛡️ Bodyguard Types:**\n';
    Object.entries(BODYGUARD_TYPES).forEach(([bodyguardId, bodyguard]) => {
        description += `${bodyguard.emoji} **${bodyguard.name}** - 💰 ${bodyguard.hire_cost.toLocaleString()}\n`;
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
                    .setDescription('❌ Please specify which business to collect from!\nExample: `%business collect restaurant`')
                    .setColor(0xff0000)
            ]
        });
    }

    const businessType = args[0].toLowerCase();
    
    if (!BUSINESS_TYPES[businessType]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid business type!')
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
