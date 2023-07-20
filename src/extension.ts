import {
    ExtensionContext,
    FoldingRange,
    FoldingRangeProvider,
    ProviderResult,
    Range,
    TextDocument,
    TextEditorDecorationType,
    TextEditorSelectionChangeEvent,
    ThemableDecorationAttachmentRenderOptions,
    Uri,
    commands,
    languages,
    window,
} from 'vscode';

const classNameRegex =
    /(class|className)=(([`'"]).+?(?=([`'"])[\s\\>])([`'"]))|(class|className)=(([\\[\\{]).+?(?=[\]\\}][\s\\>])([\]\\}]))/gs;
const validLangs = ['html', 'javascriptreact', 'typescriptreact'];
const editors = new Set<Uri>();

const decoratorTypes = ['none', 'folded', 'foldedEnd', 'hidden'] as const;
type DecoratorType = (typeof decoratorTypes)[number];

const decoratedRanges: Record<DecoratorType, Set<Range>> = {
    none: new Set(),
    folded: new Set(),
    foldedEnd: new Set(),
    hidden: new Set(),
};

const tailwindIcon: ThemableDecorationAttachmentRenderOptions = {
    contentIconPath: Uri.parse(
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCA1NCAzMyI+PGcgY2xpcC1wYXRoPSJ1cmwoI3ByZWZpeF9fY2xpcDApIj48cGF0aCBmaWxsPSIjMzhiZGY4IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yNyAwYy03LjIgMC0xMS43IDMuNi0xMy41IDEwLjggMi43LTMuNiA1Ljg1LTQuOTUgOS40NS00LjA1IDIuMDU0LjUxMyAzLjUyMiAyLjAwNCA1LjE0NyAzLjY1M0MzMC43NDQgMTMuMDkgMzMuODA4IDE2LjIgNDAuNSAxNi4yYzcuMiAwIDExLjctMy42IDEzLjUtMTAuOC0yLjcgMy42LTUuODUgNC45NS05LjQ1IDQuMDUtMi4wNTQtLjUxMy0zLjUyMi0yLjAwNC01LjE0Ny0zLjY1M0MzNi43NTYgMy4xMSAzMy42OTIgMCAyNyAwek0xMy41IDE2LjJDNi4zIDE2LjIgMS44IDE5LjggMCAyN2MyLjctMy42IDUuODUtNC45NSA5LjQ1LTQuMDUgMi4wNTQuNTE0IDMuNTIyIDIuMDA0IDUuMTQ3IDMuNjUzQzE3LjI0NCAyOS4yOSAyMC4zMDggMzIuNCAyNyAzMi40YzcuMiAwIDExLjctMy42IDEzLjUtMTAuOC0yLjcgMy42LTUuODUgNC45NS05LjQ1IDQuMDUtMi4wNTQtLjUxMy0zLjUyMi0yLjAwNC01LjE0Ny0zLjY1M0MyMy4yNTYgMTkuMzEgMjAuMTkyIDE2LjIgMTMuNSAxNi4yeiIgY2xpcC1ydWxlPSJldmVub2RkIi8+PC9nPjxkZWZzPjxjbGlwUGF0aCBpZD0icHJlZml4X19jbGlwMCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTAgMGg1NHYzMi40SDB6Ii8+PC9jbGlwUGF0aD48L2RlZnM+PC9zdmc+',
    ),
    width: '1em',
};

const decorators: Record<DecoratorType, TextEditorDecorationType> = {
    none: window.createTextEditorDecorationType({}),
    folded: window.createTextEditorDecorationType({
        before: tailwindIcon,
        textDecoration: 'none; display: none;',
    }),
    foldedEnd: window.createTextEditorDecorationType({
        before: tailwindIcon,
        after: {
            margin: '0 0 0 0.6em',
            contentText: '/>',
        },
        textDecoration: 'none; display: none;',
    }),
    hidden: window.createTextEditorDecorationType({
        textDecoration: 'none; display: none;',
        before: tailwindIcon,
    }),
};

export function activate(context: ExtensionContext) {
    const { subscriptions } = context;

    subscriptions.push(
        languages.registerFoldingRangeProvider(
            validLangs,
            new ClassFoldingRangeProvider(),
        ),
        window.onDidChangeTextEditorSelection(foldHandler),
    );
}

class ClassFoldingRangeProvider implements FoldingRangeProvider {
    provideFoldingRanges(
        document: TextDocument,
    ): ProviderResult<FoldingRange[]> {
        const ranges: FoldingRange[] = [];

        const text = document.getText();
        let match: RegExpExecArray | null;

        while ((match = classNameRegex.exec(text))) {
            const start = document.positionAt(match.index);
            const end = document.positionAt(match.index + match[0].length);

            ranges.push(new FoldingRange(start.line, end.line));
        }

        return ranges;
    }
}

async function foldHandler(event: TextEditorSelectionChangeEvent) {
    const { selections } = event;
    const editor = event.textEditor;

    if (!editors.has(editor.document.uri)) {
        await commands.executeCommand('editor.unfoldAll');
    }

    if (!validLangs.includes(editor.document.languageId)) {
        return;
    }

    editors.add(editor.document.uri);
    const text = editor.document.getText();
    let match: RegExpExecArray | null;

    while ((match = classNameRegex.exec(text))) {
        const start = editor.document.positionAt(match.index);
        const end = editor.document.positionAt(match.index + match[0].length);
        const foldable = start.line !== end.line;

        const selection = selections.find(
            (selection) =>
                selection.start.line >= start.line &&
                selection.start.line <= end.line,
        );

        const range = new Range(start, end);

        if (!selection) {
            decoratedRanges[
                foldable
                    ? (`folded${editor.document.lineAt(end.line).text.match(/\/>/)
                            ? 'End'
                            : ''
                        }` as DecoratorType)
                    : 'hidden'
            ].add(range);

            if (foldable) {
                await commands.executeCommand('editor.fold', {
                    levels: 1,
                    direction: 'up',
                    selectionLines: [start.line, end.line],
                });
            }

            continue;
        }

        decoratedRanges.none.add(range);

        if (foldable) {
            await commands.executeCommand('editor.unfold', {
                levels: 1,
                direction: 'up',
                selectionLines: [start.line, end.line],
            });
        }
    }

    Object.entries(decoratedRanges).forEach(([type, ranges]) => {
        const decorationType = decorators[type as DecoratorType];

        editor.setDecorations(decorationType, Array.from(ranges));
        ranges.clear();
    });
}
