// owner-commands.js
// Commands only the bot owner (by user ID) can run.

const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { EmbedBuilder } = require('discord.js');
const { isOwner } = require('../utils/owner-util');

module.exports = {
    meowlocked: async (message) => {
        if (!isOwner(message.author.id)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Only Floof\'s owner can use this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        const fs = require('fs');
        const path = require('path');
        const { EmbedBuilder } = require('discord.js');
        const { sendAsFloofWebhook } = require('../utils/webhook-util');
        const meowlockPath = path.join(__dirname, '../data/meowlock.json');
        let allLocks = {};
        if (fs.existsSync(meowlockPath)) {
            try {
                const raw = fs.readFileSync(meowlockPath, 'utf8');
                allLocks = JSON.parse(raw || '{}');
            } catch (e) {
                allLocks = {};
            }
        }
        const guildId = message.guild?.id;
        if (!guildId) return message.reply('This command can only be used in a server.');
        const locked = allLocks[guildId] || [];
        if (locked.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No users are currently meowlocked in this server!')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        // Fetch user tags
        const userTags = await Promise.all(
            locked.map(async entry => {
                try {
                    const user = await message.client.users.fetch(entry.id);
                    return `**${user.tag}** (${entry.style})`;
                } catch {
                    return `Unknown User (${entry.id}) (${entry.style})`;
                }
            })
        );
        const embed = new EmbedBuilder()
            .setTitle('Meowlocked Users')
            .setDescription(userTags.join('\n'))
            .setColor(0xB57EDC);
        sendAsFloofWebhook(message, { embeds: [embed] });
    },

    meowlock: async (message, args) => {
        if (!isOwner(message.author.id)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Only Floof\'s owner can use this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        const fs = require('fs');
        const path = require('path');
        const meowlockPath = path.join(__dirname, '../data/meowlock.json');
        
        // Check if we have both user and style
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription('Usage: %meowlock <@user|userID> <meow|nya>')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const userArg = args[0];
        const style = args[1].toLowerCase();

        if (!['nya', 'meow'].includes(style)) {
            const embed = new EmbedBuilder()
                .setDescription('Please specify a style: nya or meow. Usage: %meowlock @user meow')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        let user = message.mentions.users.first();
        
        // If no mention, try to fetch by ID
        if (!user && userArg) {
            try {
                user = await message.client.users.fetch(userArg);
            } catch (e) {
                const embed = new EmbedBuilder()
                    .setDescription('Could not find that user by ID.')
                    .setColor(0xB57EDC);
                return sendAsFloofWebhook(message, { embeds: [embed] });
            }
        }

        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription('Please mention a user or provide a valid user ID.')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Rest of the meowlock logic here
        let allLocks = {};
        if (fs.existsSync(meowlockPath)) {
            try {
                allLocks = JSON.parse(fs.readFileSync(meowlockPath));
            } catch (e) {
                allLocks = {};
            }
        }
        
        const guildId = message.guild?.id;
        if (!guildId) {
            const embed = new EmbedBuilder()
                .setDescription('This command can only be used in a server.')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        
        if (!allLocks[guildId]) allLocks[guildId] = [];
        let locked = allLocks[guildId];
        
        // Remove existing lock for this user if present
        locked = locked.filter(entry => entry.id !== user.id);
        locked.push({ id: user.id, style });
        allLocks[guildId] = locked;
        
        try {
            // Ensure data directory exists
            fs.mkdirSync(path.dirname(meowlockPath), { recursive: true });
            fs.writeFileSync(meowlockPath, JSON.stringify(allLocks, null, 2));
            const embed = new EmbedBuilder()
                .setDescription(`✅ ${user.tag} is now meowlocked with style: ${style}!`)
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (err) {
            console.error('[meowlock] Write failed:', err);
            const embed = new EmbedBuilder()
                .setDescription('Failed to save meowlock data: ' + err.message)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    },
    meowunlock: async (message, userArg) => {
        if (!isOwner(message.author.id)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Only Floof\'s owner can use this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        const fs = require('fs');
        const path = require('path');
        const meowlockPath = path.join(__dirname, '../data/meowlock.json');
        let user = message.mentions.users.first();
        if (!user && userArg) {
            try {
                user = await message.client.users.fetch(userArg);
            } catch (e) {
                return message.reply('Could not find that user by ID.');
            }
        }
        if (!user) {
    const embed = new EmbedBuilder()
        .setDescription('Please mention a user or provide a user ID.')
        .setColor(0xB57EDC);
    return sendAsFloofWebhook(message, { embeds: [embed] });
}
        let allLocks = {};
        if (fs.existsSync(meowlockPath)) {
            try {
                const raw = fs.readFileSync(meowlockPath, 'utf8');
                allLocks = JSON.parse(raw || '{}');
            } catch (e) {
                allLocks = {};
            }
        }
        const guildId = message.guild?.id;
        if (!guildId) return message.reply('This command can only be used in a server.');
        const before = (allLocks[guildId] || []).length;
        if (allLocks[guildId]) {
            allLocks[guildId] = allLocks[guildId].filter(entry => entry.id !== user.id);
        }
        // Ensure data directory exists
        fs.mkdirSync(path.dirname(meowlockPath), { recursive: true });
        fs.writeFileSync(meowlockPath, JSON.stringify(allLocks, null, 2));
        if ((allLocks[guildId] || []).length < before) {
            const embed = new EmbedBuilder()
    .setDescription(`${user.tag} is no longer meowlocked!`)
    .setColor(0xB57EDC);
sendAsFloofWebhook(message, { embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
    .setDescription(`${user.tag} was not meowlocked.`)
    .setColor(0xB57EDC);
sendAsFloofWebhook(message, { embeds: [embed] });
        }
    },
    meowlockclear: async (message) => {
        if (!isOwner(message.author.id)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Only Floof\'s owner can use this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        const fs = require('fs');
        const path = require('path');
        const meowlockPath = path.join(__dirname, '../data/meowlock.json');
        let allLocks = {};
        if (fs.existsSync(meowlockPath)) {
            try {
                const raw = fs.readFileSync(meowlockPath, 'utf8');
                allLocks = JSON.parse(raw || '{}');
            } catch (e) {
                allLocks = {};
            }
        }
        const guildId = message.guild?.id;
        if (!guildId) return message.reply('This command can only be used in a server.');
        if (allLocks[guildId]) {
            delete allLocks[guildId];
            // Ensure data directory exists
            fs.mkdirSync(path.dirname(meowlockPath), { recursive: true });
            fs.writeFileSync(meowlockPath, JSON.stringify(allLocks, null, 2));
        }
        const embed = new EmbedBuilder()
            .setDescription('All meowlocks in this server have been cleared!')
            .setColor(0xB57EDC);
        sendAsFloofWebhook(message, { embeds: [embed] });
    },
    
    // DM-only: clear timeouts across mutual servers. Hidden from server help.
    cleartimeoutsdm: async (message, args) => {
        // Must be in DM and by owner
        if (message.guild) return false; // ignore if used in a server
        if (!isOwner(message.author.id)) return false;

        const reason = Array.isArray(args) && args.length > 0 ? args.join(' ') : 'Owner DM amnesty: clearing active timeouts';
        const { client } = message;

        const perGuild = [];
        let totalCleared = 0;

        for (const guild of client.guilds.cache.values()) {
            // Only process guilds where the owner is a member
            const isMutual = await guild.members.fetch(message.author.id).then(() => true).catch(() => false);
            if (!isMutual) continue;

            let cleared = 0;
            try {
                const members = await guild.members.fetch();
                const now = Date.now();
                const timedOut = members.filter(m => m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > now);
                for (const m of timedOut.values()) {
                    try {
                        await m.timeout(null, reason);
                        cleared++;
                        totalCleared++;
                    } catch {}
                }
                perGuild.push(`• ${guild.name}: cleared ${cleared}`);
            } catch {
                perGuild.push(`• ${guild.name}: error fetching members`);
            }
        }

        const summary = new EmbedBuilder()
            .setTitle('🧹 Cleared Timeouts (DM)')
            .setDescription(perGuild.length ? perGuild.join('\n') : 'No mutual servers found to process.')
            .addFields({ name: 'Total cleared', value: String(totalCleared), inline: true })
            .setColor(0xF1C40F);

        // Respond only in DM
        await message.channel.send({ embeds: [summary] });
        return true;
    },
    
}
;
