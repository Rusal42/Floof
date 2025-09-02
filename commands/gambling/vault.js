const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { formatVaultDisplay, deposit, withdraw, upgradeVault, completeVaultUpgrade, getVaultInfo } = require('./utils/vault-manager');

module.exports = {
    name: 'vault',
    description: 'Manage your secure vault for protected coin storage',
    usage: '%vault [deposit/withdraw/upgrade] [amount]',
    category: 'gambling',
    aliases: ['bank', 'safe'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot access your vault for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (args.length === 0) {
            // Display vault info
            return await displayVault(message, userId);
        }

        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'deposit':
            case 'dep':
                return await handleDeposit(message, userId, args[1]);
            case 'withdraw':
            case 'with':
                return await handleWithdraw(message, userId, args[1]);
            case 'upgrade':
            case 'up':
                return await handleUpgrade(message, userId);
            default:
                return await displayVault(message, userId);
        }
    }
};

async function displayVault(message, userId) {
    try {
        const vaultDisplay = formatVaultDisplay(userId);
        
        const embed = new EmbedBuilder()
            .setTitle(`🏦 ${message.author.username}'s Vault`)
            .setDescription(vaultDisplay)
            .setColor(0x2ecc71)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Vault coins are protected from theft! • %vault deposit/withdraw/upgrade' })
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    } catch (error) {
        console.error('Vault display error:', error);
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Failed to load vault information.')
                    .setColor(0xff0000)
            ]
        });
    }
}

async function handleDeposit(message, userId, amountStr) {
    if (!amountStr) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify an amount to deposit!\nExample: `%vault deposit 1000`')
                    .setColor(0xff0000)
            ]
        });
    }

    let amount;
    if (amountStr.toLowerCase() === 'all') {
        amount = getBalance(userId);
    } else {
        amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please provide a valid amount to deposit!')
                        .setColor(0xff0000)
                ]
            });
        }
    }

    const currentBalance = getBalance(userId);
    if (amount > currentBalance) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have enough coins! You have **${currentBalance.toLocaleString()}** coins.`)
                    .setColor(0xff0000)
            ]
        });
    }

    const result = deposit(userId, amount);
    
    if (!result.success) {
        let errorMsg = '';
        switch (result.reason) {
            case 'no_vault':
                errorMsg = '❌ You need to buy a vault first! Use `%vault upgrade` to purchase one.';
                break;
            case 'capacity_exceeded':
                errorMsg = `❌ Vault capacity exceeded! You can only deposit **${result.max_deposit.toLocaleString()}** more coins.`;
                break;
            default:
                errorMsg = '❌ Failed to deposit coins.';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    // Deduct from balance
    subtractBalance(userId, amount);
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Deposit Successful!')
        .setDescription(`Successfully deposited **${amount.toLocaleString()}** coins into your vault!\n\n🏦 **Vault Balance:** ${result.new_balance.toLocaleString()} coins\n💳 **Wallet Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleWithdraw(message, userId, amountStr) {
    if (!amountStr) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify an amount to withdraw!\nExample: `%vault withdraw 1000`')
                    .setColor(0xff0000)
            ]
        });
    }

    const vaultInfo = getVaultInfo(userId);
    let amount;
    
    if (amountStr.toLowerCase() === 'all') {
        amount = vaultInfo.balance;
    } else {
        amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please provide a valid amount to withdraw!')
                        .setColor(0xff0000)
                ]
            });
        }
    }

    const result = withdraw(userId, amount);
    
    if (!result.success) {
        let errorMsg = '';
        switch (result.reason) {
            case 'no_vault':
                errorMsg = '❌ You need to buy a vault first!';
                break;
            case 'insufficient_funds':
                errorMsg = `❌ Insufficient vault funds! You have **${result.available.toLocaleString()}** coins in your vault.`;
                break;
            default:
                errorMsg = '❌ Failed to withdraw coins.';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    // Add to balance
    addBalance(userId, amount);
    
    const embed = new EmbedBuilder()
        .setTitle('💳 Withdrawal Successful!')
        .setDescription(`Successfully withdrew **${amount.toLocaleString()}** coins from your vault!\n\n🏦 **Vault Balance:** ${result.new_balance.toLocaleString()} coins\n💳 **Wallet Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleUpgrade(message, userId) {
    const upgradeInfo = upgradeVault(userId);
    
    if (!upgradeInfo.success) {
        if (upgradeInfo.reason === 'max_tier') {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('👑 Your vault is already at maximum tier!')
                        .setColor(0xffd700)
                ]
            });
        }
    }

    const currentBalance = getBalance(userId);
    const cost = upgradeInfo.cost;
    
    if (currentBalance < cost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('⬆️ Vault Upgrade')
                    .setDescription(`**${upgradeInfo.next_tier_info.emoji} ${upgradeInfo.next_tier_info.name}**\n\n💰 **Cost:** ${cost.toLocaleString()} coins\n📊 **Capacity:** ${upgradeInfo.next_tier_info.capacity === Infinity ? 'Unlimited' : upgradeInfo.next_tier_info.capacity.toLocaleString()} coins\n\n❌ **Insufficient funds!** You need **${(cost - currentBalance).toLocaleString()}** more coins.`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Deduct cost and upgrade
    subtractBalance(userId, cost);
    const result = completeVaultUpgrade(userId);
    
    if (result.success) {
        const embed = new EmbedBuilder()
            .setTitle('⬆️ Vault Upgraded!')
            .setDescription(`Successfully upgraded to **${result.tier_info.emoji} ${result.tier_info.name}**!\n\n💰 **Cost:** ${cost.toLocaleString()} coins\n📊 **New Capacity:** ${result.tier_info.capacity === Infinity ? 'Unlimited' : result.tier_info.capacity.toLocaleString()} coins\n💳 **Remaining Balance:** ${getBalance(userId).toLocaleString()} coins`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    } else {
        // Refund if upgrade failed
        addBalance(userId, cost);
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Vault upgrade failed. Your coins have been refunded.')
                    .setColor(0xff0000)
            ]
        });
    }
}
