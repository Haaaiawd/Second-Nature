import { cliCommands, type CliCommandDefinition } from "./commands/index.js";

export interface CommandRouter {
  commands: CliCommandDefinition[];
  resolve(name: string): CliCommandDefinition | undefined;
}

export function createCommandRouter(): CommandRouter {
  return {
    commands: cliCommands,
    resolve(name: string) {
      return cliCommands.find((command) => command.name === name);
    },
  };
}
