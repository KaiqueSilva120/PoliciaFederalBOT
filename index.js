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
client.systems = new Collection(); // Adicionado para armazenar os módulos de sistema

// Carrega todos os sistemas da pasta /sistemas
const systemsPath = path.join(__dirname, 'sistemas');
const systemFiles = fs.readdirSync(systemsPath).filter(file => file.endsWith('.js'));

for (const file of systemFiles) {
    const system = require(`./sistemas/${file}`);
    if (typeof system.setup === 'function') {
        system.setup(client);
        console.log(`[SISTEMA] ${file} carregado.`);
        // Armazena o módulo na coleção de sistemas
        client.systems.set(file.split('.')[0], system);
    }
}

client.once('ready', async () => {
    console.log(`[BOT ONLINE] Logado como ${client.user.tag}`);
    await registrarSlashCommands(client);
});

// --- NOVO: GERENCIADOR DE INTERAÇÕES ---
client.on('interactionCreate', async interaction => {
    // Primeiro, verifique os comandos slash (se houver)
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Houve um erro ao executar este comando!', ephemeral: true });
        }
    }
    
    // Em seguida, passe a interação para cada sistema carregado
    // para verificar se ele pode tratá-la
    for (const [name, system] of client.systems) {
        if (typeof system.handleInteraction === 'function') {
            try {
                const handled = await system.handleInteraction(interaction);
                // Se a interação foi tratada, pare de verificar outros sistemas
                if (handled) {
                    return;
                }
            } catch (error) {
                console.error(`Erro ao lidar com a interação no sistema ${name}:`, error);
            }
        }
    }
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