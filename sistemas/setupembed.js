const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder, // Manter aqui se ainda usar em outros menus, mas não para o principal.
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de dados das embeds
const DATA_FILE = path.join(__dirname, '../dados/embedDB/embedMessages.json');

// --- Funções de Manipulação de Dados ---
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify({}));
      return new Map();
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return new Map(Object.entries(JSON.parse(data)));
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    return new Map();
  }
}

function saveData(map) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(map), null, 2));
  } catch (e) {
    console.error('Erro ao salvar dados:', e);
  }
}

// --- Funções de Validação ---
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidHexColor(color) {
  return /^#([0-9A-F]{6})$/i.test(color);
}

// --- Funções de Criação de Componentes UI ---
// *** MODIFICAÇÃO PRINCIPAL AQUI: Cria botões em vez de um menu de seleção ***
function createMainMenuButtons() {
    const createButton = new ButtonBuilder()
        .setCustomId('setupembed_create')
        .setLabel('Criar Embed')
        .setStyle(ButtonStyle.Primary); // Ou o estilo que preferir

    const deleteButton = new ButtonBuilder()
        .setCustomId('setupembed_delete')
        .setLabel('Excluir Embed')
        .setStyle(ButtonStyle.Danger); // Perigo, para exclusão

    const editButton = new ButtonBuilder()
        .setCustomId('setupembed_edit')
        .setLabel('Editar Embed')
        .setStyle(ButtonStyle.Secondary); // Secundário, para edição

    const row = new ActionRowBuilder()
        .addComponents(createButton, deleteButton, editButton);

    return row; // Retorna uma única ActionRow com os botões
}
// --------------------------------------------------------------------------

