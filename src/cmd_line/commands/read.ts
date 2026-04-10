// eslint-disable-next-line id-denylist
import { all, alt, optWhitespace, Parser, seq, string, whitespace } from 'parsimmon';
import * as vscode from 'vscode';
import { SUPPORT_READ_COMMAND } from 'platform/constants';
import { readFileAsync } from 'platform/fs';
import { VimState } from '../../state/vimState';
import { externalCommand } from '../../util/externalCommand';
import { ExCommand } from '../../vimscript/exCommand';
import { fileNameParser, FileOpt, fileOptParser } from '../../vimscript/parserUtils';

export type IReadCommandArguments =
  | { opt: FileOpt; cmd: string }
  | { opt: FileOpt; file: string }
  | { opt: FileOpt };

//
//  Implements :read and :read!
//  http://vimdoc.sourceforge.net/htmldoc/insert.html#:read
//  http://vimdoc.sourceforge.net/htmldoc/insert.html#:read!
//
export class ReadCommand extends ExCommand {
  public static readonly argParser: Parser<ReadCommand> = seq(
    whitespace.then(fileOptParser).fallback<FileOpt>([]),
    optWhitespace
      .then(
        alt<{ cmd: string } | { file: string }>(
          string('!')
            .then(all)
            .map((cmd) => ({ cmd })),
          fileNameParser.map((file) => ({ file })),
        ),
      )
      .fallback({}),
  ).map(([opt, other]) => new ReadCommand({ opt, ...other }));

  private readonly arguments: IReadCommandArguments;
  constructor(args: IReadCommandArguments) {
    super();
    this.arguments = args;
  }

  public override neovimCapable(): boolean {
    return true;
  }

  async execute(vimState: VimState): Promise<void> {
    const textToInsert = await this.getTextToInsert(vimState);
    if (textToInsert) {
      vimState.recordedState.transformer.insert(
        vimState.cursorStopPosition.getLineEnd(),
        '\n' + textToInsert,
      );
    }
  }

  // TODO: executeWithRange()

  async getTextToInsert(vimState: VimState): Promise<string> {
    if ('file' in this.arguments) {
      return readFileAsync(this.arguments.file, 'utf8');
    } else if ('cmd' in this.arguments) {
      if (this.arguments.cmd.length > 0) {
        if (SUPPORT_READ_COMMAND) {
          const folder =
            vscode.workspace.getWorkspaceFolder(vimState.document.uri) ??
            vscode.workspace.workspaceFolders?.[0];
          return externalCommand.run(this.arguments.cmd, '', folder?.uri.fsPath);
        } else {
          return '';
        }
      } else {
        // TODO: error message?
        return '';
      }
    } else {
      return vimState.document.getText();
    }
  }
}
