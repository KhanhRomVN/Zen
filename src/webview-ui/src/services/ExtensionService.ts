// Type definitions for VS Code API
export interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare global {
  interface Window {
    vscodeApi?: VSCodeAPI;
    acquireVsCodeApi?(): VSCodeAPI;
  }
}

class ExtensionService {
  private static instance: ExtensionService;
  private api: VSCodeAPI;

  private constructor() {
    this.api = this.getVSCodeApi();
  }

  public static getInstance(): ExtensionService {
    if (!ExtensionService.instance) {
      ExtensionService.instance = new ExtensionService();
    }
    return ExtensionService.instance;
  }

  private getVSCodeApi(): VSCodeAPI {
    // Check if API is already acquired and stored in window
    if (window.vscodeApi) {
      return window.vscodeApi;
    }

    if (window.acquireVsCodeApi) {
      const api = window.acquireVsCodeApi();
      window.vscodeApi = api;
      return api;
    }

    // Fallback if not in VS Code environment
    return {
      postMessage: (msg: any) => console.log("Mock postMessage:", msg),
      getState: () => ({}),
      setState: () => {},
    };
  }

  public postMessage(message: any): void {
    this.api.postMessage(message);
  }

  public getStorage(): any {
    return {
      get: (key: string) =>
        this.storageRequest("storageGet", "storageGetResponse", { key }),
      set: (key: string, value: string) =>
        this.storageRequest("storageSet", "storageSetResponse", { key, value }),
      delete: (key: string) =>
        this.storageRequest("storageDelete", "storageDeleteResponse", { key }),
      list: (prefix?: string) =>
        this.storageRequest("storageList", "storageListResponse", { prefix }),
    };
  }

  private storageRequest(
    command: string,
    responseCommand: string,
    payload: any,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `${command}-${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(
        () => reject(new Error(`${command} timeout`)),
        5000,
      );

      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (
          message.command === responseCommand &&
          message.requestId === requestId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          if (message.error) {
            reject(new Error(message.error));
          } else {
            // Unpack specific responses
            if (command === "storageGet")
              resolve(
                message.value
                  ? { key: payload.key, value: message.value }
                  : null,
              );
            else if (command === "storageList")
              resolve({ keys: message.keys || [] });
            else if (command === "storageDelete")
              resolve({ key: payload.key, deleted: true });
            else if (command === "storageSet")
              resolve({ key: payload.key, value: payload.value });
            else resolve(message);
          }
        }
      };

      window.addEventListener("message", handler);
      this.postMessage({ command, requestId, ...payload });
    });
  }
}

export const extensionService = ExtensionService.getInstance();
