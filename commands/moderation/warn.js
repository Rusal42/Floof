const fs = require('fs');
const path = require('path');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
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
    name: 'warn',
    description: 'Warn a user and log it as an infraction',
    usage: '%warn <@user|userID> [reason]',
    category: 'moderation',
    aliases: ['warning'],
    cooldown: 2,

    async execute(message, args) {
        const guildId = message.guild?.id;
        if (!guildId) {
            return message.reply('This command can only be used in a server.');
        }
        
        globalThis._activeGuildId = guildId;

        const ok = await requirePerms(message, PermissionsBitField.Flags.ModerateMembers, 'warn members');
        if (!ok) return;

        if (args.length < 1) {
            const embed = new EmbedBuilder()
                .setDescription('Please mention a user or provide a user ID. Usage: %warn @user|userID [reason]')
                .setColor(0x7289da);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Parse user
        let user;
        const userArg = args[0];
        if (userArg.startsWith('<@') && userArg.endsWith('>')) {
            const userId = userArg.slice(2, -1).replace('!', '');
            user = await message.guild.members.fetch(userId).catch(() => null);
        } else {
            user = await message.guild.members.fetch(userArg).catch(() => null);
        }

        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription('User not found. Please mention a valid user or provide a valid user ID.')
                .setColor(0x7289da);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            // Log warning as an infraction
            const infractions = loadInfractions();
            if (!infractions[guildId]) infractions[guildId] = {};
            if (!infractions[guildId][user.id]) infractions[guildId][user.id] = [];
            
            infractions[guildId][user.id].push({
                type: 'warn',
                reason: reason,
                moderator: message.author.id,
                timestamp: new Date().toISOString()
            });
            
            saveInfractions(infractions);

            const embed = new EmbedBuilder()
                .setDescription(`${user} has been warned.\nReason: ${reason}`)
                .setColor(0xffa500);
            
            await sendAsFloofWebhook(message, { embeds: [embed] });

            // Try to DM the user about the warning
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Warning')
                    .setDescription(`You have been warned in **${message.guild.name}**.\nReason: ${reason}`)
                    .setColor(0xffa500)
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                // User has DMs disabled, that's okay
                console.log(`Could not DM warning to ${user.user.tag}`);
            }
        } catch (error) {
            console.error('Warn error:', error);
            const embed = new EmbedBuilder()
                .setDescription('Failed to warn the user. Please try again.')
                .setColor(0x7289da);
            await sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
