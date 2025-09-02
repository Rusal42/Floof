// Numbered selection handlers for business command
const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { 
    BUSINESS_TYPES,
    EMPLOYEE_TYPES,
    BODYGUARD_TYPES,
    purchaseBusiness,
    hireEmployee,
    hireBodyguard
} = require('./utils/business-manager');

async function handleNumberedSelection(message, userId, itemNumber, extraArgs) {
    // Default to business purchase if no extra context
    return await handleNumberedBuyBusiness(message, userId, itemNumber);
}

async function handleNumberedBuyBusiness(message, userId, itemNumber) {
    // Get all items from business overview (businesses + employees + bodyguards)
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
    
    if (itemNumber < 1 || itemNumber > allItems.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid item number! Choose between 1 and ${allItems.length}.\n\nUse \`%business\` to see numbered options.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const selectedItem = allItems[itemNumber - 1];
    const { getBalance, subtractBalance } = require('./utils/balance-manager');
    const userBalance = getBalance(userId);
    
    if (selectedItem.type === 'business') {
        const businessId = selectedItem.id;
        const business = selectedItem.data;
        
        if (userBalance < business.purchase_price) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ Insufficient funds!\n\n💰 **Cost:** ${business.purchase_price.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                        .setColor(0xff0000)
                ]
            });
        }
        
        const result = purchaseBusiness(userId, businessId);
        
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
            .setDescription(`${business.emoji} **${business.name.replace(/_/g, ' ')}** acquired!\n\n💰 **Cost:** ${business.purchase_price.toLocaleString()} coins\n📈 **Income:** ${business.daily_income.min.toLocaleString()}-${business.daily_income.max.toLocaleString()} coins/day\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
            .setColor(0x00ff00)
            .setTimestamp();
        
        await sendAsFloofWebhook(message, { embeds: [embed] });
        
    } else if (selectedItem.type === 'employee') {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Cannot hire employees by number alone!\n\nUse \`%business hire [business] [employee]\` to hire staff.`)
                    .setColor(0xff0000)
            ]
        });
        
    } else if (selectedItem.type === 'bodyguard') {
        const bodyguardId = selectedItem.id;
        const bodyguard = selectedItem.data;
        
        if (userBalance < bodyguard.hire_cost) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ Insufficient funds!\n\n💰 **Cost:** ${bodyguard.hire_cost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                        .setColor(0xff0000)
                ]
            });
        }
        
        const result = hireBodyguard(userId, bodyguardId);
        
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
            .setDescription(`${bodyguard.emoji} **${bodyguard.name.replace(/_/g, ' ')}** hired!\n\n💰 **Cost:** ${bodyguard.hire_cost.toLocaleString()} coins\n🛡️ **Protection:** ${(bodyguard.attack_reduction * 100).toFixed(0)}% damage reduction\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
            .setColor(0x00ff00)
            .setTimestamp();
        
        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
}

async function handleNumberedHireEmployee(message, userId, itemNumber) {
    const employeeTypes = Object.keys(EMPLOYEE_TYPES);
    
    if (itemNumber < 1 || itemNumber > employeeTypes.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid employee number! Choose between 1 and ${employeeTypes.length}.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const employeeId = employeeTypes[itemNumber - 1];
    const result = hireEmployee(userId, employeeId);
    
    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ ${result.message}`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const employeeInfo = EMPLOYEE_TYPES[employeeId];
    const embed = new EmbedBuilder()
        .setTitle('👥 Employee Hired!')
        .setDescription(`${employeeInfo.emoji} **${employeeInfo.name}** hired!\n\n💰 **Cost:** ${employeeInfo.cost.toLocaleString()} coins\n📈 **Boost:** +${(employeeInfo.multiplier * 100 - 100).toFixed(0)}% income`)
        .setColor(0x00ff00);
    
    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleNumberedHireBodyguard(message, userId, itemNumber) {
    const bodyguardTypes = Object.keys(BODYGUARD_TYPES);
    
    if (itemNumber < 1 || itemNumber > bodyguardTypes.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid bodyguard number! Choose between 1 and ${bodyguardTypes.length}.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const bodyguardId = bodyguardTypes[itemNumber - 1];
    const result = hireBodyguard(userId, bodyguardId);
    
    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ ${result.message}`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const bodyguardInfo = BODYGUARD_TYPES[bodyguardId];
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Bodyguard Hired!')
        .setDescription(`${bodyguardInfo.emoji} **${bodyguardInfo.name}** hired!\n\n💰 **Cost:** ${bodyguardInfo.cost.toLocaleString()} coins\n🛡️ **Protection:** ${bodyguardInfo.protection}% against attacks`)
        .setColor(0x00ff00);
    
    await sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports = {
    handleNumberedSelection,
    handleNumberedBuyBusiness,
    handleNumberedHireEmployee,
    handleNumberedHireBodyguard
};
