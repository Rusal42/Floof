const fs = require('fs');
const path = require('path');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

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
    name: 'timeout',
    description: 'Timeout a user for a specified duration',
    usage: '%timeout <@user|userID> <duration> [reason]',
    category: 'moderation',
    aliases: ['mute', 'to'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    ownerOnly: true,
    cooldown: 2,

    async execute(message, args) {
        const OWNER_ID = process.env.OWNER_ID || '1007799027716329484';
        
        if (message.author.id !== OWNER_ID) {
            return await sendAsFloofWebhook(message, { 
                content: 'Nyaa~ Only Floof\'s owner can use this command! (｡•́︿•̀｡)' 
            });
        }

        const guildId = message.guild?.id;
        if (!guildId) {
            return message.reply('This command can only be used in a server.');
        }
        
        globalThis._activeGuildId = guildId;

        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            const embed = new EmbedBuilder()
                .setDescription('You do not have permission to timeout members.')
                .setColor(0x7289da);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription('Please mention a user or provide a user ID and duration. Usage: %timeout @user|userID 60 [reason]')
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

        // Parse duration
        const durationMinutes = parseInt(args[1]);
        if (isNaN(durationMinutes) || durationMinutes <= 0) {
            const embed = new EmbedBuilder()
                .setDescription('Please provide a valid duration in minutes.')
                .setColor(0x7289da);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const durationMs = durationMinutes * 60 * 1000;
        const reason = args.slice(2).join(' ') || 'No reason provided';

        try {
            await user.timeout(durationMs, reason);
            
            // Log timeout as an infraction
            const infractions = loadInfractions();
            if (!infractions[guildId]) infractions[guildId] = {};
            if (!infractions[guildId][user.id]) infractions[guildId][user.id] = [];
            
            infractions[guildId][user.id].push({
                type: 'timeout',
                reason: reason,
                moderator: message.author.id,
                timestamp: new Date().toISOString(),
                duration: durationMinutes
            });
            
            saveInfractions(infractions);

            const embed = new EmbedBuilder()
                .setTitle('⏰ User Timed Out')
                .setDescription(`${user.user.username} has been timed out for **${durationMinutes} minutes**\n**Reason:** ${reason}`)
                .setColor(0xff9900)
                .setTimestamp();
            
            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Timeout error:', error);
            const embed = new EmbedBuilder()
                .setDescription('Failed to timeout the user. They may have higher permissions than me.')
                .setColor(0x7289da);
            await sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
