const fs = require("fs");
const path = require("path");
const TokenValidator = require("../utils/tokenValidator");

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, "userTokens.json");
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, "utf8");
        return JSON.parse(data);
      }
      return { users: {} };
    } catch (error) {
      console.error("Error loading database:", error);
      return { users: {} };
    }
  }

  saveData() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
      return true;
    } catch (error) {
      console.error("Error saving database:", error);
      return false;
    }
  }

  async setUserToken(userId, token) {
    if (!this.data.users[userId]) {
      this.data.users[userId] = {
        tokens: [],
      };
    }

    const tokenExists = this.data.users[userId].tokens.some(
      (t) => t.value === token
    );

    if (tokenExists) {
      console.log(`Token already exists for user ${userId}`);
      return false;
    }

    let username = null;
    let avatarUrl = null;
    let fetchSuccess = false;

    try {
      const isValid = await TokenValidator.validateToken(token);
      if (isValid) {
        const cleanToken = token.replace(/[^\x20-\x7E]/g, "");
        const response = await fetch("https://discord.com/api/v9/users/@me", {
          method: "GET",
          headers: {
            Authorization: cleanToken,
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (response.ok) {
          const data = await response.json();
          username = data.username || "Unknown User";
          avatarUrl = data.avatar
            ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
            : null;
          fetchSuccess = true;
          console.log(`Successfully fetched username for token: ${username}`);
        } else {
          console.error(`Failed to fetch username, status: ${response.status}`);
          try {
            const errorData = await response.json();
            console.error("Error details:", JSON.stringify(errorData));
          } catch (e) {
          }
        }
      } else {
        console.error("Token validation failed");
      }
    } catch (error) {
      console.error("Error during token validation or API fetch:", error);
    }

    if (!username) {
      username = fetchSuccess ? "Discord User" : "Unknown User";
    }

    this.data.users[userId].tokens.push({
      value: token,
      username,
      avatarUrl,
      fetchSuccess,
      addedAt: new Date().toISOString(),
    });

    return this.saveData();
  }

  getUserTokens(userId) {
    if (!this.data.users[userId]) {
      return [];
    }
    return this.data.users[userId].tokens;
  }

  tokenExists(userId, tokenValue) {
    if (!this.data.users[userId] || !this.data.users[userId].tokens) {
      return false;
    }

    return this.data.users[userId].tokens.some((t) => t.value === tokenValue);
  }

  removeUserToken(userId, tokenValue) {
    try {
      if (!this.data.users[userId] || !this.data.users[userId].tokens) {
        console.log("No tokens found for user:", userId);
        return false;
      }

      const originalLength = this.data.users[userId].tokens.length;
      console.log("Original tokens:", originalLength);

      this.data.users[userId].tokens = this.data.users[userId].tokens.filter(
        (t) => t.value !== tokenValue
      );

      console.log("Remaining tokens:", this.data.users[userId].tokens.length);

      if (this.data.users[userId].tokens.length !== originalLength) {
        const saved = this.saveData();
        console.log("Save successful:", saved);
        return saved;
      }

      return false;
    } catch (error) {
      console.error("Error in removeUserToken:", error);
      return false;
    }
  }

  getUserTokenCount(userId) {
    if (!this.data.users[userId] || !this.data.users[userId].tokens) {
      return 0;
    }
    return this.data.users[userId].tokens.length;
  }

  clearUserTokens(userId) {
    if (!this.data.users[userId]) {
      return false;
    }

    this.data.users[userId].tokens = [];
    return this.saveData();
  }
}

module.exports = new Database();
