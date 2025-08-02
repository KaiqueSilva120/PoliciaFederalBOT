require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http'); // Importa servidor HTTP

const registrarSlashCommands = require('./comandos/SlashCommands');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();

// Carrega todos os sistemas da pasta /sistemas
const systemsPath = path.join(__dirname, 'sistemas');
const systemFiles = fs.readdirSync(systemsPath).filter(file => file.endsWith('.js'));

for (const file of systemFiles) {
    const system = require(`./sistemas/${file}`);
    if (typeof system.setup === 'function') {
        system.setup(client);
        console.log(`[SISTEMA] ${file} carregado.`);
    }
}

client.once('ready', async () => {
    console.log(`[BOT ONLINE] Logado como ${client.user.tag}`);
    await registrarSlashCommands(client);
});

client.user.setPresence({
    activities: [{
        name: '<:rjp_pf:1362258331770552380> Policia Federal | CMRP',
        type: 0 // Jogando
    }],
    status: 'online'
});


// SERVER HTTP para responder requisições de uptime
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!\n');
}).listen(PORT, () => {
    console.log(`Servidor HTTP rodando na porta ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
