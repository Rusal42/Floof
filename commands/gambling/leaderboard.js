// leaderboard.js
// Floof's leaderboard command for top coin holders

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { loadBalances } = require('./utils/balance-manager');

module.exports = {
    name: 'leaderboard',
    description: 'Shows the top coin holders in the server',
    aliases: [],
    permissions: [],
    cooldown: 5,
    
    async execute(message, args) {
        const balances = loadBalances();
        
        // Check if balances exist
        if (!balances || Object.keys(balances).length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('🏆 Floof Casino Leaderboard')
                .setDescription('No coin holders found! Start gambling to appear on the leaderboard!')
                .setColor(0xffd700)
                .setFooter({ text: 'Floof is watching for cheaters... (ฅ^•ﻌ•^ฅ)' })
                .setTimestamp();
                
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }
        
        // Get top 10 balances, sorted descending, excluding Floof bot
        const sorted = Object.entries(balances)
            .filter(([id, bal]) => typeof bal === 'number' && !isNaN(bal))
            .sort((a, b) => b[1] - a[1]);
        
        let desc = '';
        let displayCount = 0;
        
        for (let i = 0; i < sorted.length && displayCount < 10; i++) {
            const [id, bal] = sorted[i];
            
            // Try to get user info to check if it's Floof
            let userTag = null;
            let isFloof = false;
            try {
                const member = await message.guild.members.fetch(id).catch(() => null);
                if (member) {
                    userTag = member.user.tag;
                    // Check if this is Floof bot (username contains "floof")
                    isFloof = member.user.username.toLowerCase().includes('floof');
                }
            } catch {
                userTag = null;
            }
            
            // Skip Floof bot from leaderboard
            if (isFloof) {
                continue;
            }
            
            displayCount++;
            desc += `**${displayCount}.** ${userTag ? `<@${id}> (${userTag})` : `User ID: ${id}`}\n→ **${bal.toLocaleString()}** coins\n`;
        }
        
        if (!desc) desc = 'No coin holders found!';
        
        const embed = new EmbedBuilder()
            .setTitle('🏆 Floof Casino Leaderboard')
            .setDescription(desc)
            .setColor(0xffd700)
            .setFooter({ text: 'Floof is watching for cheaters... (ฅ^•ﻌ•^ฅ)' })
            .setTimestamp();
            
        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
