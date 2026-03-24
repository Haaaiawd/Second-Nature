declare module "openclaw/plugin-sdk/plugin-entry" {
  export interface OpenClawPluginApi {
    registerCommand(definition: unknown): void;
    registerCli(registrar: unknown, options?: unknown): void;
    registerTool(tool: unknown, options?: unknown): void;
    registerService(service: unknown): void;
  }

  export interface PluginEntryDefinition {
    id: string;
    name: string;
    description?: string;
    register(api: OpenClawPluginApi): void | Promise<void>;
  }

  export function definePluginEntry(definition: PluginEntryDefinition): PluginEntryDefinition;
}
