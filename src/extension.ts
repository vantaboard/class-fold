// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

class ClassNameFoldingRangeProvider implements vscode.FoldingRangeProvider {
	provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
		/**
		 * Given a document with HTML or JSX, provider a folding range around the className attribute
		 * 
		 * Example:
		 * <div className="foo bar baz">
		 * 
		 * Will return a folding range that starts at the first character of the line with the className attribute
		 * and ends at the last character of the line with the className attribute
		 */

		const foldingRanges: vscode.FoldingRange[] = [];
		const regex = /className=".*"/g;
		const text = document.getText();
		let match;

		// eslint-disable-next-line no-cond-assign
		while (match = regex.exec(text)) {
			const start = document.positionAt(match.index);
			const end = document.positionAt(match.index + match[0].length);
			const foldingRange = new vscode.FoldingRange(start.line, end.line);
			foldingRanges.push(foldingRange);
		}
		return foldingRanges;
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "helloworld-sample" is now active!');

	const disposable = vscode.languages.registerFoldingRangeProvider({ language: 'typescriptreact' }, {
		onDidChangeFoldingRanges: new vscode.EventEmitter<void>().event,
		provideFoldingRanges(document) {
			/**
			 * Given a document with HTML or JSX, provider a folding range around the className attribute
			 * 
			 * Example:
			 * <div className="foo bar baz">
			 * 
			 * Will return a folding range that starts at the first character of the line with the className attribute
			 * and ends at the last character of the line with the className attribute
			 */
	
			const foldingRanges: vscode.FoldingRange[] = [];
			const regex = /className=\{["'`].+["'`]\}/gm;
			const text = document.getText();

			text.match(regex)?.forEach((match) => {
				console.log({ match });
				const start = document.positionAt(match.index);
				const end = document.positionAt(match.index + match[0].length);
				const kind = vscode.FoldingRangeKind.Region;
				const foldingRange = new vscode.FoldingRange(start.line, end.line, kind);

				if (foldingRange.start !== foldingRange.end) {
					foldingRanges.push(foldingRange);
				}
			}

			foldingRanges.forEach((foldingRange) => {
				console.log(foldingRange);
				vscode.commands.executeCommand('editor.fold', {
					selectionLines: [foldingRange.start, foldingRange.end],
					levels: 0
				});
			});

			return foldingRanges;
		}
	});

	context.subscriptions.push(disposable);


	const providers = ['html', 'javascriptreact', 'typescriptreact'].map(
		language => vscode.languages.registerFoldingRangeProvider({
			scheme: 'file',
			language
		}, new ClassNameFoldingRangeProvider)
	);
}