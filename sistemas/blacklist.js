const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Configurações da Blacklist ---
const BLACKLIST_CHANNEL_ID = '1388934240749490196'; // ID do canal onde a embed fixa ficará
const BLACKLIST_MESSAGE_TITLE = '<a:c_warningrgbFXP:1390000774863519765> LISTA DA BLACKLIST DA POLICIA FEDERAL';
const BLACKLIST_MESSAGE_DESCRIPTION = '<a:seta_gugu1:1398025125537775639> Os membros da lista abaixo estão proibidos de adentrar na corporação sem permissão concedida pelos diretores';
const BLACKLIST_MESSAGE_IMAGE = 'https://cdn.discordapp.com/attachments/1390117626876788877/1401070639548469300/PUNICAO.png?ex=688ef037&is=688d9eb7&hm=37b3b9b34188b0483791d8ce00b017991007c641daa2e3572e269791ca0ba5e5&';

const BLACKLIST_DB_FILE = path.join(__dirname, '../banco/blacklist.json');

// --- Funções de Manipulação do Banco de Dados ---
/**
 * Carrega a lista de blacklist do arquivo JSON.
 * @returns {Array<Object>} Um array de objetos, cada um representando um item da blacklist.
 */
function loadBlacklist() {
    try {
        if (!fs.existsSync(BLACKLIST_DB_FILE)) {
            fs.mkdirSync(path.dirname(BLACKLIST_DB_FILE), { recursive: true });
            fs.writeFileSync(BLACKLIST_DB_FILE, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(BLACKLIST_DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao carregar a blacklist:', e);
        return [];
    }
}

/**
 * Salva a lista de blacklist no arquivo JSON.
 * @param {Array<Object>} blacklist - O array de objetos da blacklist a ser salvo.
 */
function saveBlacklist(blacklist) {
    try {
        fs.writeFileSync(BLACKLIST_DB_FILE, JSON.stringify(blacklist, null, 2));
    } catch (e) {
        console.error('Erro ao salvar a blacklist:', e);
    }
}

// --- Funções de Criação de Componentes UI ---

/**
 * Cria os botões para adicionar e remover da blacklist.
 * @returns {ActionRowBuilder} Uma ActionRow contendo os botões.
 */
function createBlacklistButtons() {
    const addButton = new ButtonBuilder()
        .setCustomId('blacklist_add')
        .setLabel('Adicionar Blacklist')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('<:ban:1398677658614628484>'); // Emoji de ban

    const removeButton = new ButtonBuilder()
        .setCustomId('blacklist_remove')
        .setLabel('Remover Blacklist')
        .setStyle(ButtonStyle.Success)
        .setEmoji('<a:positivo:1397953846063398933>'); // Emoji de positivo

    return new ActionRowBuilder().addComponents(addButton, removeButton);
}

/**
 * Cria a embed da blacklist com os membros atuais.
 * @param {Array<Object>} blacklistArray - O array de membros da blacklist.
 * @returns {EmbedBuilder} A embed formatada.
 */
function createBlacklistEmbed(blacklistArray) {
    const embed = new EmbedBuilder()
        .setTitle(BLACKLIST_MESSAGE_TITLE)
        .setDescription(BLACKLIST_MESSAGE_DESCRIPTION)
        .setImage(BLACKLIST_MESSAGE_IMAGE)
        .setColor('#FF0000') // Cor vermelha para blacklist
        .setTimestamp();

    if (blacklistArray.length > 0) {
        // Formata a lista de membros para a descrição
        const listText = blacklistArray.map((member, index) => {
            return `\`\`${index + 1}.\`\` **Nome:** ${member.name} | **ID:** ${member.id}${member.reason ? ` | **Motivo:** ${member.reason}` : ''}`;
        }).join('\n');
        
        embed.addFields({ name: 'Membros Atualmente na Blacklist:', value: listText.slice(0, 1024) }); // Limita o tamanho do campo
    } else {
        embed.addFields({ name: 'Membros Atualmente na Blacklist:', value: 'Nenhum membro na blacklist no momento.' });
    }

    return embed;
}


// --- Função para Manter a Mensagem Fixa (Verificar e Enviar/Atualizar) ---
/**
 * Verifica se já existe painel fixado da blacklist; se não existir, cria um novo.
 * Se já existir, a função agora NÃO VAI ATUALIZAR AUTOMATICAMENTE.
 * A atualização só ocorrerá após uma ação de adição/remoção ou via o comando /setblacklist.
 * @param {Client} client - O cliente Discord.
 * @param {boolean} forceUpdate - Se true, força a atualização da mensagem existente.
 */
async function maintainBlacklistMessage(client, forceUpdate = false) {
    const blacklistChannel = await client.channels.fetch(BLACKLIST_CHANNEL_ID);
    if (!blacklistChannel || !blacklistChannel.isTextBased()) {
        console.error(`Canal da blacklist (ID: ${BLACKLIST_CHANNEL_ID}) não encontrado ou não é um canal de texto.`);
        return;
    }

    const currentBlacklist = loadBlacklist();
    const newEmbed = createBlacklistEmbed(currentBlacklist);
    const buttonsRow = createBlacklistButtons();

    try {
        const pinnedMessages = await blacklistChannel.messages.fetchPinned();
        const existingPanel = pinnedMessages.find(msg =>
            msg.author.id === client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title?.includes('BLACKLIST')
        );

        if (existingPanel) {
            if (forceUpdate) { // Só atualiza se for forçado (após add/remove ou comando)
                await existingPanel.edit({ embeds: [newEmbed], components: [buttonsRow] });
                console.log('[BLACKLIST] Painel existente atualizado forçadamente.');
            } else {
                console.log('[BLACKLIST] Painel existente encontrado. Nenhuma atualização automática necessária.');
            }
            return;
        }

        // Se não existir, cria novo
        console.log('[BLACKLIST] Nenhum painel encontrado. Criando novo...');
        const sentMessage = await blacklistChannel.send({ embeds: [newEmbed], components: [buttonsRow] });
        await sentMessage.pin('Mensagem principal do sistema de blacklist.');
        console.log('[BLACKLIST] Novo painel de blacklist enviado e fixado.');

    } catch (error) {
        console.error('Erro ao manter a mensagem da blacklist fixa:', error);
    }
}


// --- Exportações do Módulo ---
module.exports = {
    // Comando de barra para configurar a blacklist (se necessário, ou pode ser um comando admin)
    // Este comando pode ser usado para forçar a criação/atualização inicial da embed
    slashCommands: [
        new SlashCommandBuilder()
            .setName('setblacklist')
            .setDescription('Gerencia o sistema de blacklist.')
            .setDefaultMemberPermissions(0) // Apenas administradores
            .toJSON(),
    ],

    // Função de setup (chamada ao iniciar o bot)
    setup: (client) => {
        // Inicializa a blacklist no cliente
        client.blacklist = loadBlacklist();
        // Inicializa uma propriedade no cliente para armazenar o ID da mensagem fixa
        client.blacklistMessageId = null; // Será preenchido por maintainBlacklistMessage

        // Chama a função para manter a mensagem da blacklist ao iniciar o bot
        client.on('ready', async () => {
            console.log('Verificando mensagem da blacklist...');
            // Chamamos sem forceUpdate para que só crie se não existir
            await maintainBlacklistMessage(client, false); 
            // Removemos o setInterval aqui
        });

        // Listener para interações (botões e modais)
        client.on('interactionCreate', async (interaction) => {
            // Lidar com o comando de barra /setblacklist
            if (interaction.isChatInputCommand() && interaction.commandName === 'setblacklist') {
                if (!interaction.memberPermissions.has('Administrator')) {
                    return interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
                }
                await interaction.reply({ content: 'Verificando e atualizando a mensagem da blacklist...', ephemeral: true });
                // Ao usar o comando, forçamos a atualização
                await maintainBlacklistMessage(client, true); 
                return;
            }

            // Lidar com cliques de botão
            if (interaction.isButton()) {
                if (interaction.customId === 'blacklist_add') {
                    // Abrir modal de adição
                    const modal = new ModalBuilder()
                        .setCustomId('blacklist_add_modal')
                        .setTitle('Adicionar Membro à Blacklist');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('blacklist_name')
                        .setLabel('Nome do Membro')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const idInput = new TextInputBuilder()
                        .setCustomId('blacklist_id')
                        .setLabel('ID do Membro (ID)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('blacklist_reason')
                        .setLabel('Motivo (Opcional)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(nameInput),
                        new ActionRowBuilder().addComponents(idInput),
                        new ActionRowBuilder().addComponents(reasonInput)
                    );

                    await interaction.showModal(modal);
                    return;
                }

                if (interaction.customId === 'blacklist_remove') {
                    // Abrir menu de seleção para remoção
                    const currentBlacklist = loadBlacklist();
                    if (currentBlacklist.length === 0) {
                        await interaction.reply({ content: 'A blacklist está vazia. Não há membros para remover.', ephemeral: true });
                        return;
                    }

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('blacklist_remove_select')
                        .setPlaceholder('Selecione um membro para remover')
                        .addOptions(
                            currentBlacklist.map((member, index) => ({
                                label: member.name,
                                description: `ID: ${member.id}${member.reason ? ` | Motivo: ${member.reason}` : ''}`,
                                value: member.id, // Usamos o ID como valor para facilitar a remoção
                            }))
                        );

                    const row = new ActionRowBuilder().addComponents(selectMenu);
                    await interaction.reply({
                        content: 'Selecione o membro que deseja remover da blacklist:',
                        components: [row],
                        ephemeral: true, // Apenas o usuário vê
                    });
                    return;
                }
            }

            // Lidar com submissões de modal
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'blacklist_add_modal') {
                    const name = interaction.fields.getTextInputValue('blacklist_name');
                    const id = interaction.fields.getTextInputValue('blacklist_id');
                    const reason = interaction.fields.getTextInputValue('blacklist_reason');

                    // Validação básica do ID (deve ser um número)
                    if (!/^\d+$/.test(id)) {
                        await interaction.reply({ content: '❌ O ID do membro deve ser um número válido.', ephemeral: true });
                        return;
                    }

                    let currentBlacklist = loadBlacklist();
                    // Verifica se o ID já existe na blacklist
                    if (currentBlacklist.some(member => member.id === id)) {
                        await interaction.reply({ content: `❌ O membro com ID \`${id}\` já está na blacklist.`, ephemeral: true });
                        return;
                    }

                    currentBlacklist.push({ name, id, reason });
                    saveBlacklist(currentBlacklist);
                    await interaction.reply({ content: `✅ Membro **${name}** (ID: \`${id}\`) adicionado à blacklist.`, ephemeral: true });

                    // Atualiza a mensagem fixa da blacklist após a adição
                    await maintainBlacklistMessage(client, true);
                    return;
                }
            }

            // Lidar com seleções de menu (para remover)
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'blacklist_remove_select') {
                    const memberIdToRemove = interaction.values[0];

                    let currentBlacklist = loadBlacklist();
                    const initialLength = currentBlacklist.length;
                    currentBlacklist = currentBlacklist.filter(member => member.id !== memberIdToRemove);

                    if (currentBlacklist.length < initialLength) {
                        saveBlacklist(currentBlacklist);
                        await interaction.update({ content: `✅ Membro com ID \`${memberIdToRemove}\` removido da blacklist.`, components: [], ephemeral: true });

                        // Atualiza a mensagem fixa da blacklist após a remoção
                        await maintainBlacklistMessage(client, true);
                    } else {
                        await interaction.update({ content: '❌ Membro não encontrado na blacklist.', components: [], ephemeral: true });
                    }
                    return;
                }
            }
        });
    },
};