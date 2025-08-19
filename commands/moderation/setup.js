const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms } = require('../../utils/permissions');

module.exports = {
    name: 'setup',
    description: 'Setup guide for new servers using Floof bot',
    usage: '%setup [category]',
    category: 'moderation',
    aliases: ['config', 'configure'],
    cooldown: 5,

    async execute(message, args) {
        const ok = await requirePerms(message, PermissionsBitField.Flags.Administrator, 'use setup commands');
        if (!ok) return;

        const category = args[0]?.toLowerCase();

        switch (category) {
            case 'permissions':
                return await this.showPermissions(message);
            case 'gambling':
                return await this.showGambling(message);
            case 'moderation':
                return await this.showModeration(message);
            case 'fun':
                return await this.showFun(message);
            default:
                return await this.showMainSetup(message);
        }
    },

    async showMainSetup(message) {
        const botMember = message.guild.members.me;
        const hasManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
        const hasManageMessages = botMember.permissions.has(PermissionsBitField.Flags.ManageMessages);
        const hasKickMembers = botMember.permissions.has(PermissionsBitField.Flags.KickMembers);
        const hasBanMembers = botMember.permissions.has(PermissionsBitField.Flags.BanMembers);

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🌟 Welcome to Floof Bot Setup!')
            .setDescription('Let\'s get your server configured with Floof!')
            .addFields(
                {
                    name: '📋 **Current Bot Permissions**',
                    value: `${hasManageRoles ? '✅' : '❌'} Manage Roles\n` +
                           `${hasManageMessages ? '✅' : '❌'} Manage Messages\n` +
                           `${hasKickMembers ? '✅' : '❌'} Kick Members\n` +
                           `${hasBanMembers ? '✅' : '❌'} Ban Members`,
                    inline: true
                },
                {
                    name: '🎮 **Available Features**',
                    value: '• **Gambling System** - Balance, slots, blackjack, etc.\n' +
                           '• **Fun Commands** - 8ball, cat pics, jokes, etc.\n' +
                           '• **Moderation** - Kick, ban, timeout, warnings\n' +
                           '• **AFK System** - Auto AFK detection\n' +
                           '• **Custom Features** - Unique to Floof!',
                    inline: true
                },
                {
                    name: '⚙️ **Setup Categories**',
                    value: '`%setup permissions` - Check required permissions\n' +
                           '`%setup gambling` - Configure gambling system\n' +
                           '`%setup moderation` - Setup moderation tools\n' +
                           '`%setup fun` - Enable fun commands',
                    inline: false
                },
                {
                    name: '🚀 **Quick Start**',
                    value: '1. Run `%setup permissions` to check bot permissions\n' +
                           '2. Try `%balance` to test gambling system\n' +
                           '3. Use `%help` to see all available commands\n' +
                           '4. Join our support server for help!',
                    inline: false
                }
            )
            .setFooter({ text: 'Use %setup <category> for detailed setup guides' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showPermissions(message) {
        const botMember = message.guild.members.me;
        const permissions = [
            { name: 'Send Messages', flag: PermissionsBitField.Flags.SendMessages, required: true },
            { name: 'Embed Links', flag: PermissionsBitField.Flags.EmbedLinks, required: true },
            { name: 'Use External Emojis', flag: PermissionsBitField.Flags.UseExternalEmojis, required: false },
            { name: 'Manage Messages', flag: PermissionsBitField.Flags.ManageMessages, required: false, feature: 'Moderation' },
            { name: 'Manage Roles', flag: PermissionsBitField.Flags.ManageRoles, required: false, feature: 'Role Management' },
            { name: 'Kick Members', flag: PermissionsBitField.Flags.KickMembers, required: false, feature: 'Moderation' },
            { name: 'Ban Members', flag: PermissionsBitField.Flags.BanMembers, required: false, feature: 'Moderation' },
            { name: 'Moderate Members', flag: PermissionsBitField.Flags.ModerateMembers, required: false, feature: 'Timeouts' }
        ];

        const permissionStatus = permissions.map(perm => {
            const hasPermission = botMember.permissions.has(perm.flag);
            const status = hasPermission ? '✅' : (perm.required ? '❌' : '⚠️');
            const feature = perm.feature ? ` (${perm.feature})` : '';
            return `${status} ${perm.name}${feature}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🔐 Bot Permissions Check')
            .setDescription('Here\'s what permissions Floof has in your server:')
            .addFields(
                {
                    name: '📋 **Permission Status**',
                    value: permissionStatus,
                    inline: false
                },
                {
                    name: '📖 **Legend**',
                    value: '✅ = Has permission\n❌ = Missing (required)\n⚠️ = Missing (optional)',
                    inline: true
                },
                {
                    name: '🛠️ **How to Fix**',
                    value: '1. Go to Server Settings → Roles\n2. Find "Floof" role\n3. Enable missing permissions\n4. Or re-invite bot with proper permissions',
                    inline: true
                }
            )
            .setFooter({ text: 'Missing permissions will limit bot functionality' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showGambling(message) {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎰 Gambling System Setup')
            .setDescription('Floof\'s gambling system is ready to use out of the box!')
            .addFields(
                {
                    name: '💰 **Basic Commands**',
                    value: '`%balance` - Check your balance\n' +
                           '`%work` - Earn money by working\n' +
                           '`%beg` - Beg for money (with cooldown)\n' +
                           '`%daily` - Get daily bonus',
                    inline: true
                },
                {
                    name: '🎮 **Games**',
                    value: '`%slots` - Slot machine\n' +
                           '`%blackjack` - Play blackjack\n' +
                           '`%coinflip` - Flip a coin\n' +
                           '`%roulette` - Roulette wheel',
                    inline: true
                },
                {
                    name: '📊 **Social Features**',
                    value: '`%leaderboard` - Top richest users\n' +
                           '`%donate @user <amount>` - Give money\n' +
                           '`%gambling` - Gambling menu',
                    inline: false
                },
                {
                    name: '⚙️ **Configuration**',
                    value: '• Balances are saved automatically\n' +
                           '• Each user starts with 1000 coins\n' +
                           '• Cooldowns prevent spam\n' +
                           '• No setup required!',
                    inline: false
                },
                {
                    name: '🎯 **Getting Started**',
                    value: '1. Try `%balance` to see your starting money\n' +
                           '2. Use `%work` to earn more coins\n' +
                           '3. Play `%slots 100` to gamble\n' +
                           '4. Check `%leaderboard` to see rankings',
                    inline: false
                }
            )
            .setFooter({ text: 'All gambling data is saved per server' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showModeration(message) {
        const botMember = message.guild.members.me;
        const canKick = botMember.permissions.has(PermissionsBitField.Flags.KickMembers);
        const canBan = botMember.permissions.has(PermissionsBitField.Flags.BanMembers);
        const canTimeout = botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers);
        const canManageMessages = botMember.permissions.has(PermissionsBitField.Flags.ManageMessages);

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🛡️ Moderation Setup')
            .setDescription('Configure Floof\'s moderation tools for your server')
            .addFields(
                {
                    name: '⚖️ **Available Commands**',
                    value: `${canKick ? '✅' : '❌'} \`%kick @user [reason]\`\n` +
                           `${canBan ? '✅' : '❌'} \`%ban @user [reason]\`\n` +
                           `${canTimeout ? '✅' : '❌'} \`%timeout @user <time>\`\n` +
                           `${canManageMessages ? '✅' : '❌'} \`%purge <amount>\`\n` +
                           `✅ \`%warn @user [reason]\`\n` +
                           `✅ \`%whois @user\` - User info`,
                    inline: true
                },
                {
                    name: '📋 **Permission Status**',
                    value: `${canKick ? '✅' : '❌'} Kick Members\n` +
                           `${canBan ? '✅' : '❌'} Ban Members\n` +
                           `${canTimeout ? '✅' : '❌'} Moderate Members\n` +
                           `${canManageMessages ? '✅' : '❌'} Manage Messages`,
                    inline: true
                },
                {
                    name: '🔧 **Setup Steps**',
                    value: '1. Ensure bot has required permissions\n' +
                           '2. Move Floof role above target roles\n' +
                           '3. Test with `%whois @user`\n' +
                           '4. Configure automod if needed',
                    inline: false
                },
                {
                    name: '⚠️ **Important Notes**',
                    value: '• Bot can only moderate users below its role\n' +
                           '• Warnings are saved per server\n' +
                           '• Use `%av @user` to get user avatars\n' +
                           '• All actions are logged in console',
                    inline: false
                }
            )
            .setFooter({ text: 'Missing permissions will disable some commands' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showFun(message) {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 Fun Commands Setup')
            .setDescription('Floof\'s fun commands work right out of the box!')
            .addFields(
                {
                    name: '🎱 **Interactive Commands**',
                    value: '`%8ball <question>` - Magic 8-ball\n' +
                           '`%roll [sides]` - Roll dice\n' +
                           '`%joke` - Random joke\n' +
                           '`%cat` - Random cat picture',
                    inline: true
                },
                {
                    name: '🤗 **Social Commands**',
                    value: '`%hug @user` - Hug someone\n' +
                           '`%pat @user` - Pat someone\n' +
                           '`%kiss @user` - Kiss someone\n' +
                           '`%slap @user` - Slap someone',
                    inline: true
                },
                {
                    name: '🎭 **Other Fun**',
                    value: '`%bite @user` - Bite someone\n' +
                           '`%dance` - Dance emote\n' +
                           '`%wave @user` - Wave at someone\n' +
                           '`%shoot @user` - Finger guns',
                    inline: false
                },
                {
                    name: '💤 **AFK System**',
                    value: '`%afk [reason]` - Set yourself as AFK\n' +
                           '• Auto-removes AFK when you speak\n' +
                           '• Shows AFK status when mentioned\n' +
                           '• Works across all channels',
                    inline: false
                },
                {
                    name: '✨ **No Setup Required!**',
                    value: 'All fun commands work immediately. Just try them out!\n' +
                           'Use `%help fun` to see all available fun commands.',
                    inline: false
                }
            )
            .setFooter({ text: 'Fun commands have built-in cooldowns to prevent spam' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
