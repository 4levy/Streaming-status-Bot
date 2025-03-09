const fs = require("fs");
const path = require("path");

class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, "userConfig.json");
    this.data = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, "utf8"));
      }
      return { users: {} };
    } catch (error) {
      console.error("Error loading config:", error);
      return { users: {} };
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
      return true;
    } catch (error) {
      console.error("Error saving config:", error);
      return false;
    }
  }

  getDefaultConfig() {
    return {
      setup: {
        city: "pattaya",
        delay: 10,
      },
      config: {
        options: {
          "watch-url": [
            "https://www.twitch.tv/4levy_z1",
            "https://www.youtube.com/watch?v=HuFZX0LB29g",
          ],
          timestamp: "{start}",
        },
        "text-1": [
          "{NF3( 〈 {emoji:time} {hour:1} : {min:1} 〉 ⭒ 〈 📆 {th=date} / {en=month:3} / {en=year:2} 〉 )}",
        ],
        "text-2": [
          "{NF3(Shorekeeper Loading..)}",
          "☆ | 💙 ╺  Shorekeeper  ྀི𓈒",
          "☆ | 💙⠀╺  Shorekeeper  ྀི𓈒",
        ],
        "text-3": ["☆★✮⋆☆★✮⋆ | ᶻ 𝘇 𐰁  "],
        bigimg: [
          "https://i.postimg.cc/hPvfwgm6/e82a9cc4dfb33f35ae9e80516029a4bd.jpg",
        ],
        smallimg: [],
        "button-1": [
          {
            name: "Miyako's server",
            url: "https://discord.gg/TSdpyMMfrU",
          },
        ],
        "button-2": [
          {
            name: "Stream status > Deobf",
            url: "https://github.com/4levy/Streaming-status",
          },
        ],
      },
      _isDefault: true,
    };
  }

  getUserConfig(userId) {
    if (!this.data.users[userId]) {
      const defaultConfig = this.getDefaultConfig();
      return defaultConfig;
    }

    const userConfig = this.data.users[userId];
    userConfig._isDefault = false;
    return userConfig;
  }

  setUserConfig(userId, config) {
    try {
      if (!this.data.users) {
        this.data.users = {};
      }

      const configToSave = { ...config };
      delete configToSave._isDefault;

      this.data.users[userId] = configToSave;
      return this.saveConfig();
    } catch (error) {
      console.error("Error setting user config:", error);
      return false;
    }
  }

  isDefaultConfig(userId) {
    return !this.data.users[userId];
  }
}

module.exports = new ConfigManager();
