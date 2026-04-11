import * as vscode from 'vscode';
import { IConfiguration } from './configuration/iconfiguration';

/**
 * Global variables shared throughout extension
 */
export class Globals {
  /**
   * This is where we put files like HistoryFile. The path is given to us by VSCode.
   */
  static extensionStoragePath: string;

  /**
   * The URI of the extension's global storage directory, as provided by VS Code.
   * Carries the correct scheme and authority for the current environment
   * (local, SSH remote, Codespaces, etc.) and can be used to construct other
   * environment-aware URIs via `.with({ path: ... })`.
   */
  static extensionStorageUri: vscode.Uri;

  /**
   * Used for testing.
   */
  static isTesting = false;
  static mockConfiguration: IConfiguration;
}
