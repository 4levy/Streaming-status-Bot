const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const streamManager = require("./utils/streamManager");
const TokenValidator = require("./utils/tokenValidator");
const activeStreamsManager = require("./database/activeStreams");

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

let chalk;
try {
  chalk = require("chalk");
  if (typeof chalk.cyan !== "function") {
    chalk = {
      green: (text) => `\x1b[32m${text}\x1b[0m`,
      yellow: (text) => `\x1b[33m${text}\x1b[0m`,
      red: (text) => `\x1b[31m${text}\x1b[0m`,
      blue: (text) => `\x1b[34m${text}\x1b[0m`,
      magenta: (text) => `\x1b[35m${text}\x1b[0m`,
      cyan: (text) => `\x1b[36m${text}\x1b[0m`,
      white: (text) => `\x1b[37m${text}\x1b[0m`,
      gray: (text) => `\x1b[90m${text}\x1b[0m`,
      bold: (text) => `\x1b[1m${text}\x1b[0m`,
      dim: (text) => `\x1b[2m${text}\x1b[0m`,
      italic: (text) => `\x1b[3m${text}\x1b[0m`,
      underline: (text) => `\x1b[4m${text}\x1b[0m`,
      reset: (text) => `\x1b[0m${text}\x1b[0m`,
    };
  }
} catch (error) {
  chalk = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    magenta: (text) => `\x1b[35m${text}\x1b[0m`,
    cyan: (text) => `\x1b[36m${text}\x1b[0m`,
    white: (text) => `\x1b[37m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`,
    dim: (text) => `\x1b[2m${text}\x1b[0m`,
    italic: (text) => `\x1b[3m${text}\x1b[0m`,
    underline: (text) => `\x1b[4m${text}\x1b[0m`,
    reset: (text) => `\x1b[0m${text}\x1b[0m`,
  };
}

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(
      chalk.yellow(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      )
    );
  }
}

function createBanner(text, type = "info") {
  const width = 60;
  const padding = Math.floor((width - text.length) / 2);
  const line = "─".repeat(width);

  let color;
  switch (type) {
    case "success":
      color = chalk.green;
      break;
    case "error":
      color = chalk.red;
      break;
    case "warning":
      color = chalk.yellow;
      break;
    case "info":
    default:
      color = chalk.cyan;
  }

  return `\n${color("┌" + line + "┐")}\n${color("│")}${" ".repeat(
    padding
  )}${chalk.bold(text)}${" ".repeat(width - padding - text.length - 1)}${color(
    "│"
  )}\n${color("└" + line + "┘")}\n`;
}

function createStatusBox(title, content, type = "info") {
  const width = 60;
  const line = "─".repeat(width - 2);

  let titleColor, contentColor;
  switch (type) {
    case "success":
      titleColor = chalk.green;
      contentColor = chalk.white;
      break;
    case "error":
      titleColor = chalk.red;
      contentColor = chalk.white;
      break;
    case "warning":
      titleColor = chalk.yellow;
      contentColor = chalk.white;
      break;
    case "info":
    default:
      titleColor = chalk.cyan;
      contentColor = chalk.white;
  }

  const titlePadding = Math.max(0, Math.floor((width - title.length - 3) / 2));
  const titleRemaining = Math.max(0, width - title.length - titlePadding - 3);

  const contentLines = content.split("\n");
  let result = `${titleColor("┌" + line + "┐")}\n`;
  result += `${titleColor("│")}${" ".repeat(titlePadding)} ${chalk.bold(
    title
  )} ${" ".repeat(titleRemaining)}${titleColor("│")}\n`;
  result += `${titleColor("├" + line + "┤")}\n`;

  for (const line of contentLines) {
    const contentPadding = Math.max(
      0,
      Math.floor((width - line.length - 3) / 2)
    );
    const contentRemaining = Math.max(
      0,
      width - line.length - contentPadding - 3
    );
    result += `${titleColor("│")}${" ".repeat(contentPadding)} ${contentColor(
      line
    )} ${" ".repeat(contentRemaining)}${titleColor("│")}\n`;
  }

  result += `${titleColor("└" + line + "┘")}\n`;
  return result;
}

function createProgressBar(current, total, width = 40) {
  const percentage = Math.floor((current / total) * 100);
  const filled = Math.floor((width * current) / total);
  const empty = width - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `${chalk.cyan("[")}${chalk.green(bar)}${chalk.cyan("]")} ${chalk.white(
    `${percentage}%`
  )}`;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
  sweepers: {
    messages: {
      interval: 120,
      lifetime: 60,
    },
  },
});

client.commands = new Collection();

// Load commands into Collection
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      chalk.yellow(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      )
    );
  }
}

