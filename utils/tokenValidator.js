const fetch = require("node-fetch");

class TokenValidator {
  static async validateToken(token) {
    try {
      token = token.trim();
      if (!token || typeof token !== "string") return false;

      if (!token.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)) {
        return false;
      }

      const response = await fetch("https://discord.com/api/v9/users/@me", {
        method: "GET",
        headers: {
          Authorization: token.replace(/[^\x20-\x7E]/g, ""),
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return true;
      }

      if (response.status === 403) {
        console.log("Token may be valid but lacks permissions");
        return true;
      }

      console.log("Token validation failed with status:", response.status);
      return false;
    } catch (error) {
      console.error("Token validation error:", error);
      return false;
    }
  }
}

module.exports = TokenValidator;
