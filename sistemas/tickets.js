const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// --- Configurações Importantes ---
const GUILD_ID = 'SEU_GUILD_ID'; // ID do seu servidor
const ATENDIMENTO_CHANNEL_ID = '1388925478491918427';
const CATEGORIA_TICKET_ID = '1395966687463079986';
const GESTAO_ROLE_ID = '1389346922300571739'; // ID do cargo da equipe de gestão
const LOG_CHANNEL_ID = '1398679082853728456';

// Caminho para o arquivo de tickets (será criado na pasta 'banco' na raiz do projeto)
const TICKETS_FILE = path.resolve(__dirname, '..', 'banco', 'tickets.json');

// --- Variáveis Globais ---
let tickets = {}; // Objeto para armazenar os tickets abertos em memória

// --- Funções Auxiliares ---

/**
 * Converte o tipo de ticket para um formato mais legível para exibição.
 * Ex: "suporte-geral" -> "Suporte Geral"
 * @param {string} type - O tipo de ticket no formato kebab-case.
 * @returns {string} O tipo de ticket formatado.
 */
function formatTicketType(type) {
    return type.split('-')
               .map(word => word.charAt(0).toUpperCase() + word.slice(1))
               .join(' ');
}

/**
 * Carrega os tickets existentes do arquivo JSON.
 */
function loadTickets() {
    try {
        if (fs.existsSync(TICKETS_FILE)) {
            tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
            console.log('[SISTEMA DE TICKETS] Tickets carregados do arquivo.');
        } else {
            console.log('[SISTEMA DE TICKETS] Arquivo de tickets não encontrado, iniciando com tickets vazios.');
            saveTickets(); // Cria o arquivo se não existir
        }
    } catch (error) {
        console.error('[SISTEMA DE TICKETS] Erro ao carregar tickets do arquivo:', error);
        tickets = {}; // Em caso de erro, reinicia os tickets para evitar problemas
    }
}

/**
 * Salva o estado atual dos tickets no arquivo JSON.
 */
function saveTickets() {
    try {
        // Garante que a pasta 'banco' existe
        const dir = path.dirname(TICKETS_FILE);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf8');
        console.log('[SISTEMA DE TICKETS] Tickets salvos no arquivo.');
    } catch (error) {
        console.error('[SISTEMA DE TICKETS] Erro ao salvar tickets no arquivo:', error);
    }
}

/**
 * Envia a mensagem de atendimento fixa no canal especificado.
 * Verifica se a mensagem já existe para evitar duplicidade.
 * @param {Channel} channel - O canal onde a mensagem deve ser enviada.
 * @param {Client} client - A instância do cliente Discord.
 */
async function sendAtendimentoMessage(channel, client) {
    const embed = new EmbedBuilder()
        .setTitle('<:avisos:1392886752737235127> PAINEL DE ATENDIMENTO — POLICIA FEDERAL')
        .setDescription(
            `<a:fixclandst:1389998676805550182> Selecione abaixo o tipo de atendimento que deseja para abrir seu ticket.\n\n` +
            `<a:lupa:1389604951746941159> Pedimos que tenha paciência e aguarde o atendimento da nossa equipe.`
        )
        .setImage('https://cdn.discordapp.com/attachments/1390117626876788877/1401254085205819474/image.png?ex=688f9b0f&is=688e498f&hm=bd062965fd329add573d5a266f7dff9f00845f7f738b604319a1bda4adb1ba2d&')
        .setThumbnail(client.guilds.cache.get(GUILD_ID)?.iconURL() || 'https://via.placeholder.com/150'); // Tenta pegar o ícone do servidor, senão usa placeholder

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder('Selecione o tipo de Atendimento')
        .addOptions([
            {
                label: 'Suporte Geral',
                description: 'Esclareça dúvidas e solicite suporte',
                value: 'suporte-geral',
                emoji: { id: '1389400108625432686' }
            },
            {
                label: 'Bugs',
                description: 'Reporte Bugs ou problemas com o BOT',
                value: 'bugs',
                emoji: { id: '1398677017662062623' }
            },
            {
                label: 'Upamentos',
                description: 'Informe-se sobre upamentos',
                value: 'upamentos',
                emoji: { id: '1389391852909625377' }
            },
            {
                label: 'Denuncie Membros',
                description: 'Denuncie membros da corporação',
                value: 'denuncia-membros',
                emoji: { id: '1398677658614628484' }
            }
        ]);

    const actionRow = new ActionRowBuilder()
        .addComponents(selectMenu);

    await channel.send({ embeds: [embed], components: [actionRow] });
}

