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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
  sweepers: {
    messages: {
      interval: 120, // 2 minutes
      lifetime: 60, // 1 minute
    },
  },
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing required properties.`
    );
  }
}

// Event handling
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  client.user.setActivity("You", { type: 3 });

  // Restore active streams
  try {
    const activeUsers = activeStreamsManager.getActiveUsers();
    console.log(`Restoring streams for ${activeUsers.length} users...`);

    for (const userId of activeUsers) {
      const db = require("./database/db");
      const configManager = require("./database/userConfig");
      const userTokens = db.getUserTokens(userId);
      const userConfig = configManager.getUserConfig(userId);

      if (userTokens && userTokens.length > 0 && userConfig) {
        console.log(`Restoring stream for user ${userId}`);
        await streamManager.startStream(userId, userTokens, userConfig);
        streamManager.startStatusCheck(userId);
      } else {
        console.log(
          `Cannot restore stream for user ${userId}: missing tokens or config`
        );
        activeStreamsManager.removeUser(userId);
      }
    }
  } catch (error) {
    console.error("Error restoring streams:", error);
  }

  registerCommands();
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
        components: [] 
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
            value: "Click the 'Config' button to set up your streaming configuration.",
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
          components: [updatedRow]
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
      components: [interaction.message.components[0]]
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
    const configEmbed = new EmbedBuilder().setColor(0x3498db).addFields({
      name: "1. Upload Config File",
      value: "Use `/upload-config` to upload your .json file",
    });

    await interaction.reply({
      embeds: [configEmbed],
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
      const tokens = db.getUserTokens(interaction.user.id);

      if (tokens.length === 0) {
        const noTokensEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setDescription("```You don't have any saved tokens yet.```");

        await interaction.reply({
          embeds: [noTokensEmbed],
          ephemeral: true
        }).catch(error => {
          console.error("Error replying to interaction:", error);
        });
        return;
      }

      const tokenListEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setDescription(`You have ${tokens.length} saved token(s)`);

      tokens.forEach((token, index) => {
        tokenListEmbed.addFields({
          name: `Token ${index + 1}`,
          value: `Added: ${new Date(token.addedAt).toLocaleDateString()}`
        });
      });

      await interaction.reply({
        embeds: [tokenListEmbed],
        ephemeral: true
      }).catch(error => {
        console.error("Error replying with token list:", error);
      });
    } catch (error) {
      console.error("Error in view_tokens handler:", error);

      if (interaction.isRepliable()) {
        await interaction.reply({
          content: "An error occurred while fetching tokens.",
          ephemeral: true
        }).catch(console.error);
      }
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
        label: `Token ${index + 1}`,
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
        .setColor(0x3498db)
        .setTitle("Sample Configuration")
        .setDescription(
          "Copy this configuration and modify it for your needs:"
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
            const success = db.setUserToken(
              interaction.user.id,
              interaction.user.tag,
              token
            );

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

// Register slash commands
async function registerCommands() {
  try {
    const commands = [];
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
}

client.login(process.env.TOKEN);
