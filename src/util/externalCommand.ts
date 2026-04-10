import * as vscode from 'vscode';
import { configuration } from '../configuration/configuration';
import { VimError } from '../error';

class ExternalCommand {
  private previousExternalCommand: string | undefined;
  private _outputChannel: vscode.OutputChannel | undefined;

  private get outputChannel(): vscode.OutputChannel {
    if (!this._outputChannel) {
      this._outputChannel = vscode.window.createOutputChannel('vim terminal');
    }
    return this._outputChannel;
  }

  /**
   * Expands the given command by replacing any '!' with the previous external
   * command. The '!' can be escaped if there is a backslash preceeding the
   * '!', then the backslash is removed and the '!' is kept.
   *
   * If a '!' is present but there is no previous external command, then a
   * VimError is thrown.
   * @param command the command to expand
   */
  private expandCommand(command: string): string {
    const result: string[] = [];

    for (let i = 0; i < command.length; i++) {
      if (command[i] === '!') {
        if (i > 0 && command[i - 1] === '\\') {
          // escape the '!' and keep it
          result.pop();
          result.push('!');
        } else if (!this.previousExternalCommand) {
          // no previous command available to substitute
          throw VimError.NoPreviousCommand();
        } else {
          result.push(this.previousExternalCommand);
        }
      } else {
        result.push(command[i]);
      }
    }
    return result.join('');
  }

  /**
   * Runs the given command as a background process and shows the command and
   * its output in the "vim terminal" Output Channel. The channel is revealed
   * without stealing focus from the editor.
   *
   * @param command the command to run
   * @param cwd working directory for the child process
   */
  public async runInOutput(command: string, cwd?: string): Promise<void> {
    command = this.expandCommand(command);
    this.previousExternalCommand = command;

    this.outputChannel.appendLine(`$ ${command}`);
    // preserveFocus=true keeps the editor focused so the user can keep typing
    this.outputChannel.show(true);

    const output = await this.execute(command, '', cwd);
    this.outputChannel.append(output);
    if (!output.endsWith('\n')) {
      this.outputChannel.appendLine('');
    }
  }

  /**
   * Executes `command` and returns the output.
   * @param command the command to run
   * @param stdin string to pipe into stdin
   * @param cwd working directory for the child process
   */
  private async execute(command: string, stdin: string, cwd?: string): Promise<string> {
    const output: string[] = [];
    // combines stdout and stderr (compatible for all platforms)
    command += ' 2>&1';
    const options = {
      shell: configuration.shell || undefined,
      cwd,
    };

    try {
      const exec = (await import('../util/child_process')).exec;

      const promise = exec(command, options);
      const process = promise.child;

      if (process.stdin !== null) {
        process.stdin.on('error', () => {
          // Make write EPIPE errors silent (e.g. when writing to program not expecting stdin)
        });
        process.stdin.write(stdin);
        process.stdin.end();
      }

      if (process.stdout !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        process.stdout.on('data', (chunk) => output.push(chunk));
      }
      if (process.stderr !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        process.stderr.on('data', (chunk) => output.push(chunk));
      }

      await promise;
    } catch (e) {
      // exec throws an error if exit code != 0
      // keep going and read the output anyway (just like vim)
    }
    return output.join('');
  }

  /**
   * Runs the given command and returns the output (stdout and stderr).
   * Optionally, `stdin` can be piped into stdin during execution.
   *
   * @param command the command to run
   * @param stdin string to pipe into stdin, by default the empty string
   * @param cwd working directory for the child process
   */
  public async run(command: string, stdin: string = '', cwd?: string): Promise<string> {
    command = this.expandCommand(command);
    this.previousExternalCommand = command;

    let output = await this.execute(command, stdin, cwd);
    // vim behavior, trim newlines
    if (output.endsWith('\r\n')) {
      output = output.slice(0, -2);
    } else if (output.endsWith('\n')) {
      output = output.slice(0, -1);
    }

    return output;
  }
}

export const externalCommand = new ExternalCommand();
