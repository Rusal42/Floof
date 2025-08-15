const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'help',
    description: 'Show help information and available commands',
    usage: '%help [command/category]',
    category: 'general',
    aliases: ['h', 'commands'],
    cooldown: 3,

    async execute(message, args) {
        try {
            const commandHandler = message.client.commandHandler;
            
            if (!args.length) {
                return await this.showMainHelp(message, commandHandler);
            }

            const query = args[0].toLowerCase();
            
            // Check if it's a category
            const categories = ['gambling', 'fun', 'moderation', 'general'];
            if (categories.includes(query)) {
                return await this.showCategoryHelp(message, commandHandler, query);
            }

            // Check if it's a specific command
            const command = commandHandler.commands.get(query) || 
                          commandHandler.commands.find(cmd => cmd.aliases && cmd.aliases.includes(query));
            
            if (command) {
                return await this.showCommandHelp(message, command);
            }

            return await sendAsFloofWebhook(message, {
                content: `❌ No command or category found for "${query}".\n💡 **Tip:** Use \`%help\` to see all categories, or \`%help <category>\` for specific commands.`
            });

        } catch (error) {
            console.error('Help command error:', error);
            return await sendAsFloofWebhook(message, {
                content: '❌ Something went wrong showing help information.\n💡 **New server?** Try `%setup` to get started!'
            });
        }
    },

    async showMainHelp(message, commandHandler) {
        const isNewServer = message.guild.members.cache.size < 50; // Assume small servers are new
        const isAdmin = message.member.permissions.has('ManageGuild');
        
        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🌟 Floof Bot Help')
            .setDescription(isNewServer && isAdmin
                ? '**Welcome to Floof!** As a server admin, here\'s how to set up your server:'
                : isNewServer 
                ? '**Welcome to Floof!** Here\'s everything you need to know to get started:'
                : 'Here are all the available command categories:')
            .setThumbnail(message.client.user.displayAvatarURL({ dynamic: true }));

        // Admin-focused help for new servers
        if (isNewServer && isAdmin) {
            embed.addFields(
                {
                    name: '🔧 **Essential Setup (Admins)**',
                    value: [
                        '• `%config` - Configure channels and settings',
                        '• `%config modlog #channel` - Set mod log channel',
                        '• `%config roles #channel` - Set role selection channel',
                        '• `%config gambling #channel` - Set gambling channel',
                        '• `%setup permissions` - Check bot permissions'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📋 **Quick Server Setup Guide**',
                    value: [
                        '1. **Configure channels**: `%config modlog #mod-logs`',
                        '2. **Set gambling area**: `%config gambling #casino`',
                        '3. **Check permissions**: `%setup permissions`',
                        '4. **Test commands**: Try `%balance` and `%8ball`',
                        '5. **View settings**: `%config view`'
                    ].join('\n'),
                    inline: false
                }
            );
        }

        // Standard command categories
        embed.addFields(
            {
                name: '🎰 **Gambling**',
                value: 'Balance, slots, blackjack, work, and more!\nUse: `%floofgambling`',
                inline: true
            },
            {
                name: '🎉 **Fun**',
                value: '8ball, jokes, cat pics, social commands!\nUse: `%floof`',
                inline: true
            },
            {
                name: '🛡️ **Moderation**',
                value: 'Kick, ban, timeout, warnings, config!\nUse: `%floofmod`',
                inline: true
            },
            {
                name: '🏷️ **Role Management**',
                value: 'Create, delete, assign roles!\nUse: `%floofroles`',
                inline: true
            }
        );

        // Different tips based on user role and server size
        if (isAdmin) {
            embed.addFields({
                name: '👑 **Admin Tips**',
                value: isNewServer 
                    ? '• Start with `%config` to set up channels\n• Use `%config view` to see current settings\n• Set a mod log to track bot actions\n• Configure gambling channel to contain casino commands'
                    : '• Use `%config` to manage server settings\n• Check `%config view` for current configuration\n• Use `%help moderation` for admin commands\n• Set up role selection with `%config roles`',
                inline: false
            });
        } else {
            embed.addFields({
                name: '⚙️ **Getting Started**',
                value: isNewServer 
                    ? '• Try `%balance` to see your starting coins\n• Use `%work` to earn money safely\n• Play `%slots 50` for your first gamble\n• Have fun with `%8ball` or `%cat`!'
                    : '• Use `%help <category>` for specific commands\n• Use `%help <command>` for detailed info\n• Try `%balance` to check your coins\n• Use `%work` to earn money',
                inline: false
            });
        }

        embed.setFooter({ 
            text: isNewServer && isAdmin
                ? 'Server Admin: Start with %config to set up your server!'
                : isNewServer 
                ? 'New to Floof? Try %balance to get started!'
                : 'Use %help <category> or %help <command> for more details'
        });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showCategoryHelp(message, commandHandler, category) {
        if (!commandHandler || !commandHandler.commands) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Command handler not available. Please try again later.'
            });
        }
        
        const commands = commandHandler.commands.filter(cmd => cmd.category === category);
        
        if (!commands.size) {
            return await sendAsFloofWebhook(message, {
                content: `❌ No commands found in category "${category}".`
            });
        }

        const categoryInfo = {
            gambling: { color: '#00FF00', emoji: '🎰', description: 'Earn and spend coins with various games and activities!' },
            fun: { color: '#FFD700', emoji: '🎉', description: 'Entertainment and social commands to liven up your server!' },
            moderation: { color: '#FF0000', emoji: '🛡️', description: 'Keep your server safe with moderation tools!' },
            general: { color: '#FF69B4', emoji: '⚙️', description: 'General utility and help commands!' }
        };

        const info = categoryInfo[category] || { color: '#FF69B4', emoji: '📝', description: 'Various commands' };
        
        const commandList = commands.map(cmd => {
            const aliases = cmd.aliases && cmd.aliases.length ? ` (${cmd.aliases.join(', ')})` : '';
            return `\`%${cmd.name}${aliases}\` - ${cmd.description}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(info.color)
            .setTitle(`${info.emoji} ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
            .setDescription(info.description)
            .addFields({
                name: '📋 **Available Commands**',
                value: commandList.length > 1024 ? commandList.substring(0, 1021) + '...' : commandList,
                inline: false
            })
            .setFooter({ text: `Use %help <command> for detailed information about a specific command` });

        // Add category-specific tips
        if (category === 'gambling') {
            embed.addFields({
                name: '💡 **Getting Started**',
                value: '• Start with `%balance` to see your coins\n• Use `%work` to earn money safely\n• Try `%slots 50` for your first gamble\n• Check `%leaderboard` to see top players',
                inline: false
            });
        } else if (category === 'moderation') {
            const isAdmin = message.member.permissions.has('ManageGuild');
            embed.addFields({
                name: isAdmin ? '👑 **Admin Setup Tips**' : '⚠️ **Important**',
                value: isAdmin 
                    ? '• **Start here**: `%config` to set up your server\n• Set mod log: `%config modlog #channel`\n• Configure roles: `%config roles #channel`\n• Check permissions: `%setup permissions`\n• View settings: `%config view`'
                    : '• Bot needs proper permissions to work\n• Use `%setup permissions` to check\n• Bot can only moderate users below its role\n• All actions are logged',
                inline: false
            });
        }

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showCommandHelp(message, command) {
        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(`📖 Command: ${command.name}`)
            .setDescription(command.description || 'No description available')
            .addFields(
                {
                    name: '📝 **Usage**',
                    value: `\`${command.usage || `%${command.name}`}\``,
                    inline: true
                },
                {
                    name: '📂 **Category**',
                    value: command.category || 'general',
                    inline: true
                },
                {
                    name: '⏱️ **Cooldown**',
                    value: `${command.cooldown || 0} seconds`,
                    inline: true
                }
            );

        if (command.aliases && command.aliases.length) {
            embed.addFields({
                name: '🔗 **Aliases**',
                value: command.aliases.map(alias => `\`%${alias}\``).join(', '),
                inline: false
            });
        }

        if (command.ownerOnly) {
            embed.addFields({
                name: '👑 **Owner Only**',
                value: 'This command can only be used by the bot owner.',
                inline: false
            });
        }

        // Add examples for common commands
        const examples = {
            balance: '`%balance` - Check your balance\n`%balance @user` - Check someone else\'s balance',
            slots: '`%slots 100` - Bet 100 coins on slots\n`%slots all` - Bet all your coins',
            work: '`%work` - Work to earn coins (has cooldown)',
            kick: '`%kick @user Spamming` - Kick user with reason\n`%kick @user` - Kick user without reason'
        };

        if (examples[command.name]) {
            embed.addFields({
                name: '💡 **Examples**',
                value: examples[command.name],
                inline: false
            });
        }

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
