class JsonValidator {
  static validateConfig(jsonString) {
    try {
      const config = JSON.parse(jsonString);

      if (!config.setup || !config.config) {
        throw new Error("Missing required 'setup' or 'config' sections");
      }

      if (!config.setup.city || !config.setup.delay) {
        throw new Error("Setup section missing required fields (city, delay)");
      }

      if (!config.config.options || !config.config.options["watch-url"]) {
        throw new Error("Config section missing required options or watch-url");
      }

      if (
        !Array.isArray(config.config.options["watch-url"]) ||
        config.config.options["watch-url"].length === 0
      ) {
        throw new Error("watch-url must be a non-empty array");
      }

      config.setup.city = String(config.setup.city).trim();
      config.setup.delay = Number(config.setup.delay) || 10;

      return {
        isValid: true,
        config: config,
        error: null,
      };
    } catch (error) {
      return {
        isValid: false,
        config: null,
        error: error.message,
      };
    }
  }

  static splitLargeConfig(config) {
    try {
      const configString = JSON.stringify(config);

      if (configString.length < 100000) {
        return {
          isSplit: false,
          parts: [config],
          error: null,
        };
      }

      const modifiedConfig = { ...config };
      if (
        modifiedConfig.config.bigimg &&
        modifiedConfig.config.bigimg.length > 10
      ) {
        modifiedConfig.config.bigimg = modifiedConfig.config.bigimg.slice(
          0,
          10
        );
      }
      if (
        modifiedConfig.config["text-2"] &&
        modifiedConfig.config["text-2"].length > 20
      ) {
        modifiedConfig.config["text-2"] = modifiedConfig.config["text-2"].slice(
          0,
          20
        );
      }

      return {
        isSplit: true,
        parts: [modifiedConfig],
        error: null,
      };
    } catch (error) {
      return {
        isSplit: false,
        parts: null,
        error: error.message,
      };
    }
  }
}

module.exports = JsonValidator;
