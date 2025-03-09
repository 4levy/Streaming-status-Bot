class MemoryManager {
  static checkMemoryUsage() {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round((used.heapUsed / 1024 / 1024) * 100) / 100;
    const heapTotalMB = Math.round((used.heapTotal / 1024 / 1024) * 100) / 100;

    return {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      percentage: Math.round((heapUsedMB / heapTotalMB) * 100),
    };
  }

  static async cleanupMemory() {
    if (global.gc) {
      global.gc();
    }

    return new Promise((resolve) => setTimeout(resolve, 100));
  }

  static shouldCleanup() {
    const { percentage } = this.checkMemoryUsage();
    return percentage > 75; 
  }

  static async monitorAndCleanup() {
    if (this.shouldCleanup()) {
      await this.cleanupMemory();
    }
  }
}

module.exports = MemoryManager;