// --- Exportações do Módulo ---
module.exports = {
  setup: (client) => {
    client.embedMessages = loadData();
    client.tempEmbedData = new Map();

    client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand() && interaction.commandName === 'setupembed') {
        return module.exports.execute(interaction, client);
      }

      // Lida com interações de botões
      if (interaction.isButton()) {
        // Agora, os botões 'create', 'delete', 'edit' serão tratados aqui
        await module.exports.handleButtonInteraction(interaction, client); // Nova função para tratar botões
        return; // Retorna para evitar processamento duplicado
      }

      // Lida com interações de menus de seleção (ainda usado para delete/edit da embed específica)
      if (interaction.isStringSelectMenu()) {
        await module.exports.handleSelectMenu(interaction, client);
      }

      // Lida com submissões de modais
      if (interaction.isModalSubmit()) {
        await module.exports.handleModalSubmit(interaction, client);
      }
    });
  },

  // --- Definição do Comando de Barra ---
  slashCommands: [
    new SlashCommandBuilder()
      .setName('setupembed')
      .setDescription('Criar, excluir ou editar suas embeds personalizadas.')
      .toJSON()
  ],

  // --- Execução do Comando /setupembed ---
  async execute(interaction, client) {
    // *** MODIFICAÇÃO AQUI: Chama a nova função de botões ***
    const buttonsRow = createMainMenuButtons();
    await interaction.reply({
      content: 'Selecione uma ação:',
      components: [buttonsRow], // Envia a linha de botões
      flags: 64, // ephemeral
    });
  },
  // ----------------------------------------------------------

  // --- Nova função para lidar com interações de botões do menu principal ---
  async handleButtonInteraction(interaction, client) {
    const customId = interaction.customId;

    // Simula a lógica do handleSelectMenu para os novos botões
    if (customId === 'setupembed_create') {
      const modal = new ModalBuilder()
        .setCustomId('setupembed_createEmbedModal')
        .setTitle('Criar Embed');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedTitle')
            .setLabel('Título da Embed')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embedDesc')
              .setLabel('Descrição da Embed')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embedColor')
              .setLabel('Cor da Embed (Hex, ex: #3498DB)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embedImage')
              .setLabel('URL da Imagem (opcional)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embedFooterText')
              .setLabel('Texto do Rodapé (opcional)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          )
        );
        await interaction.showModal(modal);
        return true;
      }

      if (customId === 'setupembed_delete') {
        const userId = interaction.user.id;
        const embeds = client.embedMessages.get(userId) || [];

        if (embeds.length === 0) {
          await interaction.update({
            content: '❌ Você não tem embeds enviadas para excluir.',
            components: [],
            flags: 64,
          });
          return true;
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('setupembed_deleteEmbedSelect')
          .setPlaceholder('Selecione a embed para apagar')
          .addOptions(
            embeds.map((e, i) => ({
              label: e.embedData.title.slice(0, 100),
              description: e.embedData.description.slice(0, 100),
              value: String(i),
            }))
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.update({
          content: '⚠️ Qual embed deseja apagar?',
          components: [row],
          flags: 64,
        });
        return true;
      }

      if (customId === 'setupembed_edit') {
        const userId = interaction.user.id;
        const embeds = client.embedMessages.get(userId) || [];

        if (embeds.length === 0) {
          await interaction.update({
            content: '❌ Você não tem embeds para editar.',
            components: [],
            flags: 64,
          });
          return true;
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('setupembed_editEmbedSelect')
          .setPlaceholder('Selecione a embed para editar')
          .addOptions(
            embeds.map((e, i) => ({
              label: e.embedData.title.slice(0, 100),
              description: e.embedData.description.slice(0, 100),
              value: String(i),
            }))
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.update({
          content: '⚠️ Qual embed deseja editar?',
          components: [row],
          flags: 64,
        });
        return true;
      }
    return false; // Nenhuma ação de botão correspondente
  },
  // --------------------------------------------------------------------------

  async handleSelectMenu(interaction, client) {
    // Lidar com seleção de embed para exclusão (este é um menu de seleção secundário)
    if (interaction.customId === 'setupembed_deleteEmbedSelect') {
      const userId = interaction.user.id;
      const index = parseInt(interaction.values[0], 10);
      const embeds = client.embedMessages.get(userId) || [];

      if (index < 0 || index >= embeds.length) {
        await interaction.reply({ content: '❌ Seleção inválida.', flags: 64 });
        return true;
      }

      const toDelete = embeds[index];

      try {
        const channel = await client.channels.fetch(toDelete.channelId);
        if (channel && channel.isTextBased()) {
          const msg = await channel.messages.fetch(toDelete.messageId);
          if (msg) {
            await msg.delete();
          }
        } else {
            console.warn(`Canal ${toDelete.channelId} não encontrado ou não é de texto para deletar a embed.`);
        }
      } catch (e) {
        console.warn('Erro ao tentar deletar mensagem no Discord (pode já ter sido excluída):', e.message);
      }

      embeds.splice(index, 1);
      client.embedMessages.set(userId, embeds);
      saveData(client.embedMessages);

      await interaction.update({ content: '✅ Embed apagada com sucesso!', components: [], flags: 64 });
      return true;
    }

    // Lidar com seleção de embed para edição (este é um menu de seleção secundário)
    if (interaction.customId === 'setupembed_editEmbedSelect') {
      const userId = interaction.user.id;
      const index = parseInt(interaction.values[0], 10);
      const embeds = client.embedMessages.get(userId) || [];

      if (index < 0 || index >= embeds.length) {
        await interaction.reply({ content: '❌ Seleção inválida.', flags: 64 });
        return true;
      }

      const toEdit = embeds[index];
      const data = toEdit.embedData;

      const modal = new ModalBuilder()
        .setCustomId(`setupembed_editEmbedModal_${index}`)
        .setTitle('Editar Embed');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedTitle')
            .setLabel('Título da Embed')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(data.title || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedDesc')
            .setLabel('Descrição da Embed')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(data.description || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedColor')
            .setLabel('Cor da Embed (Hex, ex: #3498DB)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(data.color || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedImage')
            .setLabel('URL da Imagem (opcional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(data.image || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedFooterText')
            .setLabel('Texto do Rodapé (opcional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(data.footerText || '')
        )
      );

      await interaction.showModal(modal);
      return true;
    }

    return false; // Nenhuma ação de select menu correspondente
  },

  // --- Lidar com Submissões de Modal ---
  async handleModalSubmit(interaction, client) {
    const userId = interaction.user.id;
    const guild = interaction.guild;

    // Lidar com a submissão do modal de Criação de Embed
    if (interaction.customId === 'setupembed_createEmbedModal') {
      const title = interaction.fields.getTextInputValue('embedTitle');
      const description = interaction.fields.getTextInputValue('embedDesc');
      let color = interaction.fields.getTextInputValue('embedColor') || '#3498DB';
      const image = interaction.fields.getTextInputValue('embedImage');
      const footerText = interaction.fields.getTextInputValue('embedFooterText');

      if (!isValidHexColor(color)) {
        color = '#3498DB';
      }

      client.tempEmbedData.set(userId, {
        title,
        description,
        color,
        image: isValidUrl(image) ? image : null,
        footerText,
        guildId: guild?.id,
      });

      await interaction.reply({
        content: '✅ Embed criada! Agora, por favor, **mencione o canal** para onde deseja enviar essa embed.',
        flags: 64,
      });

      const filter = m => m.author.id === userId && m.mentions.channels.size > 0;
      const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

      collector.on('collect', async m => {
        const channel = m.mentions.channels.first();
        const embedData = client.tempEmbedData.get(userId);

        if (!channel || !channel.isTextBased() || !embedData) {
          await interaction.followUp({ content: '❌ Canal inválido, ou dados da embed não encontrados. Tente novamente.', flags: 64 });
          client.tempEmbedData.delete(userId);
          return;
        }

        const embedToSend = new EmbedBuilder()
          .setTitle(embedData.title)
          .setDescription(embedData.description)
          .setColor(embedData.color);

        if (embedData.image) {
          embedToSend.setImage(embedData.image);
        }
        if (embedData.footerText) {
          embedToSend.setFooter({ text: embedData.footerText });
        }

        try {
          const sentMessage = await channel.send({ embeds: [embedToSend] });

          const userEmbeds = client.embedMessages.get(userId) || [];
          userEmbeds.push({
            embedData: embedData,
            channelId: channel.id,
            messageId: sentMessage.id
          });
          client.embedMessages.set(userId, userEmbeds);
          saveData(client.embedMessages);

          await interaction.followUp({ content: `✅ Embed enviada com sucesso para ${channel}!`, flags: 64 });
        } catch (error) {
          console.error('Erro ao enviar a embed para o canal ou salvar:', error);
          await interaction.followUp({ content: '❌ Houve um erro ao tentar enviar a embed para o canal. Verifique as permissões do bot.', flags: 64 });
        } finally {
          client.tempEmbedData.delete(userId);
          collector.stop();
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0 && client.tempEmbedData.has(userId)) {
          interaction.followUp({ content: '⌛ Tempo esgotado! Você não mencionou um canal. A criação da embed foi cancelada.', flags: 64 });
          client.tempEmbedData.delete(userId);
        }
      });

      return true;
    }

    // Lidar com a submissão do modal de Edição de Embed
    if (interaction.customId.startsWith('setupembed_editEmbedModal_')) {
      const indexStr = interaction.customId.replace('setupembed_editEmbedModal_', '');
      const index = parseInt(indexStr, 10);

      const embeds = client.embedMessages.get(userId) || [];
      if (index < 0 || index >= embeds.length) {
        await interaction.reply({ content: '❌ Índice inválido para edição.', flags: 64 });
        return true;
      }

      const title = interaction.fields.getTextInputValue('embedTitle');
      const description = interaction.fields.getTextInputValue('embedDesc');
      let color = interaction.fields.getTextInputValue('embedColor') || '#3498DB';
      const image = interaction.fields.getTextInputValue('embedImage');
      const footerText = interaction.fields.getTextInputValue('embedFooterText');

      if (!isValidHexColor(color)) {
        color = '#3498DB';
      }

      const updatedEmbedData = {
        title,
        description,
        color,
        image: isValidUrl(image) ? image : null,
        footerText,
      };

      embeds[index].embedData = updatedEmbedData;
      client.embedMessages.set(userId, embeds);
      saveData(client.embedMessages);

      const originalEmbedInfo = embeds[index];
      try {
        const channel = await client.channels.fetch(originalEmbedInfo.channelId);
        if (channel && channel.isTextBased()) {
          const msg = await channel.messages.fetch(originalEmbedInfo.messageId);
          if (msg) {
                const embedToEdit = new EmbedBuilder()
                    .setTitle(updatedEmbedData.title)
                    .setDescription(updatedEmbedData.description)
                    .setColor(updatedEmbedData.color);
                if (updatedEmbedData.image) embedToEdit.setImage(updatedEmbedData.image);
                if (updatedEmbedData.footerText) embedToEdit.setFooter({ text: updatedEmbedData.footerText });
            await msg.edit({ embeds: [embedToEdit] });
          }
        }
      } catch (e) {
        console.warn('Erro ao tentar editar mensagem no Discord (pode já ter sido excluída):', e.message);
      }

      await interaction.reply({ content: '✅ Embed editada com sucesso!', flags: 64 });
      return true;
    }

    return false; // Nenhuma ação de modal correspondente
  },
};