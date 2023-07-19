import { ExtensionContext, commands, window } from "vscode";

export function activate(context: ExtensionContext) {
  const { subscriptions } = context;

  console.log('init');

  subscriptions.push(
    commands.registerCommand("class-fold.printSymbols", printSymbols),
    );
}

function printSymbols() {
  return commands
    .executeCommand(
      "vscode.executeDocumentSymbolProvider",
      window.activeTextEditor?.document.uri
    )
    .then((symbols) => {
      console.log(symbols);
    });
}
