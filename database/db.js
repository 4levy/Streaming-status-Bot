const fs = require("fs");
const path = require("path");

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

  setUserToken(userId, username, token) {
    if (!this.data.users[userId]) {
      this.data.users[userId] = {
        username: username,
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

    this.data.users[userId].tokens.push({
      value: token,
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