client.once("ready", async () => {
  console.log(createBanner("STREAMING STATUS BOT", "info"));
  console.log(
    createStatusBox(
      "Bot Information",
      `Logged in as ${chalk.bold(client.user.tag)}`,
      "info"
    )
  );

  client.user.setPresence({
    activities: [
      {
        name: "Your RPC",
        type: 1,
        url: "https://www.twitch.tv/4levy_z1",
      },
    ],
    status: "online",
    afk: false,
  });

  console.log(createBanner("RESTORING ACTIVE STREAMS", "info"));
  const activeUsers = activeStreamsManager.getActiveUsers();
  console.log(
    chalk.gray(`ℹ Found ${activeUsers.length} active user(s) to restore`)
  );

  let successCount = 0;
  let failCount = 0;

  for (const userId of activeUsers) {
    try {
      console.log(chalk.cyan(`⟳ Restoring stream for user ${userId}...`));

      const db = require("./database/db");
      const configManager = require("./database/userConfig");
      const userTokens = db.getUserTokens(userId);
      const userConfig = configManager.getUserConfig(userId);

      if (userTokens && userTokens.length > 0 && userConfig) {
        await streamManager.startStream(userId, userTokens, userConfig);
        streamManager.startStatusCheck(userId);
        console.log(chalk.green("✓ Successfully restored stream"));
        successCount++;
      } else {
        console.log(
          chalk.red("✗ Failed to restore stream: Missing tokens or config")
        );
        activeStreamsManager.removeUser(userId);
        failCount++;
      }
    } catch (error) {
      console.log(chalk.red(`✗ Failed to restore stream: ${error.message}`));
      activeStreamsManager.removeUser(userId);
      failCount++;
    }
  }

  console.log(
    createStatusBox(
      "Stream Restoration Summary",
      `✓ Successfully restored: ${chalk.green(
        successCount
      )}\n✗ Failed to restore: ${chalk.red(failCount)}`,
      successCount > 0 ? "success" : "error"
    )
  );

  try {
    console.log(chalk.cyan("Started refreshing application (/) commands."));
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log(chalk.green("✓ Commands registered successfully"));
  } catch (error) {
    console.log(chalk.red(`✗ Failed to register commands: ${error.message}`));
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error executing this command!",
      ephemeral: true,
    });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "streaming") {
    const streamingEmbed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setDescription("```Control your streaming status```");

    const isStreaming = await streamManager.isStreaming(interaction.user.id);

    const streamingRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("start_streaming")
        .setLabel("Start")
        .setStyle(ButtonStyle.Success)
        .setDisabled(isStreaming),
      new ButtonBuilder()
        .setCustomId("stop_streaming")
        .setLabel("Stop")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isStreaming),
      new ButtonBuilder()
        .setCustomId("config_streaming")
        .setLabel("Config")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      embeds: [streamingEmbed],
      components: [streamingRow],
      ephemeral: true,
    });
  }

  if (interaction.customId === "start_streaming") {
    try {
      await interaction.deferUpdate();

      const processingEmbed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setDescription("```⏳ Starting streaming status...```");

      await interaction.editReply({
        embeds: [processingEmbed],
        components: [],
      });

      const db = require("./database/db");
      const configManager = require("./database/userConfig");
      const userTokens = db.getUserTokens(interaction.user.id);
      const userConfig = configManager.getUserConfig(interaction.user.id);

      if (!userConfig) {
        const configErrorEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("Configuration Missing")
          .setDescription(
            "⚠️ You need to set up your configuration before starting the stream."
          )
          .addFields({
            name: "How to Configure",
            value:
              "Click the 'Config' button to set up your streaming configuration.",
          })
          .setFooter({
            text: "Configuration is required before streaming can start",
          });

        await interaction.editReply({
          embeds: [configErrorEmbed],
          components: [interaction.message.components[0]],
        });
        return;
      }

      if (
        !userConfig.config ||
        !userConfig.setup ||
        !userConfig.config.options ||
        !userConfig.config.options["watch-url"] ||
        userConfig.config.options["watch-url"].length === 0
      ) {
        const invalidConfigEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("Invalid Configuration")
          .setDescription("⚠️ Your configuration is incomplete or invalid.")
          .addFields({
            name: "Missing Elements",
            value:
              "Your config must include at least one watch URL and proper setup parameters.",
          })
          .setFooter({
            text: "Please update your configuration",
          });

        await interaction.editReply({
          embeds: [invalidConfigEmbed],
        });
        return;
      }

      if (!userTokens || userTokens.length === 0) {
        const tokenErrorEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setDescription(
            "```⚠️ You need to add at least one token before starting the stream.```"
          );

        await interaction.editReply({
          embeds: [tokenErrorEmbed],
        });
        return;
      }

      const result = await streamManager.startStream(
        interaction.user.id,
        userTokens,
        userConfig
      );

      if (result.success) {
        activeStreamsManager.addUser(interaction.user.id);

        const updatedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("start_streaming")
            .setLabel("Start")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("stop_streaming")
            .setLabel("Stop")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(false),
          new ButtonBuilder()
            .setCustomId("config_streaming")
            .setLabel("Config")
            .setStyle(ButtonStyle.Primary)
        );

        const startEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setDescription("```Your streaming status is now active!```");

        const fields = [
          { name: "Status", value: "Active", inline: true },
          {
            name: "Config",
            value: userConfig._isDefault ? "Default (Template)" : "Custom",
            inline: true,
          },
        ];

        if (
          result.successCount !== undefined &&
          result.totalCount !== undefined
        ) {
          fields.push({
            name: "Active Tokens",
            value:
              `${result.successCount}/${result.totalCount}` +
              (result.failedCount > 0 ? ` (${result.failedCount} failed)` : ""),
            inline: true,
          });

          if (result.failedCount > 0) {
            startEmbed.setFooter({
              text: "Some tokens failed to connect. Check the console for details.",
            });
          }
        } else {
          fields.push({
            name: "Active Tokens",
            value: `${userTokens.length}`,
            inline: true,
          });
        }

        if (userConfig._isDefault) {
          fields.push({
            name: "``⚠️`` Using Default Configuration",
            value:
              "```You're currently using the default template config. For best results, upload your own custom configuration.```",
          });
        }

        startEmbed.addFields(fields).setTimestamp();

        await interaction.editReply({
          embeds: [startEmbed],
          components: [updatedRow],
        });

        streamManager.startStatusCheck(interaction.user.id);
      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("Streaming Failed")
          .setDescription("❌ Failed to start streaming with any tokens.")
          .addFields({
            name: "Reason",
            value:
              result.error ||
              "Tokens may be invalid or expired. Check the console for more details.",
          })
          .setTimestamp();

        await interaction.editReply({
          embeds: [errorEmbed],
        });
      }
    } catch (error) {
      console.error("Error starting stream:", error);

      await interaction.editReply({
        content: `❌ Error starting stream: ${error.message}`,
        components: [interaction.message.components[0]],
      });
    }
  }

  if (interaction.customId === "stop_streaming") {
    try {
      await interaction.deferUpdate();

      const success = await streamManager.stopStream(interaction.user.id);

      if (success) {
        activeStreamsManager.removeUser(interaction.user.id);
      }

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("start_streaming")
          .setLabel("Start")
          .setStyle(ButtonStyle.Success)
          .setDisabled(false),
        new ButtonBuilder()
          .setCustomId("stop_streaming")
          .setLabel("Stop")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("config_streaming")
          .setLabel("Config")
          .setStyle(ButtonStyle.Primary)
      );

      const stopEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(
          success
            ? "```Your streaming status has been deactivated.```"
            : "```No active streaming session found.```"
        )
        .addFields({
          name: "Status",
          value: success ? "Inactive" : "```Already Inactive```",
          inline: true,
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [stopEmbed],
        components: [updatedRow],
      });

      streamManager.stopStatusCheck(interaction.user.id);
    } catch (error) {
      console.error("Error stopping stream:", error);
      await interaction.editReply({
        content: "❌ Error stopping the stream.",
        components: [interaction.message.components[0]],
      });
    }
  }

  if (interaction.customId === "config_streaming") {
    const configEmbed = new EmbedBuilder()
      .setColor(0xf3eeee)
      .setDescription(
        "```Choose how you want to configure your streaming status```"
      )
      .addFields(
        {
          name: "1. Manual Configuration",
          value: "Configure your settings step by step using Discord buttons",
          inline: true,
        },
        {
          name: "2. Upload Config File",
          value: "Use `/upload-config` to upload your .json file",
          inline: true,
        }
      );

    const configRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("manual_config")
        .setLabel("Manual Configuration")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("show_sample_config")
        .setLabel("View Sample Config")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [configEmbed],
      components: [configRow],
      ephemeral: true,
    });
  }

  if (interaction.customId === "settings") {
    const settingsEmbed = new EmbedBuilder()
      .setColor(0xffffff)
      .setDescription("```Configure your status settings here```");

    const settingsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("add_token")
        .setLabel("Add Token")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("view_tokens")
        .setLabel("View My Tokens")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("remove_token")
        .setLabel("Remove Token")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [settingsEmbed],
      components: [settingsRow],
      ephemeral: true,
    });
  }

  if (interaction.customId === "add_token") {
    const modal = new ModalBuilder()
      .setCustomId("token_modal")
      .setTitle("Add tokens");

    const tokenValueInput = new TextInputBuilder()
      .setCustomId("token_value")
      .setLabel("tokens value")
      .setPlaceholder(
        "ป้อนโทเค็นหนึ่งรายการหรือมากกว่า คั่นด้วยเครื่องหมายจุลภาค (,)"
      )
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(tokenValueInput);
    modal.addComponents(firstRow);
    await interaction.showModal(modal);
  }

  if (interaction.customId === "view_tokens") {
    try {
      if (!interaction.isRepliable()) {
        console.log("Interaction is no longer valid");
        return;
      }

      const db = require("./database/db");
      const userData = db.data.users[interaction.user.id];

      if (!userData || userData.tokens.length === 0) {
        const noTokensEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setDescription("```You don't have any saved tokens yet.```");

        await interaction
          .reply({
            embeds: [noTokensEmbed],
            ephemeral: true,
          })
          .catch((error) => {
            console.error("Error replying to interaction:", error);
          });
        return;
      }

      const tokenList = userData.tokens
        .map((t, index) => {
          const username = t.username || "Unknown User";
          const status =
            t.fetchSuccess === false ? " (Token may be invalid)" : "";
          return `**${index + 1}.** \`${username}\`${status} (Added: ${new Date(
            t.addedAt
          ).toLocaleString()})`;
        })
        .join("\n");

      const tokensEmbed = new EmbedBuilder()
        .setColor(0xfcf7f7)
        .setTitle(`${interaction.user.username} db`)
        .setDescription(tokenList)
        .setFooter({ text: `Total tokens: ${userData.tokens.length}` });

      await interaction
        .reply({
          embeds: [tokensEmbed],
          ephemeral: true,
        })
        .catch((error) => {
          console.error("Error replying to interaction:", error);
        });
    } catch (error) {
      console.error("Error handling interaction:", error);
    }
  }

  if (interaction.customId === "remove_token") {
    try {
      const db = require("./database/db");
      const tokens = db.getUserTokens(interaction.user.id);

      if (!tokens || tokens.length === 0) {
        const noTokensEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setDescription("```You don't have any saved tokens to remove.```");

        await interaction.reply({
          embeds: [noTokensEmbed],
          ephemeral: true,
        });
        return;
      }

      const options = tokens.map((token, index) => ({
        label: token.username || `Token ${index + 1}`,
        description: `Added: ${new Date(token.addedAt).toLocaleDateString()}`,
        value: token.value,
      }));

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select_token_to_remove")
          .setPlaceholder("Select a token to remove")
          .addOptions(options)
      );

      await interaction.reply({
        components: [row],
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error in remove token button:", error);
      await interaction.reply({
        content: "An error occurred while preparing the token removal menu.",
        ephemeral: true,
      });
    }
  }

  if (interaction.customId === "show_sample_config") {
    try {
      const sampleConfigPath = path.join(
        __dirname,
        "config-templates",
        "sample-config.txt"
      );
      let formattedConfig;

      if (fs.existsSync(sampleConfigPath)) {
        formattedConfig = fs.readFileSync(sampleConfigPath, "utf8");
      } else {
        const configManager = require("./database/userConfig");
        const sampleConfig = configManager.getDefaultConfig();
        formattedConfig = JSON.stringify(sampleConfig, null, 2);

        try {
          const dirPath = path.join(__dirname, "config-templates");
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          fs.writeFileSync(sampleConfigPath, formattedConfig);
          console.log("Created sample config file at:", sampleConfigPath);
        } catch (err) {
          console.error("Error creating sample config file:", err);
        }
      }

      const configEmbed = new EmbedBuilder()
        .setColor(0xf0e9e9)
        .setDescription(
          "```Copy this configuration and modify it for your needs:```"
        );

      if (formattedConfig.length > 1000) {
        configEmbed.addFields({
          name: "Configuration Format (Part 1)",
          value: "```json\n" + formattedConfig.slice(0, 1000) + "\n...```",
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("download_config")
            .setLabel("Download Full Config")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [configEmbed],
          components: [row],
          ephemeral: true,
        });
      } else {
        configEmbed.addFields({
          name: "Configuration Format",
          value: "```json\n" + formattedConfig + "```",
        });

        await interaction.reply({
          embeds: [configEmbed],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error showing sample config:", error);
      await interaction.reply({
        content: "❌ An error occurred while loading the sample configuration.",
        ephemeral: true,
      });
    }
  }

  if (interaction.customId === "download_config") {
    try {
      const sampleConfigPath = path.join(
        __dirname,
        "config-templates",
        "sample-config.txt"
      );
      const formattedConfig = fs.readFileSync(sampleConfigPath, "utf8");

      const tempFilePath = path.join(
        __dirname,
        "config-templates",
        "temp-config.json"
      );
      fs.writeFileSync(tempFilePath, formattedConfig);

      await interaction.reply({
        files: [
          {
            attachment: tempFilePath,
            name: "sample-config.json",
            description: "Sample streaming status configuration",
          },
        ],
        ephemeral: true,
      });

      fs.unlinkSync(tempFilePath);
    } catch (error) {
      console.error("Error downloading config:", error);
      await interaction.reply({
        content: "❌ An error occurred while downloading the configuration.",
        ephemeral: true,
      });
    }
  }

  if (interaction.customId === "manual_config") {
    const configManager = require("./database/userConfig");
    const userConfig = configManager.getUserConfig(interaction.user.id);

    const configEmbed = new EmbedBuilder()
      .setColor(0xf1eded)
      .setDescription("```Select a section to configure```")
      .addFields(
        {
          name: "1. Basic Settings",
          value: "City and delay settings",
          inline: true,
        },
        {
          name: "2. Watch URLs",
          value: "Twitch, YouTube, and other URLs",
          inline: true,
        },
        {
          name: "3. Status Messages",
          value: "Customize your status text",
          inline: true,
        },
        {
          name: "4. Images",
          value: "Add large and small images",
          inline: true,
        },
        { name: "5. Buttons", value: "Configure button links", inline: true }
      );

    const configRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("config_basic")
        .setLabel("Basic Settings")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("config_urls")
        .setLabel("Watch URLs")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("config_messages")
        .setLabel("Status Messages")
        .setStyle(ButtonStyle.Primary)
    );

    const configRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("config_images")
        .setLabel("Images")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("config_buttons")
        .setLabel("Buttons")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("save_config")
        .setLabel("Save Configuration")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [configEmbed],
      components: [configRow, configRow2],
      ephemeral: true,
    });
  }

  if (interaction.customId === "config_basic") {
    const configManager = require("./database/userConfig");
    const userConfig = configManager.getUserConfig(interaction.user.id);

    const modal = new ModalBuilder()
      .setCustomId("basic_settings_modal")
      .setTitle("Basic Settings");

    const cityInput = new TextInputBuilder()
      .setCustomId("city")
      .setLabel("City")
      .setPlaceholder("Enter your city (e.g., pattaya)")
      .setStyle(TextInputStyle.Short)
      .setValue(userConfig.setup?.city || "pattaya")
      .setRequired(true);

    const delayInput = new TextInputBuilder()
      .setCustomId("delay")
      .setLabel("Delay (seconds)")
      .setPlaceholder("Enter delay in seconds (e.g., 10)")
      .setStyle(TextInputStyle.Short)
      .setValue(String(userConfig.setup?.delay || 10))
      .setRequired(true);

    const cityRow = new ActionRowBuilder().addComponents(cityInput);
    const delayRow = new ActionRowBuilder().addComponents(delayInput);

    modal.addComponents(cityRow, delayRow);

    await interaction.showModal(modal);
  }

  if (interaction.customId === "config_urls") {
    const configManager = require("./database/userConfig");
    const userConfig = configManager.getUserConfig(interaction.user.id);

    const modal = new ModalBuilder()
      .setCustomId("urls_modal")
      .setTitle("Watch URLs");

    const urlsInput = new TextInputBuilder()
      .setCustomId("urls")
      .setLabel("Watch URLs (one per line)")
      .setPlaceholder(
        "Enter URLs to watch (e.g., https://www.twitch.tv/username)"
      )
      .setStyle(TextInputStyle.Paragraph)
      .setValue(userConfig.config?.options?.["watch-url"]?.join("\n") || "")
      .setRequired(true);

    const urlsRow = new ActionRowBuilder().addComponents(urlsInput);

    modal.addComponents(urlsRow);

    await interaction.showModal(modal);
  }

  if (interaction.customId === "config_messages") {
    const configManager = require("./database/userConfig");
    const userConfig = configManager.getUserConfig(interaction.user.id);

    const modal = new ModalBuilder()
      .setCustomId("messages_modal")
      .setTitle("Status Messages");

    const text1Input = new TextInputBuilder()
      .setCustomId("text1")
      .setLabel("Text 1 (one per line)")
      .setPlaceholder(
        "Enter time format text (e.g., {NF3( 〈 {emoji:time} {hour:1} : {min:1} 〉)}"
      )
      .setStyle(TextInputStyle.Paragraph)
      .setValue(userConfig.config?.["text-1"]?.join("\n") || "")
      .setRequired(false);

    const text2Input = new TextInputBuilder()
      .setCustomId("text2")
      .setLabel("Text 2 (one per line)")
      .setPlaceholder("Enter status messages (e.g., {NF3(Your Status Here)})")
      .setStyle(TextInputStyle.Paragraph)
      .setValue(userConfig.config?.["text-2"]?.join("\n") || "")
      .setRequired(false);

    const text3Input = new TextInputBuilder()
      .setCustomId("text3")
      .setLabel("Text 3 (one per line)")
      .setPlaceholder("Enter decorative text (e.g., ☆★✮⋆☆★✮⋆)")
      .setStyle(TextInputStyle.Paragraph)
      .setValue(userConfig.config?.["text-3"]?.join("\n") || "")
      .setRequired(false);

    const text1Row = new ActionRowBuilder().addComponents(text1Input);
    const text2Row = new ActionRowBuilder().addComponents(text2Input);
    const text3Row = new ActionRowBuilder().addComponents(text3Input);

    modal.addComponents(text1Row, text2Row, text3Row);

    await interaction.showModal(modal);
  }

  if (interaction.customId === "config_images") {
    const configManager = require("./database/userConfig");
    const userConfig = configManager.getUserConfig(interaction.user.id);

    const modal = new ModalBuilder()
      .setCustomId("images_modal")
      .setTitle("Images");

    const bigImgInput = new TextInputBuilder()
      .setCustomId("bigimg")
      .setLabel("Large Images (one URL per line)")
      .setPlaceholder("Enter URLs for large images")
      .setStyle(TextInputStyle.Paragraph)
      .setValue(userConfig.config?.bigimg?.join("\n") || "")
      .setRequired(false);

    const smallImgInput = new TextInputBuilder()
      .setCustomId("smallimg")
      .setLabel("Small Images (one URL per line)")
      .setPlaceholder("Enter URLs for small images")
      .setStyle(TextInputStyle.Paragraph)
      .setValue(userConfig.config?.smallimg?.join("\n") || "")
      .setRequired(false);

    const bigImgRow = new ActionRowBuilder().addComponents(bigImgInput);
    const smallImgRow = new ActionRowBuilder().addComponents(smallImgInput);

    modal.addComponents(bigImgRow, smallImgRow);

    await interaction.showModal(modal);
  }

  if (interaction.customId === "config_buttons") {
    const configManager = require("./database/userConfig");
    const userConfig = configManager.getUserConfig(interaction.user.id);

    const modal = new ModalBuilder()
      .setCustomId("buttons_modal")
      .setTitle("Buttons");

    const button1NameInput = new TextInputBuilder()
      .setCustomId("button1_name")
      .setLabel("Button 1 Name")
      .setPlaceholder("Enter name for the first button")
      .setStyle(TextInputStyle.Short)
      .setValue(userConfig.config?.["button-1"]?.[0]?.name || "")
      .setRequired(false);

    const button1UrlInput = new TextInputBuilder()
      .setCustomId("button1_url")
      .setLabel("Button 1 URL")
      .setPlaceholder("Enter URL for the first button")
      .setStyle(TextInputStyle.Short)
      .setValue(userConfig.config?.["button-1"]?.[0]?.url || "")
      .setRequired(false);

    const button2NameInput = new TextInputBuilder()
      .setCustomId("button2_name")
      .setLabel("Button 2 Name")
      .setPlaceholder("Enter name for the second button")
      .setStyle(TextInputStyle.Short)
      .setValue(userConfig.config?.["button-2"]?.[0]?.name || "")
      .setRequired(false);

    const button2UrlInput = new TextInputBuilder()
      .setCustomId("button2_url")
      .setLabel("Button 2 URL")
      .setPlaceholder("Enter URL for the second button")
      .setStyle(TextInputStyle.Short)
      .setValue(userConfig.config?.["button-2"]?.[0]?.url || "")
      .setRequired(false);

    const button1NameRow = new ActionRowBuilder().addComponents(
      button1NameInput
    );
    const button1UrlRow = new ActionRowBuilder().addComponents(button1UrlInput);
    const button2NameRow = new ActionRowBuilder().addComponents(
      button2NameInput
    );
    const button2UrlRow = new ActionRowBuilder().addComponents(button2UrlInput);

    modal.addComponents(
      button1NameRow,
      button1UrlRow,
      button2NameRow,
      button2UrlRow
    );

    await interaction.showModal(modal);
  }

  if (interaction.customId === "save_config") {
    const configManager = require("./database/userConfig");
    const userConfig = configManager.getUserConfig(interaction.user.id);

    // Create a temporary config object to store the current configuration
    const tempConfig = {
      setup: {
        city: userConfig.setup?.city || "pattaya",
        delay: userConfig.setup?.delay || 10,
      },
      config: {
        options: {
          "watch-url": userConfig.config?.options?.["watch-url"] || [],
          timestamp: userConfig.config?.options?.timestamp || "{start}",
        },
        "text-1": userConfig.config?.["text-1"] || [],
        "text-2": userConfig.config?.["text-2"] || [],
        "text-3": userConfig.config?.["text-3"] || [],
        bigimg: userConfig.config?.bigimg || [],
        smallimg: userConfig.config?.smallimg || [],
        "button-1": userConfig.config?.["button-1"] || [],
        "button-2": userConfig.config?.["button-2"] || [],
      },
    };

    // Save the configuration
    const success = configManager.setUserConfig(
      interaction.user.id,
      tempConfig
    );

    if (success) {
      const configEmbed = new EmbedBuilder()
        .setColor(0xf1efef)
        .setDescription(
          "```Your streaming configuration has been saved successfully!```"
        )
        .addFields(
          { name: "City", value: tempConfig.setup.city, inline: true },
          { name: "Delay", value: `${tempConfig.setup.delay}s`, inline: true },
          {
            name: "Watch URLs",
            value:
              tempConfig.config.options["watch-url"].length > 0
                ? tempConfig.config.options["watch-url"].join("\n")
                : "None set",
            inline: false,
          },
          {
            name: "Status Messages",
            value:
              tempConfig.config["text-2"].length > 0
                ? `${tempConfig.config["text-2"].length} messages set`
                : "None set",
            inline: true,
          },
          {
            name: "Images",
            value:
              tempConfig.config.bigimg.length > 0
                ? `${tempConfig.config.bigimg.length} images set`
                : "None set",
            inline: true,
          }
        );

      await interaction.reply({
        embeds: [configEmbed],
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "❌ Failed to save configuration. Please try again.",
        ephemeral: true,
      });
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "next_image") return;

  try {
    const configManager = require("./database/userConfig");
    const userConfig = configManager.getUserConfig(interaction.user.id);
    const images = userConfig.config?.bigimg || [];

    if (images.length <= 1) return;

    const currentEmbed = interaction.message.embeds[0];
    const currentImage = currentEmbed.image?.url;
    let currentIndex = images.findIndex((img) => img === currentImage);
    let nextIndex = (currentIndex + 1) % images.length;

    const newEmbed = EmbedBuilder.from(currentEmbed).setImage(
      images[nextIndex]
    );

    await interaction.update({
      embeds: [newEmbed],
      components: interaction.message.components,
    });
  } catch (error) {
    console.error("Error updating image:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "token_modal") {
    const tokenInput = interaction.fields
      .getTextInputValue("token_value")
      .trim();
    const tokens = tokenInput
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token);

    if (tokens.length === 0) {
      await interaction.reply({
        content: "❌ No valid tokens provided.",
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      const db = require("./database/db");

      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      const resultsEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setDescription(`Processing ${tokens.length} token(s)...`);

      const existingTokens = db.getUserTokens(interaction.user.id);
      const existingValues = existingTokens.map((token) => token.value);

      for (const token of tokens) {
        try {
          if (existingValues.includes(token)) {
            duplicateCount++;
            continue;
          }

          const isValid = await validateSelfbotToken(token);

          if (isValid) {
            const success = await db.setUserToken(interaction.user.id, token);

            if (success) {
              validCount++;
              existingValues.push(token);
            } else {
              invalidCount++;
              console.log(`Failed to save valid token to database`);
            }
          } else {
            invalidCount++;
          }
        } catch (err) {
          console.error(`Error processing token: ${err}`);
          invalidCount++;
        }
      }

      resultsEmbed
        .setDescription(`Processed ${tokens.length} token(s)`)
        .addFields(
          {
            name: "``✅`` Successfully Added",
            value: `${validCount} token(s)`,
            inline: true,
          },
          {
            name: "``❌`` Failed",
            value: `${invalidCount} token(s)`,
            inline: true,
          }
        );

      if (duplicateCount > 0) {
        resultsEmbed.addFields({
          name: "``⚠️`` Duplicates Skipped",
          value: `${duplicateCount} token(s)`,
          inline: true,
        });
      }

      if (validCount > 0) {
        resultsEmbed.addFields({
          name: "Next Steps",
          value:
            "```You can now use these tokens to start your streaming status.```",
        });
      }

      if (invalidCount > 0) {
        resultsEmbed.addFields({
          name: "Invalid Tokens",
          value:
            "Some tokens couldn't be validated. Make sure they are:\n" +
            "• Valid user tokens (not bot tokens)\n" +
            "• Not expired\n" +
            "• Properly formatted",
        });
      }

      await interaction.editReply({
        embeds: [resultsEmbed],
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error in token validation:", error);

      let errorMessage = "❌ Error processing tokens. ";
      if (error.message.includes("JSON")) {
        errorMessage += "Invalid token format detected.";
      } else {
        errorMessage += "Please try again later.";
      }
      try {
        await interaction.editReply({
          content: errorMessage,
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.customId === "streaming_config_modal") {
    try {
      const configJson = interaction.fields.getTextInputValue("config_json");
      const configData = JSON.parse(configJson);
      const configManager = require("./database/userConfig");

      const success = configManager.setUserConfig(
        interaction.user.id,
        configData
      );

      if (success) {
        const configEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("Streaming Configuration Updated")
          .setDescription("Your streaming configuration has been saved!")
          .addFields(
            {
              name: "City",
              value: configData.setup?.city || "Not set",
              inline: true,
            },
            {
              name: "Delay",
              value: `${configData.setup?.delay || 0}s`,
              inline: true,
            },
            {
              name: "Status Count",
              value: `${
                configData.config?.["text-2"]?.length || 0
              } status messages`,
              inline: true,
            },
            {
              name: "Image Count",
              value: `${configData.config?.bigimg?.length || 0} images`,
              inline: true,
            },
            {
              name: "Watch URLs",
              value:
                configData.config?.options?.["watch-url"]?.join("\n") ||
                "None set",
            }
          )
          .setFooter({
            text: "Use the streaming panel to start/stop streaming",
          })
          .setTimestamp();

        await interaction.reply({
          embeds: [configEmbed],
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Failed to save configuration. Please try again.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error saving config:", error);
      await interaction.reply({
        content:
          "❌ Invalid JSON format. Please check your configuration and try again.",
        ephemeral: true,
      });
    }
  }

  if (interaction.customId === "basic_settings_modal") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const city = interaction.fields.getTextInputValue("city").trim();
      const delay =
        parseInt(interaction.fields.getTextInputValue("delay").trim()) || 10;

      const configManager = require("./database/userConfig");
      const userConfig = configManager.getUserConfig(interaction.user.id);

      // Update the configuration
      if (!userConfig.setup) userConfig.setup = {};
      userConfig.setup.city = city;
      userConfig.setup.delay = delay;

      // Save the configuration
      const success = configManager.setUserConfig(
        interaction.user.id,
        userConfig
      );

      if (success) {
        await interaction.editReply({
          content: "✅ Basic settings updated successfully!",
        });
      } else {
        await interaction.editReply({
          content: "❌ Failed to update basic settings. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error updating basic settings:", error);
      await interaction.editReply({
        content: "❌ An error occurred while updating basic settings.",
      });
    }
  }

  if (interaction.customId === "urls_modal") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const urlsText = interaction.fields.getTextInputValue("urls").trim();
      const urls = urlsText
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => url);

      const configManager = require("./database/userConfig");
      const userConfig = configManager.getUserConfig(interaction.user.id);

      // Update the configuration
      if (!userConfig.config) userConfig.config = {};
      if (!userConfig.config.options) userConfig.config.options = {};
      userConfig.config.options["watch-url"] = urls;

      // Save the configuration
      const success = configManager.setUserConfig(
        interaction.user.id,
        userConfig
      );

      if (success) {
        await interaction.editReply({
          content: `✅ Watch URLs updated successfully! ${urls.length} URL(s) set.`,
        });
      } else {
        await interaction.editReply({
          content: "❌ Failed to update watch URLs. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error updating watch URLs:", error);
      await interaction.editReply({
        content: "❌ An error occurred while updating watch URLs.",
      });
    }
  }

  if (interaction.customId === "messages_modal") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const text1 = interaction.fields
        .getTextInputValue("text1")
        .trim()
        .split("\n")
        .filter((text) => text);
      const text2 = interaction.fields
        .getTextInputValue("text2")
        .trim()
        .split("\n")
        .filter((text) => text);
      const text3 = interaction.fields
        .getTextInputValue("text3")
        .trim()
        .split("\n")
        .filter((text) => text);

      const configManager = require("./database/userConfig");
      const userConfig = configManager.getUserConfig(interaction.user.id);

      // Update the configuration
      if (!userConfig.config) userConfig.config = {};
      userConfig.config["text-1"] = text1;
      userConfig.config["text-2"] = text2;
      userConfig.config["text-3"] = text3;

      // Save the configuration
      const success = configManager.setUserConfig(
        interaction.user.id,
        userConfig
      );

      if (success) {
        await interaction.editReply({
          content: "✅ Status messages updated successfully!",
        });
      } else {
        await interaction.editReply({
          content: "❌ Failed to update status messages. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error updating status messages:", error);
      await interaction.editReply({
        content: "❌ An error occurred while updating status messages.",
      });
    }
  }

  if (interaction.customId === "images_modal") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const bigimg = interaction.fields
        .getTextInputValue("bigimg")
        .trim()
        .split("\n")
        .filter((url) => url);
      const smallimg = interaction.fields
        .getTextInputValue("smallimg")
        .trim()
        .split("\n")
        .filter((url) => url);

      const configManager = require("./database/userConfig");
      const userConfig = configManager.getUserConfig(interaction.user.id);

      // Update the configuration
      if (!userConfig.config) userConfig.config = {};
      userConfig.config.bigimg = bigimg;
      userConfig.config.smallimg = smallimg;

      // Save the configuration
      const success = configManager.setUserConfig(
        interaction.user.id,
        userConfig
      );

      if (success) {
        await interaction.editReply({
          content: `✅ Images updated successfully! ${bigimg.length} large image(s) and ${smallimg.length} small image(s) set.`,
        });
      } else {
        await interaction.editReply({
          content: "❌ Failed to update images. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error updating images:", error);
      await interaction.editReply({
        content: "❌ An error occurred while updating images.",
      });
    }
  }

  if (interaction.customId === "buttons_modal") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const button1Name = interaction.fields
        .getTextInputValue("button1_name")
        .trim();
      const button1Url = interaction.fields
        .getTextInputValue("button1_url")
        .trim();
      const button2Name = interaction.fields
        .getTextInputValue("button2_name")
        .trim();
      const button2Url = interaction.fields
        .getTextInputValue("button2_url")
        .trim();

      const configManager = require("./database/userConfig");
      const userConfig = configManager.getUserConfig(interaction.user.id);

      // Update the configuration
      if (!userConfig.config) userConfig.config = {};

      // Button 1
      if (button1Name && button1Url) {
        userConfig.config["button-1"] = [
          {
            name: button1Name,
            url: button1Url,
          },
        ];
      } else {
        userConfig.config["button-1"] = [];
      }

      // Button 2
      if (button2Name && button2Url) {
        userConfig.config["button-2"] = [
          {
            name: button2Name,
            url: button2Url,
          },
        ];
      } else {
        userConfig.config["button-2"] = [];
      }

      // Save the configuration
      const success = configManager.setUserConfig(
        interaction.user.id,
        userConfig
      );

      if (success) {
        await interaction.editReply({
          content: "✅ Buttons updated successfully!",
        });
      } else {
        await interaction.editReply({
          content: "❌ Failed to update buttons. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error updating buttons:", error);
      await interaction.editReply({
        content: "❌ An error occurred while updating buttons.",
      });
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === "select_token_to_remove") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const tokenValue = interaction.values[0];
      const db = require("./database/db");

      const success = db.removeUserToken(interaction.user.id, tokenValue);

      if (success) {
        await interaction.editReply({
          content: "``✅`` **Token successfully removed!**",
        });
      } else {
        await interaction.editReply({
          content: "❌ Failed to remove token. Please try again.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error in select menu handler:", error);
      await interaction.editReply({
        content: "An error occurred while removing the token.",
        ephemeral: true,
      });
    }
  }
});

async function validateSelfbotToken(token) {
  return TokenValidator.validateToken(token);
}

client.login(process.env.TOKEN);
