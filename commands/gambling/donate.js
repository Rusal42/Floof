const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance, hasBalance } = require('./utils/balance-manager');

module.exports = {
    name: 'donate',
    description: 'Donate coins to another user',
    usage: '%donate <@user> <amount>',
    category: 'gambling',
    aliases: ['give', 'transfer'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot donate for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (args.length < 2) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Usage: `%donate <@user> <amount>`\nExample: `%donate @Floof 100`')
                        .setColor(0xff0000)
                ]
            });
        }

        // Get target user
        let targetUser;
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
        } else {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please mention a user to donate to!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Can't donate to yourself
        if (targetUser.id === userId) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You cannot donate to yourself!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Can't donate to bots
        if (targetUser.bot) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You cannot donate to bots!')
                        .setColor(0xff0000)
                ]
            });
        }

        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount <= 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please provide a valid positive amount to donate!')
                        .setColor(0xff0000)
                ]
            });
        }

        if (amount > 50000) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Maximum donation is 50,000 coins!')
                        .setColor(0xff0000)
                ]
            });
        }

        if (!hasBalance(userId, amount)) {
            const currentBalance = getBalance(userId);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You don't have enough coins! You have **${currentBalance.toLocaleString()}** coins but tried to donate **${amount.toLocaleString()}** coins.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Perform the transaction
        const senderNewBalance = subtractBalance(userId, amount);
        const receiverNewBalance = addBalance(targetUser.id, amount);

        const embed = new EmbedBuilder()
            .setTitle('💝 Donation Successful!')
            .setDescription(`${message.author} donated **${amount.toLocaleString()}** coins to ${targetUser}!\n\n💰 Your new balance: **${senderNewBalance.toLocaleString()}** coins\n💰 ${targetUser.username}'s new balance: **${receiverNewBalance.toLocaleString()}** coins`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });

        // Try to notify the recipient via DM
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('💝 You received a donation!')
                .setDescription(`${message.author.username} donated **${amount.toLocaleString()}** coins to you in **${message.guild.name}**!\n\n💰 Your new balance: **${receiverNewBalance.toLocaleString()}** coins`)
                .setColor(0x00ff00)
                .setTimestamp();
            
            await targetUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            // User has DMs disabled, that's okay
            console.log(`Could not DM donation notification to ${targetUser.tag}`);
        }
    }
};
