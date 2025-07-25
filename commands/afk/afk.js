// AFK Feature: Handles setting, showing, and clearing AFK status for users
const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

// In-memory AFK store
const afkStore = {};

module.exports = {
    name: 'afk',
    description: 'Set your AFK status with an optional reason',
    aliases: [],
    permissions: [],
    cooldown: 3,
    
    async execute(message, args) {
        const reason = args.join(' ') || 'AFK';
        
        afkStore[message.author.id] = {
            reason: reason,
            since: Date.now(),
            tag: message.member?.displayName || message.author.username
        };
        
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('You are now AFK!')
                    .setDescription(`Reason: ${reason}`)
                    .setColor(0x7289da)
                    .setTimestamp()
            ]
        });
    },
    
    // Export utility functions for use by the main bot
    setAfk: async function(message, reason) {
        if (!message || !message.author) return;
        afkStore[message.author.id] = {
            reason: reason || 'AFK',
            since: Date.now(),
            tag: message.member?.displayName || message.author.username
        };
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('You are now AFK!')
                    .setDescription(reason ? `Reason: ${reason}` : 'No reason provided.')
                    .setColor(0x7289da)
                    .setTimestamp()
            ]
        });
    },
    
    showAfk: async function(message, user) {
        if (!message) return;
        let target = user || message.mentions?.users?.first?.() || message.author;
        if (!target || !target.id) target = message.author;
        const afk = afkStore[target.id];
        if (!afk) {
            return;
        }
        const since = `<t:${Math.floor(afk.since / 1000)}:R>`;
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle(`${afk.tag} is AFK`)
                    .setDescription(`Reason: ${afk.reason}\nSince: ${since}`)
                    .setColor(0x7289da)
            ]
        });
    },
    
    afkStore
};
