const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const configManager = require("../database/userConfig");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const JsonValidator = require("../utils/jsonValidator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("upload-config")
    .setDescription("Upload a configuration file")
    .addAttachmentOption((option) =>
      option
        .setName("config")
        .setDescription("Your config.json file")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const file = interaction.options.getAttachment("config");

      if (!file.name.endsWith(".json")) {
        await interaction.editReply({
          content: "❌ Please upload a .json file",
        });
        return;
      }

      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      const configText = await response.text();

      const validationResult = JsonValidator.validateConfig(configText);

      if (!validationResult.isValid) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("Configuration Error")
          .setDescription("```" + validationResult.error + "```")
          .addFields({
            name: "How to Fix",
            value:
              "Make sure your configuration file:\n" +
              "• Is valid JSON format\n" +
              "• Has all required sections\n" +
              "• Contains valid values",
          });

        await interaction.editReply({
          embeds: [errorEmbed],
        });
        return;
      }

      const splitResult = JsonValidator.splitLargeConfig(
        validationResult.config
      );
      if (splitResult.error) {
        await interaction.editReply({
          content: "❌ Error processing configuration: " + splitResult.error,
        });
        return;
      }

      const config = splitResult.parts[0];
      const success = configManager.setUserConfig(interaction.user.id, config);

      if (success) {
        const configEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("Configuration Uploaded Successfully");

        if (splitResult.isSplit) {
          configEmbed
            .setDescription("Configuration has been optimized for performance.")
            .addFields({
              name: "Note",
              value: "Some arrays were truncated to prevent memory issues.",
            });
        }

        const buttonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setURL(
              config.config?.["button-1"]?.[0]?.url ||
                "https://discord.gg/TSdpyMMfrU"
            )
            .setLabel(
              config.config?.["button-1"]?.[0]?.name || "Miyako's server"
            )
            .setStyle(ButtonStyle.Link),
          new ButtonBuilder()
            .setURL(
              config.config?.["button-2"]?.[0]?.url ||
                "https://github.com/4levy/Streaming-status"
            )
            .setLabel(
              config.config?.["button-2"]?.[0]?.name || "Stream status > Deobf"
            )
            .setStyle(ButtonStyle.Link)
        );

        const imageRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("next_image")
            .setLabel("Next Image")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!(config.config?.bigimg?.length > 1))
        );

        await interaction.editReply({
          embeds: [configEmbed],
          components: [buttonRow, imageRow],
        });
      } else {
        await interaction.editReply({
          content: "❌ Failed to save configuration. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error processing config file:", error);

      const errorMessage = error.message.includes("heap")
        ? "Configuration file is too large. Please reduce the size of arrays in your config."
        : "Error processing the configuration file: " + error.message;

      await interaction.editReply({
        content: "❌ " + errorMessage,
      });
    }
  },
};