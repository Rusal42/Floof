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
    const businessTypes = Object.keys(BUSINESS_TYPES);
    
    if (itemNumber < 1 || itemNumber > businessTypes.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid business number! Choose between 1 and ${businessTypes.length}.\n\nUse \`%business shop\` to see available businesses.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const businessId = businessTypes[itemNumber - 1];
    const result = purchaseBusiness(userId, businessId);
    
    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ ${result.message}`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const businessInfo = BUSINESS_TYPES[businessId];
    const embed = new EmbedBuilder()
        .setTitle('🏢 Business Purchased!')
        .setDescription(`${businessInfo.emoji} **${businessInfo.name}** acquired!\n\n💰 **Cost:** ${businessInfo.cost.toLocaleString()} coins\n📈 **Income:** ${businessInfo.baseIncome.toLocaleString()} coins/hour`)
        .setColor(0x00ff00);
    
    await sendAsFloofWebhook(message, { embeds: [embed] });
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
