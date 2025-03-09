const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const db = require("../database/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove-token")
    .setDescription("Remove a streaming token from your profile"),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const tokens = db.getUserTokens(userId);

      if (!tokens || tokens.length === 0) {
        await interaction.reply({
          content: "```You don't have any saved tokens to remove.```",
          ephemeral: true,
        });
        return;
      }

      const options = tokens.map((token, index) => ({
        label: `Token ${index + 1}`,
        description: `Added: ${new Date(token.addedAt).toLocaleDateString()}`,
        value: token.value,
      }));

      if (options.length > 25) {
        options.length = 25;
      }

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select_token_to_remove")
          .setPlaceholder("Select a token to remove")
          .addOptions(options)
      );

      const removeEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("Remove Token")
        .setDescription(
          `Select the token you want to remove\nYou have ${tokens.length} token(s)`
        )
        .setFooter({ text: "This action cannot be undone" })
        .setTimestamp();

      await interaction.reply({
        embeds: [removeEmbed],
        components: [row],
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error in remove-token command:", error);
      await interaction.reply({
        content: "An error occurred while preparing the token removal menu.",
        ephemeral: true,
      });
    }
  },
};
