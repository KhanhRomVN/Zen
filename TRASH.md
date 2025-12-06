[read_file for 'src/background/bootstrap/dependency-container.ts'] Result:
// src/background/bootstrap/dependency-container.ts

/**
 * Dependency Injection Container đơn giản
 */
  public has(serviceName: string): boolean {
    return this.services.has(serviceName) || this.factories.has(serviceName);
  }

  /**
   * Lấy tất cả registered services
   */
  public getAll(): Map<string, any> {
    // Ensure all factories are resolved
    this.resolveAll().catch((error) => {
      console.error("[DependencyContainer] ❌ Error resolving all:", error);
    });

    return new Map(this.services);
  }

  /**
   * Xóa một service
   */
  public remove(serviceName: string): boolean {
    const hadService = this.services.delete(serviceName);
    const hadFactory = this.factories.delete(serviceName);

    if (hadService || hadFactory) {
      console.log(`[DependencyContainer] 🗑️ Removed service: ${serviceName}`);
    }

    return hadService || hadFactory;
  }

  /**
   * Xóa tất cả services
   */
  public clear(): void {
    const serviceCount = this.services.size;
    const factoryCount = this.factories.size;

    this.services.clear();
    this.factories.clear();

    console.log(
      `[DependencyContainer] 🧹 Cleared all services (${serviceCount} services, ${factoryCount} factories)`
    );
  }

  /**
   * Get service names for debugging
   */
  public getServiceNames(): { services: string[]; factories: string[] } {
    return {
      services: Array.from(this.services.keys()),
      factories: Array.from(this.factories.keys()),
    };
  }


<environment_details>
# Visual Studio Code Visible Files
src/background/bootstrap/startup-manager.ts

# Visual Studio Code Open Tabs
src/background/bootstrap/dependency-container.ts
src/background/bootstrap/startup-manager.ts

# Current Time
12/5/2025, 11:25:29 PM (Asia/Saigon, UTC+7:00)

# Context Window Usage
20,330 / 128K tokens used (16%)

# Current Mode
ACT MODE
</environment_details>