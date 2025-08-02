require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

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

client.login(process.env.DISCORD_TOKEN);
