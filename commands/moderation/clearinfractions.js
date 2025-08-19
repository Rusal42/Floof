const fs = require('fs');
const path = require('path');
const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms } = require('../../utils/permissions');

const infractionsPath = path.join(__dirname, '..', '..', 'data', 'infractions.json');

function saveInfractions(data) {
    // Ensure data directory exists
    fs.mkdirSync(path.dirname(infractionsPath), { recursive: true });
    fs.writeFileSync(infractionsPath, JSON.stringify(data, null, 2));
}

function loadInfractions() {
    if (!fs.existsSync(infractionsPath)) return {};
    const data = JSON.parse(fs.readFileSync(infractionsPath));
    // Migrate legacy format (flat userId keys) to per-guild
    if (data && !Object.keys(data).some(k => k.length === 18 && !isNaN(Number(k)))) {
        // Already per-guild
        return data;
    }
    // Legacy: move all users under current guild
    const migrated = {};
    if (typeof data === 'object' && data !== null) {
        const currentGuildId = globalThis._activeGuildId;
        if (currentGuildId) migrated[currentGuildId] = data;
    }
    return migrated;
}

module.exports = {
    name: 'clearinfractions',
    aliases: ['clearwarnings', 'clearwarns', 'clearinf', 'cw', 'ci'],
    description: 'Clear infractions for a user or all users',
    usage: '%clearinfractions <@user|all>',
    category: 'moderation',
    permissions: [PermissionsBitField.Flags.Administrator],
    cooldown: 5,

    async execute(message, args) {
        const ok = await requirePerms(message, PermissionsBitField.Flags.Administrator, 'clear infractions');
        if (!ok) return;

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please specify a user or "all".\n**Usage:** `%clearinfractions <@user|all>`\n**Examples:** `%clearinfractions @user` or `%clearinfractions all`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const infractions = loadInfractions();
        const guildInfractions = infractions[message.guild.id] || {};

        // Handle "all" option
        if (args[0].toLowerCase() === 'all') {
            const usersWithInfractions = Object.keys(guildInfractions).filter(userId => 
                guildInfractions[userId] && guildInfractions[userId].length > 0
            );

            if (usersWithInfractions.length === 0) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ No infractions found to clear in this server.')
                    .setColor(0xFF0000);
                return sendAsFloofWebhook(message, { embeds: [embed] });
            }

            const totalInfractions = usersWithInfractions.reduce((total, userId) => 
                total + guildInfractions[userId].length, 0
            );

            // Show confirmation prompt
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Clear All Infractions Confirmation')
                .setDescription(`**WARNING: This will permanently delete ALL infractions in this server!**`)
                .setColor(0xFF0000)
                .addFields(
                    {
                        name: '📊 What will be cleared:',
                        value: [
                            `**Users with infractions:** ${usersWithInfractions.length}`,
                            `**Total infractions:** ${totalInfractions}`,
                            `**This action CANNOT be undone**`
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: 'Click a button to confirm or cancel • 30 second timeout' });

            const confirmButton = new ButtonBuilder()
                .setCustomId('clear_all_confirm')
                .setLabel('🗑️ CLEAR ALL')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId('clear_all_cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder()
                .addComponents(confirmButton, cancelButton);

            const confirmMsg = await sendAsFloofWebhook(message, { 
                embeds: [embed], 
                components: [row] 
            });

            // Wait for button interaction
            const filter = (interaction) => {
                return ['clear_all_confirm', 'clear_all_cancel'].includes(interaction.customId) && 
                       interaction.user.id === message.author.id;
            };

            try {
                const interaction = await confirmMsg.awaitMessageComponent({ 
                    filter, 
                    time: 30000 
                });

                if (interaction.customId === 'clear_all_confirm') {
                    // Clear all infractions
                    infractions[message.guild.id] = {};
                    saveInfractions(infractions);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ All Infractions Cleared')
                        .setDescription(`Successfully cleared **${totalInfractions}** infractions for **${usersWithInfractions.length}** users.`)
                        .setColor(0x00FF00)
                        .setFooter({ text: `Cleared by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                        .setTimestamp();

                    await interaction.update({ 
                        embeds: [successEmbed], 
                        components: [] 
                    });
                } else {
                    const cancelEmbed = new EmbedBuilder()
                        .setTitle('❌ Clear All Cancelled')
                        .setDescription('All infractions remain unchanged.')
                        .setColor(0x7289DA);

                    await interaction.update({ 
                        embeds: [cancelEmbed], 
                        components: [] 
                    });
                }
            } catch (error) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Confirmation Timeout')
                    .setDescription('Clear all infractions operation timed out and was cancelled.')
                    .setColor(0x7289DA);

                await sendAsFloofWebhook(message, { embeds: [timeoutEmbed] });
            }

            return;
        }

        // Handle specific user
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please mention a valid user or use "all".')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const userInfractions = guildInfractions[targetUser.id] || [];

        if (userInfractions.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ ${targetUser.tag} has no infractions to clear.`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Clear user infractions
        delete guildInfractions[targetUser.id];
        infractions[message.guild.id] = guildInfractions;
        saveInfractions(infractions);

        const embed = new EmbedBuilder()
            .setTitle('✅ Infractions Cleared')
            .setDescription(`Successfully cleared **${userInfractions.length}** infractions for ${targetUser}.`)
            .addFields(
                { name: '👤 User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                { name: '🗑️ Cleared', value: `${userInfractions.length} infractions`, inline: true }
            )
            .setColor(0x00FF00)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Cleared by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
