const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "activeStreams.json");

class ActiveStreamsManager {
  constructor() {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.ensureFile();
  }

  ensureFile() {
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
        console.log("Created new activeStreams.json file");
      } else {
        const content = fs.readFileSync(filePath, "utf8");
        JSON.parse(content); 
      }
    } catch (error) {
      console.error("Error with activeStreams.json, creating new file:", error);
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    }
  }

  getActiveUsers() {
    try {
      if (!fs.existsSync(filePath)) {
        this.ensureFile();
        return [];
      }
      const data = fs.readFileSync(filePath, "utf8");
      const users = JSON.parse(data);
      return Array.isArray(users) ? users : [];
    } catch (error) {
      console.error("Error reading active streams:", error);
      return [];
    }
  }

  addUser(userId) {
    const users = this.getActiveUsers();
    if (!users.includes(userId)) {
      users.push(userId);
      this.saveUsers(users);
    }
  }

  removeUser(userId) {
    const users = this.getActiveUsers();
    const filteredUsers = users.filter((id) => id !== userId);
    this.saveUsers(filteredUsers);
  }

  saveUsers(users) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
    } catch (error) {
      console.error("Error saving active streams:", error);
    }
  }
}

module.exports = new ActiveStreamsManager();
