// release.js
// Owner-only command to release users from arrest

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

// Use environment variable for owner ID
const OWNER_ID = process.env.OWNER_ID || '1007799027716329484';

module.exports = {
    name: 'release',
    description: 'Release a user from arrested state (Owner only)',
    usage: '%release [@user]',
    category: 'gambling',
    ownerOnly: true,
    cooldown: 0,

    async execute(message, args) {
        // Check if user is owner
        if (message.author.id !== OWNER_ID) {
            return sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('Owner Only')
                    .setDescription('This command is for the bot owner only!')
                    .setColor(0xff0000)
            ] });
        }

        // Get target user
        let targetUser = message.mentions.users.first();
        if (!targetUser && args[0]) {
            try {
                targetUser = await message.client.users.fetch(args[0]);
            } catch (error) {
                // User not found
            }
        }

        if (!targetUser) {
            return sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('Release User')
                    .setDescription('Please mention a user or provide their ID to release from arrest.')
                    .setColor(0xffd700)
            ] });
        }

        // Import arrested users from beatup.js
        try {
            const { isArrested, releaseUser } = require('./beatup');

            if (!isArrested(targetUser.id)) {
                return sendAsFloofWebhook(message, { embeds: [
                    new EmbedBuilder()
                        .setTitle('Release User')
                        .setDescription(`<@${targetUser.id}> is not currently arrested!`)
                        .setColor(0xffd700)
                ] });
            }

            // Release the user
            releaseUser(targetUser.id);

            // Confirmation to owner
            return sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('🔓 User Released')
                    .setDescription(`<@${targetUser.id}> has been released from arrest!\n\n✅ They can now use gambling commands again.`)
                    .setColor(0x43b581)
            ] });
        } catch (error) {
            return sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('Error')
                    .setDescription('Could not access arrest system. Make sure beatup.js exists and exports the required functions.')
                    .setColor(0xff0000)
            ] });
        }
    }
};
