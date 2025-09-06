const { EmbedBuilder } = require('discord.js');
const path = require('path');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'floofgambling',
    description: 'Shows the gambling/casino commands menu',
    usage: '%floofgambling',
    category: 'gambling',
    cooldown: 3,

    async execute(message) {
        const handler = message.client.commandHandler;
        const all = handler?.commands;
        if (!all) {
            return sendAsFloofWebhook(message, { content: '❌ Command handler unavailable.' });
        }

        const isGambleCmd = (cmd) => {
            if (cmd.category && cmd.category.toLowerCase() === 'gambling') return true;
            if (cmd.filePath && cmd.filePath.includes(`${path.sep}commands${path.sep}gambling${path.sep}`)) return true;
            return false;
        };

        const gambleCmds = Array.from(all.values()).filter(isGambleCmd);
        if (!gambleCmds.length) {
            return sendAsFloofWebhook(message, { content: 'No gambling commands found.' });
        }

        // Split commands into categories for better organization
        const coreCommands = gambleCmds.filter(cmd => 
            ['balance', 'beg', 'slots', 'blackjack', 'coinflip', 'roulette', 'baccarat', 'craps', 'keno', 'wheel', 'plinko', 'poker', 'dice', 'war', 'highlow', 'races', 'leaderboard', 'donate'].includes(cmd.name)
        );
        
        const lotteryCommands = gambleCmds.filter(cmd => 
            ['lottery', 'scratch'].includes(cmd.name)
        );
        
        const jobCommands = gambleCmds.filter(cmd => 
            ['work', 'jobs'].includes(cmd.name)
        );
        
        const combatCommands = gambleCmds.filter(cmd => 
            ['beatup', 'rob', 'attack', 'bail'].includes(cmd.name)
        );
        
        const petCommands = gambleCmds.filter(cmd => 
            ['pet', 'petshop', 'petattack', 'petbattle'].includes(cmd.name)
        );
        
        const utilityCommands = gambleCmds.filter(cmd => 
            ['shop', 'inventory', 'networth', 'bodyguards', 'vault', 'preferences', 'briefcase', 'farm', 'beer', 'use'].includes(cmd.name)
        );

        const formatCmdList = (cmds) => cmds
            .map(cmd => `• %${cmd.name}`)
            .join('\n');

        const tips = [
            '💼 **Getting Started:** Use `%work` every 30 seconds to earn coins',
            '🎰 **Classic Games:** Try `%slots 50`, `%blackjack 100`, or `%coinflip heads 25`',
            '🃏 **Card Games:** Play `%poker 500` for Texas Hold\'em or `%war 200` for quick battles',
            '🎲 **Dice & Numbers:** Roll with `%dice 300` or guess with `%highlow 150`',
            '🎫 **Lottery Fun:** Buy tickets with `%lottery buy` or scratch cards with `%scratch bronze`',
            '🛡️ **Protection:** Use `%vault deposit` to store coins safely, or hire bodyguards with `%shop`',
            '⚔️ **Combat:** Attack others with `%attack @user` or defend with pets from `%petshop`',
            '🏪 **Shopping:** Buy weapons, items, and protection from `%shop`, `%blackmarket`, `%petshop`',
            '🏢 **Business:** Own businesses with `%business buy` and collect with `%business collect all`',
            '🐾 **Pets:** Adopt with `%pet buy`, hunt for loot with `%pet hunt`, and train stats',
            '💰 **Check:** `%balance` for coins, `%inventory` for items, `%networth` for total wealth'
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🎰 Floof Gambling Menu')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Getting Started Guide', value: tips },
                { name: '🎲 Core Gambling', value: formatCmdList(coreCommands) || 'None found', inline: true },
                { name: '🎫 Lottery & Tickets', value: formatCmdList(lotteryCommands) || 'None found', inline: true },
                { name: '💼 Jobs & Work', value: formatCmdList(jobCommands) || 'None found', inline: true },
                { name: '⚔️ Combat & Crime', value: formatCmdList(combatCommands) || 'None found', inline: true },
                { name: '🐾 Pets & Battles', value: formatCmdList(petCommands) || 'None found', inline: true },
                { name: '🛒 Shopping & Utils', value: formatCmdList(utilityCommands) || 'None found', inline: true },
                { name: 'Quick Access Menus', value: '• %shop - Browse weapons, ammo, and items\n• %cartel - Drug cartel operations\n• %blackmarket - Underground illegal goods\n• %business - Own and manage businesses\n• %petshop - Buy and manage pets', inline: false }
            )
            .setFooter({ text: 'Tip: All commands work best in your configured gambling channel!' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