/**
 * Fecha um ticket, transcreve a conversa e envia para o canal de log e DM do usuário.
 * @param {TextChannel} channel - O canal do ticket a ser fechado.
 * @param {object} ticketInfo - As informações do ticket.
 * @param {GuildMember} closerMember - O membro que está fechando o ticket.
 * @param {string|null} closeReason - O motivo do fechamento, se houver.
 * @param {Client} client - A instância do cliente Discord.
 */
async function closeTicket(channel, ticketInfo, closerMember, closeReason = null, client) {
    try {
        await channel.send('Fechando ticket em 10 segundos...');

        // Deleta as permissões para o canal sumir para o usuário
        await channel.permissionOverwrites.edit(ticketInfo.ownerId, {
            ViewChannel: false
        });

        setTimeout(async () => {
            // Gera a transcrição
            const transcriptContent = ticketInfo.transcript.map(msg =>
                `[${new Date(msg.timestamp).toLocaleString('pt-BR')}] ${msg.author}: ${msg.content}`
            ).join('\n');

            const owner = await client.users.fetch(ticketInfo.ownerId).catch(() => null);
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

            const transcriptEmbed = new EmbedBuilder()
                .setTitle(`Transcrição do Ticket: ${formatTicketType(ticketInfo.type)} - ${owner ? owner.username : 'Desconhecido'}`)
                .setDescription(
                    `Olá, seu ticket foi encerrado. Abaixo estão os detalhes do atendimento.\n\n` +
                    `<a:fixclandst:1389998676805550182> Tipo de Ticket: ${formatTicketType(ticketInfo.type)}\n` +
                    (closeReason ? `<a:info:1390483277240074262> Motivo: ${closeReason}\n` : '') +
                    `<a:lupa:1389604951746941159> ID do Ticket: \`${channel.id}\`\n` + // ID com backticks
                    `<:azul:1389374322933764186> Autor do Ticket: ${owner ? `<@${owner.id}> (${owner.tag})` : 'Desconhecido'}\n` +
                    `<:ban:1398677658614628484> Encerrado Por: <@${closerMember.id}> (${closerMember.user.tag})\n` +
                    `<a:agenda:1389604688894099472> Data e Hora de Encerramento: ${new Date().toLocaleString('pt-BR')}`
                )
                .setFooter({ text: `Polícia Federal Ticket | ${new Date().toLocaleDateString('pt-BR')}` })
                .setThumbnail(client.user.displayAvatarURL());

            // Envia a transcrição para o canal de log
            if (logChannel) {
                await logChannel.send({ embeds: [transcriptEmbed], files: [{ attachment: Buffer.from(transcriptContent), name: `transcript-${channel.id}.txt` }] }).catch(console.error);
            }

            // Envia a transcrição para a DM do dono do ticket
            if (owner) {
                try {
                    await owner.send({ embeds: [transcriptEmbed], files: [{ attachment: Buffer.from(transcriptContent), name: `transcript-${channel.id}.txt` }] });
                } catch (dmError) {
                    console.warn(`[SISTEMA DE TICKETS] Não foi possível enviar a DM para ${owner.tag}:`, dmError);
                }
            }

            // Deleta o ticket do registro e do canal
            delete tickets[channel.id];
            saveTickets();
            await channel.delete().catch(console.error);

        }, 10000); // 10 segundos
    } catch (error) {
        console.error('[SISTEMA DE TICKETS] Erro ao fechar o ticket:', error);
    }
}

