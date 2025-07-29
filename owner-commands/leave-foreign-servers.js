const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');

module.exports = {
    name: 'leaveservers',
    description: 'Makes the bot leave all servers where the owner is not a member (owner only)',
    ownerOnly: true,

    async execute(message) {
        console.log('leaveservers command executed');
        const { client } = message;
        const ownerId = process.env.OWNER_ID || '1007799027716329484'; // Fallback to your ID if not in .env
        console.log('Owner ID:', ownerId);
        
        // Get all guilds the bot is in
        const guilds = client.guilds.cache;
        console.log('Bot is in', guilds.size, 'guilds');
        
        // Find guilds where the owner is not a member
        const foreignGuilds = [];
        
        // Check each guild to see if the owner is a member
        for (const [guildId, guild] of guilds) {
            try {
                // Fetch the guild with member data
                const fullGuild = await guild.fetch();
                // Try to fetch the member
                await fullGuild.members.fetch(ownerId).catch(() => {
                    // If we get here, the owner is not a member of this guild
                    foreignGuilds.push(guild);
                });
            } catch (error) {
                console.error(`Error checking guild ${guildId}:`, error);
            }
            // Small delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (foreignGuilds.length === 0) {
            return sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('No Foreign Servers')
                        .setDescription('I\'m not in any servers where you\'re not a member! (｡•̀ᴗ-)✧')
                        .setColor(0x43b581)
                ]
            });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        // Create buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_leave')
                    .setLabel('✅ Leave Servers')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_leave')
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Send confirmation message with buttons
        const confirmation = await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('⚠️  Confirm Server Leave')
                    .setDescription(
                        `I found ${foreignGuilds.length} server(s) where you're not a member. ` +
                        'I will leave these servers:\n\n' +
                        foreignGuilds.map(g => `• **${g.name}** (${g.id})`).join('\n') +
                        '\n\nClick the buttons below to confirm or cancel.'
                    )
                    .setColor(0xffd700)
            ],
            components: [row]
        });

        // Create a button collector
        const filter = i => i.user.id === message.author.id && (i.customId === 'confirm_leave' || i.customId === 'cancel_leave');
        
        try {
            const collected = await confirmation.awaitMessageComponent({ 
                filter, 
                time: 60000 // 1 minute to respond
            });

            // Delete the buttons to prevent further interaction
            await confirmation.edit({ components: [] });

            if (collected.customId === 'confirm_leave') {
                // User confirmed, leave the servers
                let successCount = 0;
                const failedGuilds = [];
                
                for (const guild of foreignGuilds) {
                    try {
                        await guild.leave();
                        successCount++;
                        console.log(`Left guild: ${guild.name} (${guild.id})`);
                        // Small delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`Failed to leave guild ${guild.name}:`, error);
                        failedGuilds.push(guild.name);
                    }
                }

                // Send results
                let resultMessage = `✅ Successfully left ${successCount} server(s).`;
                if (failedGuilds.length > 0) {
                    resultMessage += `\n❌ Failed to leave ${failedGuilds.length} server(s): ${failedGuilds.join(', ')}`;
                }

                await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Servers Left')
                            .setDescription(resultMessage)
                            .setColor(0x43b581)
                    ]
                });
            } else if (collected.customId === 'cancel_leave') {
                // User cancelled
                await confirmation.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Operation Cancelled')
                            .setDescription('I won\'t leave any servers. (｡•́︿•̀｡)')
                            .setColor(0x43b581)
                    ],
                    components: []
                });
            }
        } catch (error) {
            // No reaction within the time limit
            await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Timed Out')
                        .setDescription('You took too long to respond. Please try again if you want me to leave those servers.')
                        .setColor(0xffd700)
                ]
            });
        }
    }
};
