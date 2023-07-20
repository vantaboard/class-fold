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
    workspace,
} from 'vscode';
import * as fs from 'fs';

const baseRegex =
    // eslint-disable-next-line no-useless-escape
    /(ATTR)=(([`'"]).+?(?=([`'"])[\s\\>])([`'"]))|(ATTR)=(([\\[\\{]).+?(?=[\]\\}]\s?\/\>)([\]\\}]))/;

let isUnfolding = false;
let isEditing = false;

const regexen = {
    class: new RegExp(
        baseRegex.source.replace(/ATTR/g, 'class|className'),
        'gs',
    ),
    style: new RegExp(baseRegex.source.replace(/ATTR/g, 'style'), 'gs'),
};

const validLangs = ['html', 'javascriptreact', 'typescriptreact'];

const decoratorTypes = ['none', 'folded', 'foldedEnd', 'hidden'] as const;
type DecoratorType = (typeof decoratorTypes)[number];

function getDecoratedRanges(): Record<DecoratorType, Set<Range>> {
    return {
        none: new Set(),
        folded: new Set(),
        foldedEnd: new Set(),
        hidden: new Set(),
    };
}

const groupedDecoratedRanges = {
    class: getDecoratedRanges(),
    style: getDecoratedRanges(),
};

function getIcon(uri: string) {
    return {
        contentIconPath: Uri.parse(`data:image/svg+xml;base64,${uri}`),
        width: '1em',
    };
}

const icons = {
    class: getIcon(fs.readFileSync(`${__dirname}/tailwindcss.svg`, 'base64')),
    style: getIcon(fs.readFileSync(`${__dirname}/css.svg`, 'base64')),
};

function getDecorators(
    icon: ThemableDecorationAttachmentRenderOptions,
): Record<DecoratorType, TextEditorDecorationType> {
    return {
        none: window.createTextEditorDecorationType({}),
        folded: window.createTextEditorDecorationType({
            before: icon,
            textDecoration: 'none; display: none;',
        }),
        foldedEnd: window.createTextEditorDecorationType({
            before: icon,
            after: {
                margin: '0 0 0 0.6em',
                contentText: '/>',
            },
            textDecoration: 'none; display: none;',
        }),
        hidden: window.createTextEditorDecorationType({
            textDecoration: 'none; display: none;',
            before: icon,
        }),
    };
}

const groupedDecorators = {
    class: getDecorators(icons.class),
    style: getDecorators(icons.style),
};

export function activate(context: ExtensionContext) {
    const { subscriptions } = context;

    const disposables = (['class', 'style'] as const).flatMap((type) => [
        languages.registerFoldingRangeProvider(
            validLangs,
            new ClassFoldingRangeProvider(type),
        ),
        workspace.onDidChangeTextDocument((event) => {
            if (!validLangs.includes(event.document.languageId)) {
                return;
            }

            isEditing = true;
            setTimeout(() => {
                isEditing = false;
            }, 10);
        }),
        window.onDidChangeActiveTextEditor(async (editor) => {
            if (!editor) {
                return;
            }

            if (!validLangs.includes(editor.document.languageId)) {
                return;
            }

            isUnfolding = true;
            await commands.executeCommand('editor.unfoldAll');
            isUnfolding = false;
        }),
        window.onDidChangeTextEditorSelection(selectionHandler(type)),
    ]);

    subscriptions.push(...disposables);
}

class ClassFoldingRangeProvider implements FoldingRangeProvider {
    private regex: RegExp;

    constructor(type: 'class' | 'style') {
        this.regex = regexen[type];
    }

    provideFoldingRanges(
        document: TextDocument,
    ): ProviderResult<FoldingRange[]> {
        const ranges: FoldingRange[] = [];

        const text = document.getText();
        let match: RegExpExecArray | null;

        while ((match = this.regex.exec(text))) {
            const start = document.positionAt(match.index);
            const end = document.positionAt(match.index + match[0].length);

            ranges.push(new FoldingRange(start.line, end.line));
        }

        return ranges;
    }
}

function selectionHandler(type: 'class' | 'style') {
    return async function (event: TextEditorSelectionChangeEvent) {
        if (isEditing) {
            return;
        }

        await new Promise<void>((resolve) => {
            const interval = setInterval(() => {
                if (!isUnfolding) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });

        const { selections } = event;
        const editor = event.textEditor;
        const regex = regexen[type];
        const decoratedRanges = groupedDecoratedRanges[type];
        const decorators = groupedDecorators[type];

        if (!validLangs.includes(editor.document.languageId)) {
            return;
        }

        const text = editor.document.getText();
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text))) {
            const start = editor.document.positionAt(match.index);
            const end = editor.document.positionAt(
                match.index + match[0].length,
            );
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
                        ? (`folded${
                              editor.document.lineAt(end.line).text.match(/\/>/)
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
    };
}