// --- Módulo Principal do Sistema de Tickets ---

/**
 * Função de setup para inicializar e gerenciar o sistema de tickets.
 * Exportada para ser carregada pelo index.js.
 * @param {Client} client - A instância do cliente Discord.
 */
function setup(client) {
    // Adicione os intents necessários, caso não estejam no client principal
    if (!client.options.intents.has(GatewayIntentBits.DirectMessages)) {
        client.options.intents.add(GatewayIntentBits.DirectMessages);
    }
    if (!client.options.partials.includes(Partials.Channel)) {
        client.options.partials.push(Partials.Channel);
    }
    if (!client.options.partials.includes(Partials.Message)) {
        client.options.partials.push(Partials.Message);
    }
    if (!client.options.partials.includes(Partials.User)) {
        client.options.partials.push(Partials.User);
    }

    loadTickets(); // Carrega os tickets ao iniciar o módulo

    // Evento de ready: Configura a mensagem fixa de atendimento
    client.once('ready', async () => {
        console.log(`[SISTEMA DE TICKETS] Iniciado para ${client.user.tag}!`);
        const channel = await client.channels.fetch(ATENDIMENTO_CHANNEL_ID).catch(() => null);
        if (!channel) return console.error('[SISTEMA DE TICKETS] Canal de atendimento não encontrado. Verifique o ID.');

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        const fixedMessage = messages ? messages.find(msg =>
            msg.embeds.length > 0 && msg.embeds[0].title === '<:avisos:1392886752737235127> PAINEL DE ATENDIMENTO — POLICIA FEDERAL'
        ) : null;

        if (fixedMessage) {
            console.log('[SISTEMA DE TICKETS] Mensagem fixa de atendimento já existe. Não farei nada.');
        } else {
            console.log('[SISTEMA DE TICKETS] Mensagem fixa de atendimento não encontrada. Enviando...');
            await sendAtendimentoMessage(channel, client);
        }
    });

    // Evento de interação: Lida com seleções do menu e envios de modal/botões
    client.on('interactionCreate', async interaction => {
        // --- Filtragem Rigorosa para Isolamento ---

        // 1. Interação de Menu de Seleção (Apenas para o menu de criação de ticket)
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            const selectedOption = interaction.values[0];

            const modal = new ModalBuilder()
                .setCustomId(`ticket_modal_${selectedOption}`)
                .setTitle('Informe o motivo:');

            const reasonInput = new TextInputBuilder()
                .setCustomId('ticket_reason')
                .setLabel('Qual o motivo do seu atendimento?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
            return; // Importante: Retorna para não processar em outros blocos
        }

        // 2. Interação de Modal (Apenas para modais específicos de tickets)
        if (interaction.isModalSubmit()) {
            // Verifica se o customId do modal corresponde a um dos modais de ticket
            if (interaction.customId.startsWith('ticket_modal_') ||
                interaction.customId === 'close_ticket_reason_modal' ||
                interaction.customId === 'add_member_modal' ||
                interaction.customId === 'remove_member_modal')
            {
                // Abertura de Ticket
                if (interaction.customId.startsWith('ticket_modal_')) {
                    const ticketType = interaction.customId.replace('ticket_modal_', '');
                    const reason = interaction.fields.getTextInputValue('ticket_reason');

                    const guild = interaction.guild;
                    const member = interaction.member;

                    const channelName = `${ticketType}-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

                    try {
                        const ticketChannel = await guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: CATEGORIA_TICKET_ID,
                            permissionOverwrites: [
                                {
                                    id: guild.id,
                                    deny: [PermissionsBitField.Flags.ViewChannel],
                                },
                                {
                                    id: member.id,
                                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                                },
                                {
                                    id: GESTAO_ROLE_ID,
                                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                                },
                            ],
                        });

                        tickets[ticketChannel.id] = {
                            channelId: ticketChannel.id,
                            ownerId: member.id,
                            type: ticketType,
                            reason: reason,
                            createdAt: new Date().toISOString(),
                            transcript: []
                        };
                        saveTickets();

                        const ticketEmbed = new EmbedBuilder()
                            .setTitle(`> <:azul:1389374322933764186> TICKET - ${formatTicketType(ticketType)}`)
                            .setDescription(
                                `<a:lupa:1389604951746941159> **Motivo Informado:** ${reason}\n\n` +
                                `<a:seta_gugu1:1398025125537775639> O atendimento foi iniciado. A Corregedoria Federal analisará seu pedido em breve.\n\n` +
                                `> Enquanto aguarda, fique atento às notificações no canal e utilize os botões abaixo caso precise interagir.`
                            );

                        const buttonsRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                                new ButtonBuilder().setCustomId('fechar_ticket_motivo').setLabel('Fechar com Motivo').setStyle(ButtonStyle.Danger).setEmoji('🛑'),
                                new ButtonBuilder().setCustomId('notificar_usuario').setLabel('Notificar Você').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
                                new ButtonBuilder().setCustomId('notificar_equipe').setLabel('Chamar Equipe').setStyle(ButtonStyle.Secondary).setEmoji('📣'),
                                new ButtonBuilder().setCustomId('adicionar_membro').setLabel('Adicionar Membro').setStyle(ButtonStyle.Success).setEmoji('➕')
                            );

                        const removeMemberRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder().setCustomId('remover_membro').setLabel('Remover Membro').setStyle(ButtonStyle.Danger).setEmoji('➖')
                            );

                        await ticketChannel.send({
                            content: `Você Abriu um Suporte com a Equipe da Corregedoria Federal\n|| <@${member.id}> | <@&${GESTAO_ROLE_ID}> ||`,
                            embeds: [ticketEmbed],
                            components: [buttonsRow, removeMemberRow]
                        });

                        await interaction.reply({ content: `Seu ticket foi aberto em ${ticketChannel}!`, ephemeral: true });

                    } catch (error) {
                        console.error('[SISTEMA DE TICKETS] Erro ao abrir o ticket:', error);
                        await interaction.reply({ content: 'Ocorreu um erro ao abrir seu ticket. Tente novamente mais tarde.', ephemeral: true });
                    }
                }
                // Fechar Ticket com Motivo
                else if (interaction.customId === 'close_ticket_reason_modal') {
                    await interaction.deferUpdate();
                    const closeReason = interaction.fields.getTextInputValue('close_reason_input');
                    const ticketInfo = tickets[interaction.channel.id];
                    if (!ticketInfo) {
                        // Pode acontecer se o ticket foi deletado rapidamente
                        return interaction.followUp({ content: 'O ticket não foi encontrado. Talvez já tenha sido fechado.', ephemeral: true });
                    }
                    await closeTicket(interaction.channel, ticketInfo, interaction.member, closeReason, client);
                }
                // Adicionar Membro
                else if (interaction.customId === 'add_member_modal') {
                    await interaction.deferUpdate();
                    const ticketInfo = tickets[interaction.channel.id];
                    if (!ticketInfo) return interaction.followUp({ content: 'O ticket não foi encontrado. Talvez já tenha sido fechado.', ephemeral: true });
                    if (!interaction.member.roles.cache.has(GESTAO_ROLE_ID)) {
                        return interaction.followUp({ content: 'Apenas a equipe pode adicionar membros.', ephemeral: true });
                    }

                    const memberIdentifier = interaction.fields.getTextInputValue('member_id_input');
                    let targetMember;

                    try {
                        const memberId = memberIdentifier.replace(/[^0-9]/g, '');
                        targetMember = await interaction.guild.members.fetch(memberId);
                    } catch (e) {
                        console.warn(`[SISTEMA DE TICKETS] Não foi possível encontrar membro por ID: ${memberIdentifier}. Tentando buscar por nome (menos preciso).`);
                        targetMember = interaction.guild.members.cache.find(m =>
                            m.user.username.toLowerCase() === memberIdentifier.toLowerCase() ||
                            m.nickname?.toLowerCase() === memberIdentifier.toLowerCase()
                        );
                    }

                    if (targetMember) {
                        const currentPermissions = interaction.channel.permissionOverwrites.cache.get(targetMember.id);
                        if (currentPermissions && currentPermissions.allow.has(PermissionsBitField.Flags.ViewChannel)) {
                            return interaction.followUp({ content: `<:alerta:1398025586675122170> | O membro <@${targetMember.id}> já possui acesso a este ticket.`, ephemeral: true });
                        }

                        await interaction.channel.permissionOverwrites.edit(targetMember.id, {
                            ViewChannel: true,
                            SendMessages: true
                        });
                        await interaction.followUp({
                            content: `<a:positivo:1397953846063398933> | Membro <@${targetMember.id}> Adicionado ao ticket por <@${interaction.member.id}>.`,
                            ephemeral: false
                        });
                    } else {
                        await interaction.followUp({ content: 'Não foi possível encontrar o membro especificado. Por favor, use a menção (@membro) ou o ID do membro.', ephemeral: true });
                    }
                }
                // Remover Membro
                else if (interaction.customId === 'remove_member_modal') {
                    await interaction.deferUpdate();
                    const ticketInfo = tickets[interaction.channel.id];
                    if (!ticketInfo) return interaction.followUp({ content: 'O ticket não foi encontrado. Talvez já tenha sido fechado.', ephemeral: true });
                    if (!interaction.member.roles.cache.has(GESTAO_ROLE_ID)) {
                        return interaction.followUp({ content: 'Apenas a equipe pode remover membros.', ephemeral: true });
                    }

                    const memberIdentifier = interaction.fields.getTextInputValue('remove_member_id_input');
                    let targetMember;

                    try {
                        const memberId = memberIdentifier.replace(/[^0-9]/g, '');
                        targetMember = await interaction.guild.members.fetch(memberId);
                    } catch (e) {
                        console.warn(`[SISTEMA DE TICKETS] Não foi possível encontrar membro por ID: ${memberIdentifier}. Tentando buscar por nome (menos preciso).`);
                        targetMember = interaction.guild.members.cache.find(m =>
                            m.user.username.toLowerCase() === memberIdentifier.toLowerCase() ||
                            m.nickname?.toLowerCase() === memberIdentifier.toLowerCase()
                        );
                    }

                    if (targetMember) {
                        if (targetMember.id === ticketInfo.ownerId) {
                            return interaction.followUp({ content: 'Você não pode remover o criador do ticket.', ephemeral: true });
                        }

                        const currentPermissions = interaction.channel.permissionOverwrites.cache.get(targetMember.id);
                        if (!currentPermissions || !currentPermissions.allow.has(PermissionsBitField.Flags.ViewChannel)) {
                            return interaction.followUp({ content: `<:alerta:1398025586675122170> | O membro <@${targetMember.id}> já não possui acesso a este ticket.`, ephemeral: true });
                        }

                        await interaction.channel.permissionOverwrites.delete(targetMember.id);
                        await interaction.followUp({
                            content: `<a:negativo:1397953861251104779> | Membro <@${targetMember.id}> Removido do ticket por <@${interaction.member.id}>.`,
                            ephemeral: false
                        });
                    } else {
                        await interaction.followUp({ content: 'Não foi possível encontrar o membro especificado. Por favor, use a menção (@membro) ou o ID do membro.', ephemeral: true });
                    }
                }
                return; // Importante: Retorna após processar o modal de ticket
            }
        }

        // 3. Interação de Botão (Apenas para botões dentro de canais de ticket existentes)
        if (interaction.isButton() && tickets[interaction.channel.id]) {
            const { customId, channel, member } = interaction;
            const ticketInfo = tickets[channel.id];

            // Este if (!ticketInfo) já existia e é uma camada de segurança extra, mas o filtro acima já ajuda
            if (!ticketInfo) {
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({ content: 'Este não é um canal de ticket válido ou o ticket já foi fechado.', ephemeral: true }).catch(e => console.error("Erro ao responder botão de ticket inválido:", e));
                }
                return;
            }

            const isStaff = member.roles.cache.has(GESTAO_ROLE_ID);

            switch (customId) {
                case 'fechar_ticket':
                    await interaction.deferReply({ ephemeral: true }).catch(e => console.error("Erro ao deferir fechar_ticket:", e));
                    await closeTicket(channel, ticketInfo, member, null, client);
                    break;

                case 'fechar_ticket_motivo':
                    if (!isStaff) {
                        return interaction.reply({ content: 'Apenas a equipe pode usar este botão.', ephemeral: true }).catch(e => console.error("Erro ao responder botão fechar_ticket_motivo:", e));
                    }
                    const closeReasonModal = new ModalBuilder()
                        .setCustomId('close_ticket_reason_modal')
                        .setTitle('Motivo do Fechamento:');

                    const closeReasonInput = new TextInputBuilder()
                        .setCustomId('close_reason_input')
                        .setLabel('Informe o motivo do fechamento do ticket.')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);

                    closeReasonModal.addComponents(new ActionRowBuilder().addComponents(closeReasonInput));
                    await interaction.showModal(closeReasonModal).catch(e => console.error("Erro ao mostrar modal fechar_ticket_motivo:", e));
                    break;

                case 'notificar_usuario':
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: `<a:sino:1389605284200185887> | Olá <@${ticketInfo.ownerId}> você está sendo notificado pela equipe.`,
                            ephemeral: false
                        }).catch(e => console.error("Erro ao responder notificar_usuario:", e));
                    }
                    break;

                case 'notificar_equipe':
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: `<a:sininho:1389604801028952316> | Olá <@&${GESTAO_ROLE_ID}> o Usuário está solicitando sua presença.`,
                            ephemeral: false
                        }).catch(e => console.error("Erro ao responder notificar_equipe:", e));
                    }
                    break;

                case 'adicionar_membro':
                    if (!isStaff) {
                        return interaction.reply({ content: 'Apenas a equipe pode adicionar membros.', ephemeral: true }).catch(e => console.error("Erro ao responder botão adicionar_membro:", e));
                    }
                    const addMemberModal = new ModalBuilder()
                        .setCustomId('add_member_modal')
                        .setTitle('Adicionar Membro ao Ticket');

                    const memberIdInput = new TextInputBuilder()
                        .setCustomId('member_id_input')
                        .setLabel('Mencione o membro ou insira o ID:')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    addMemberModal.addComponents(new ActionRowBuilder().addComponents(memberIdInput));
                    await interaction.showModal(addMemberModal).catch(e => console.error("Erro ao mostrar modal adicionar_membro:", e));
                    break;

                case 'remover_membro':
                    if (!isStaff) {
                        return interaction.reply({ content: 'Apenas a equipe pode remover membros.', ephemeral: true }).catch(e => console.error("Erro ao responder botão remover_membro:", e));
                    }
                    const removeMemberModal = new ModalBuilder()
                        .setCustomId('remove_member_modal')
                        .setTitle('Remover Membro do Ticket');

                    const removeMemberIdInput = new TextInputBuilder()
                        .setCustomId('remove_member_id_input')
                        .setLabel('Mencione o membro ou insira o ID:')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    removeMemberModal.addComponents(new ActionRowBuilder().addComponents(removeMemberIdInput));
                    await interaction.showModal(removeMemberModal).catch(e => console.error("Erro ao mostrar modal remover_membro:", e));
                    break;
            }
            return; // Importante: Retorna após processar o botão de ticket
        }

        // Se a interação chegou até aqui, ela não é de ticket.
        // Outros módulos podem processá-la.
    });

    // Evento de mensagem: Coleta o histórico para a transcrição
    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        // Apenas coleta transcrição se for um canal de ticket existente
        if (tickets[message.channel.id]) {
            tickets[message.channel.id].transcript.push({
                author: message.author.tag,
                content: message.content,
                timestamp: message.createdTimestamp
            });
            saveTickets();
        }
    });
}

// Exporta a função setup para que o index.js possa chamá-la.
module.exports = { setup };