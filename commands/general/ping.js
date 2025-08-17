const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  description: 'Check the bot and server latency',
  usage: '%ping',
  category: 'general',
  aliases: ['latency'],
  cooldown: 3,

  async execute(message) {
    try {
      // Send a provisional message (as the bot) to measure round-trip latency
      const pending = await message.channel.send('🏓 Pinging…');

      const messageLatency = pending.createdTimestamp - message.createdTimestamp; // ms
      const apiPing = Math.max(0, Math.round(message.client.ws.ping)); // ms

      // Uptime
      const uptimeMs = Math.floor(message.client.uptime || 0);
      const uptimeStr = formatDuration(uptimeMs);

      const embed = new EmbedBuilder()
        .setColor('#00ccff')
        .setTitle('🏓 Pong!')
        .addFields(
          { name: '📨 Message Latency', value: `\`${messageLatency}ms\``, inline: true },
          { name: '🛰️ API/WebSocket', value: `\`${apiPing}ms\``, inline: true },
          { name: '⏱️ Uptime', value: `\`${uptimeStr}\``, inline: true }
        )
        .setTimestamp();

      await pending.edit({ content: null, embeds: [embed] });
    } catch (err) {
      console.error('Error running %ping:', err);
      try {
        await message.channel.send('❌ Failed to measure ping.');
      } catch {}
    }
  }
};

function formatDuration(ms) {
  const sec = Math.floor((ms / 1000) % 60);
  const min = Math.floor((ms / (1000 * 60)) % 60);
  const hr = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const day = Math.floor(ms / (1000 * 60 * 60 * 24));
  const parts = [];
  if (day) parts.push(`${day}d`);
  if (hr) parts.push(`${hr}h`);
  if (min) parts.push(`${min}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}
