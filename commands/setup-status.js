const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-status")
    .setDescription("Set up streaming status buttons (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "You do not have permission to use this command!",
        ephemeral: true,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("streaming")
        .setLabel("Streaming")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("settings")
        .setLabel("Settings")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("show_sample_config")
        .setLabel("คอนฟิก ตัวอย่าง")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('Video')
        .setURL('https://discord.js.org')
        .setEmoji('<:youtube:1153998429274517524>')
        .setStyle(ButtonStyle.Link)
      
    );

    const setupEmbed = new EmbedBuilder()
      .setColor(0xffffff)
      .setDescription("```ระบบออนเม็ดม่วง ( BETA )```")
      .addFields(
        {
          name: "Streaming",
          value: "```Set your streaming status```",
          inline: true,
        },
        {
          name: "Settings",
          value: "```กำหนดค่าการตั้งค่าสถานะของคุณ```",
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [setupEmbed],
      components: [row],
    });
  },
};