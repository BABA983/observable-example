"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.format = format;
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
var LanguageServiceHost = /** @class */ (function () {
    function LanguageServiceHost() {
        var _this = this;
        this.files = {};
        // for ts.LanguageServiceHost
        this.getCompilationSettings = function () { return ts.getDefaultCompilerOptions(); };
        this.getScriptFileNames = function () { return Object.keys(_this.files); };
        this.getScriptVersion = function (_fileName) { return '0'; };
        this.getScriptSnapshot = function (fileName) { return _this.files[fileName]; };
        this.getCurrentDirectory = function () { return process.cwd(); };
        this.getDefaultLibFileName = function (options) { return ts.getDefaultLibFilePath(options); };
    }
    LanguageServiceHost.prototype.addFile = function (fileName, text) {
        this.files[fileName] = ts.ScriptSnapshot.fromString(text);
    };
    LanguageServiceHost.prototype.fileExists = function (path) {
        return !!this.files[path];
    };
    LanguageServiceHost.prototype.readFile = function (path) {
        var _a;
        return (_a = this.files[path]) === null || _a === void 0 ? void 0 : _a.getText(0, this.files[path].getLength());
    };
    return LanguageServiceHost;
}());
var defaults = {
    baseIndentSize: 0,
    indentSize: 4,
    tabSize: 4,
    indentStyle: ts.IndentStyle.Smart,
    newLineCharacter: '\r\n',
    convertTabsToSpaces: false,
    insertSpaceAfterCommaDelimiter: true,
    insertSpaceAfterSemicolonInForStatements: true,
    insertSpaceBeforeAndAfterBinaryOperators: true,
    insertSpaceAfterConstructor: false,
    insertSpaceAfterKeywordsInControlFlowStatements: true,
    insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
    insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
    insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
    insertSpaceAfterTypeAssertion: false,
    insertSpaceBeforeFunctionParenthesis: false,
    placeOpenBraceOnNewLineForFunctions: false,
    placeOpenBraceOnNewLineForControlBlocks: false,
    insertSpaceBeforeTypeAnnotation: false,
};
var getOverrides = (function () {
    var value;
    return function () {
        value !== null && value !== void 0 ? value : (value = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'tsfmt.json'), 'utf8')));
        return value;
    };
})();
function format(fileName, text) {
    var host = new LanguageServiceHost();
    host.addFile(fileName, text);
    var languageService = ts.createLanguageService(host);
    var edits = languageService.getFormattingEditsForDocument(fileName, __assign(__assign({}, defaults), getOverrides()));
    edits
        .sort(function (a, b) { return a.span.start - b.span.start; })
        .reverse()
        .forEach(function (edit) {
        var head = text.slice(0, edit.span.start);
        var tail = text.slice(edit.span.start + edit.span.length);
        text = "".concat(head).concat(edit.newText).concat(tail);
    });
    return text;
}
