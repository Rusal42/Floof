// owner-floof-interactive.js
// Interactive commands for Floof's owner (buttons, menus, etc)
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');

const OWNER_ID = '1007799027716329484'; // Replace with your actual owner ID if different

module.exports = {
    async pingButton(message) {
        if (message.author.id !== OWNER_ID) {
            return message.reply('Only Floof\'s owner can use this command!');
        }
        const embed = new EmbedBuilder()
            .setTitle('Owner Ping!')
            .setDescription('Press the button below to ping everyone!')
            .setColor(0xB57EDC);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('owner_ping_everyone')
                .setLabel('Ping @everyone')
                .setStyle(ButtonStyle.Danger)
        );
        await sendAsFloofWebhook(message, { embeds: [embed], components: [row] });
    },
    // Add more interactive owner commands here
};
