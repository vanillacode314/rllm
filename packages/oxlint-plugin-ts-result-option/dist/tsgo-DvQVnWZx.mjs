import { MUST_USE_SYMBOL_NAMES, isInPackageFile } from "./must-use-name.mjs";
import module from "node:module";
import fs, { closeSync, existsSync, openSync, readSync, writeSync } from "node:fs";
import path, { dirname, join } from "node:path";
import { Buffer as Buffer$1 } from "node:buffer";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
//#region ../../node_modules/typescript/dist/enums/characterCodes.js
var CharacterCodes;
(function(CharacterCodes) {
	CharacterCodes[CharacterCodes["EOF"] = -1] = "EOF";
	CharacterCodes[CharacterCodes["nullCharacter"] = 0] = "nullCharacter";
	CharacterCodes[CharacterCodes["maxAsciiCharacter"] = 127] = "maxAsciiCharacter";
	CharacterCodes[CharacterCodes["lineFeed"] = 10] = "lineFeed";
	CharacterCodes[CharacterCodes["carriageReturn"] = 13] = "carriageReturn";
	CharacterCodes[CharacterCodes["lineSeparator"] = 8232] = "lineSeparator";
	CharacterCodes[CharacterCodes["paragraphSeparator"] = 8233] = "paragraphSeparator";
	CharacterCodes[CharacterCodes["nextLine"] = 133] = "nextLine";
	CharacterCodes[CharacterCodes["space"] = 32] = "space";
	CharacterCodes[CharacterCodes["nonBreakingSpace"] = 160] = "nonBreakingSpace";
	CharacterCodes[CharacterCodes["enQuad"] = 8192] = "enQuad";
	CharacterCodes[CharacterCodes["emQuad"] = 8193] = "emQuad";
	CharacterCodes[CharacterCodes["enSpace"] = 8194] = "enSpace";
	CharacterCodes[CharacterCodes["emSpace"] = 8195] = "emSpace";
	CharacterCodes[CharacterCodes["threePerEmSpace"] = 8196] = "threePerEmSpace";
	CharacterCodes[CharacterCodes["fourPerEmSpace"] = 8197] = "fourPerEmSpace";
	CharacterCodes[CharacterCodes["sixPerEmSpace"] = 8198] = "sixPerEmSpace";
	CharacterCodes[CharacterCodes["figureSpace"] = 8199] = "figureSpace";
	CharacterCodes[CharacterCodes["punctuationSpace"] = 8200] = "punctuationSpace";
	CharacterCodes[CharacterCodes["thinSpace"] = 8201] = "thinSpace";
	CharacterCodes[CharacterCodes["hairSpace"] = 8202] = "hairSpace";
	CharacterCodes[CharacterCodes["zeroWidthSpace"] = 8203] = "zeroWidthSpace";
	CharacterCodes[CharacterCodes["narrowNoBreakSpace"] = 8239] = "narrowNoBreakSpace";
	CharacterCodes[CharacterCodes["ideographicSpace"] = 12288] = "ideographicSpace";
	CharacterCodes[CharacterCodes["mathematicalSpace"] = 8287] = "mathematicalSpace";
	CharacterCodes[CharacterCodes["ogham"] = 5765] = "ogham";
	CharacterCodes[CharacterCodes["replacementCharacter"] = 65533] = "replacementCharacter";
	CharacterCodes[CharacterCodes["_"] = 95] = "_";
	CharacterCodes[CharacterCodes["$"] = 36] = "$";
	CharacterCodes[CharacterCodes["_0"] = 48] = "_0";
	CharacterCodes[CharacterCodes["_1"] = 49] = "_1";
	CharacterCodes[CharacterCodes["_2"] = 50] = "_2";
	CharacterCodes[CharacterCodes["_3"] = 51] = "_3";
	CharacterCodes[CharacterCodes["_4"] = 52] = "_4";
	CharacterCodes[CharacterCodes["_5"] = 53] = "_5";
	CharacterCodes[CharacterCodes["_6"] = 54] = "_6";
	CharacterCodes[CharacterCodes["_7"] = 55] = "_7";
	CharacterCodes[CharacterCodes["_8"] = 56] = "_8";
	CharacterCodes[CharacterCodes["_9"] = 57] = "_9";
	CharacterCodes[CharacterCodes["a"] = 97] = "a";
	CharacterCodes[CharacterCodes["b"] = 98] = "b";
	CharacterCodes[CharacterCodes["c"] = 99] = "c";
	CharacterCodes[CharacterCodes["d"] = 100] = "d";
	CharacterCodes[CharacterCodes["e"] = 101] = "e";
	CharacterCodes[CharacterCodes["f"] = 102] = "f";
	CharacterCodes[CharacterCodes["g"] = 103] = "g";
	CharacterCodes[CharacterCodes["h"] = 104] = "h";
	CharacterCodes[CharacterCodes["i"] = 105] = "i";
	CharacterCodes[CharacterCodes["j"] = 106] = "j";
	CharacterCodes[CharacterCodes["k"] = 107] = "k";
	CharacterCodes[CharacterCodes["l"] = 108] = "l";
	CharacterCodes[CharacterCodes["m"] = 109] = "m";
	CharacterCodes[CharacterCodes["n"] = 110] = "n";
	CharacterCodes[CharacterCodes["o"] = 111] = "o";
	CharacterCodes[CharacterCodes["p"] = 112] = "p";
	CharacterCodes[CharacterCodes["q"] = 113] = "q";
	CharacterCodes[CharacterCodes["r"] = 114] = "r";
	CharacterCodes[CharacterCodes["s"] = 115] = "s";
	CharacterCodes[CharacterCodes["t"] = 116] = "t";
	CharacterCodes[CharacterCodes["u"] = 117] = "u";
	CharacterCodes[CharacterCodes["v"] = 118] = "v";
	CharacterCodes[CharacterCodes["w"] = 119] = "w";
	CharacterCodes[CharacterCodes["x"] = 120] = "x";
	CharacterCodes[CharacterCodes["y"] = 121] = "y";
	CharacterCodes[CharacterCodes["z"] = 122] = "z";
	CharacterCodes[CharacterCodes["A"] = 65] = "A";
	CharacterCodes[CharacterCodes["B"] = 66] = "B";
	CharacterCodes[CharacterCodes["C"] = 67] = "C";
	CharacterCodes[CharacterCodes["D"] = 68] = "D";
	CharacterCodes[CharacterCodes["E"] = 69] = "E";
	CharacterCodes[CharacterCodes["F"] = 70] = "F";
	CharacterCodes[CharacterCodes["G"] = 71] = "G";
	CharacterCodes[CharacterCodes["H"] = 72] = "H";
	CharacterCodes[CharacterCodes["I"] = 73] = "I";
	CharacterCodes[CharacterCodes["J"] = 74] = "J";
	CharacterCodes[CharacterCodes["K"] = 75] = "K";
	CharacterCodes[CharacterCodes["L"] = 76] = "L";
	CharacterCodes[CharacterCodes["M"] = 77] = "M";
	CharacterCodes[CharacterCodes["N"] = 78] = "N";
	CharacterCodes[CharacterCodes["O"] = 79] = "O";
	CharacterCodes[CharacterCodes["P"] = 80] = "P";
	CharacterCodes[CharacterCodes["Q"] = 81] = "Q";
	CharacterCodes[CharacterCodes["R"] = 82] = "R";
	CharacterCodes[CharacterCodes["S"] = 83] = "S";
	CharacterCodes[CharacterCodes["T"] = 84] = "T";
	CharacterCodes[CharacterCodes["U"] = 85] = "U";
	CharacterCodes[CharacterCodes["V"] = 86] = "V";
	CharacterCodes[CharacterCodes["W"] = 87] = "W";
	CharacterCodes[CharacterCodes["X"] = 88] = "X";
	CharacterCodes[CharacterCodes["Y"] = 89] = "Y";
	CharacterCodes[CharacterCodes["Z"] = 90] = "Z";
	CharacterCodes[CharacterCodes["ampersand"] = 38] = "ampersand";
	CharacterCodes[CharacterCodes["asterisk"] = 42] = "asterisk";
	CharacterCodes[CharacterCodes["at"] = 64] = "at";
	CharacterCodes[CharacterCodes["backslash"] = 92] = "backslash";
	CharacterCodes[CharacterCodes["backtick"] = 96] = "backtick";
	CharacterCodes[CharacterCodes["bar"] = 124] = "bar";
	CharacterCodes[CharacterCodes["caret"] = 94] = "caret";
	CharacterCodes[CharacterCodes["closeBrace"] = 125] = "closeBrace";
	CharacterCodes[CharacterCodes["closeBracket"] = 93] = "closeBracket";
	CharacterCodes[CharacterCodes["closeParen"] = 41] = "closeParen";
	CharacterCodes[CharacterCodes["colon"] = 58] = "colon";
	CharacterCodes[CharacterCodes["comma"] = 44] = "comma";
	CharacterCodes[CharacterCodes["dot"] = 46] = "dot";
	CharacterCodes[CharacterCodes["doubleQuote"] = 34] = "doubleQuote";
	CharacterCodes[CharacterCodes["equals"] = 61] = "equals";
	CharacterCodes[CharacterCodes["exclamation"] = 33] = "exclamation";
	CharacterCodes[CharacterCodes["greaterThan"] = 62] = "greaterThan";
	CharacterCodes[CharacterCodes["hash"] = 35] = "hash";
	CharacterCodes[CharacterCodes["lessThan"] = 60] = "lessThan";
	CharacterCodes[CharacterCodes["minus"] = 45] = "minus";
	CharacterCodes[CharacterCodes["openBrace"] = 123] = "openBrace";
	CharacterCodes[CharacterCodes["openBracket"] = 91] = "openBracket";
	CharacterCodes[CharacterCodes["openParen"] = 40] = "openParen";
	CharacterCodes[CharacterCodes["percent"] = 37] = "percent";
	CharacterCodes[CharacterCodes["plus"] = 43] = "plus";
	CharacterCodes[CharacterCodes["question"] = 63] = "question";
	CharacterCodes[CharacterCodes["semicolon"] = 59] = "semicolon";
	CharacterCodes[CharacterCodes["singleQuote"] = 39] = "singleQuote";
	CharacterCodes[CharacterCodes["slash"] = 47] = "slash";
	CharacterCodes[CharacterCodes["tilde"] = 126] = "tilde";
	CharacterCodes[CharacterCodes["backspace"] = 8] = "backspace";
	CharacterCodes[CharacterCodes["formFeed"] = 12] = "formFeed";
	CharacterCodes[CharacterCodes["byteOrderMark"] = 65279] = "byteOrderMark";
	CharacterCodes[CharacterCodes["tab"] = 9] = "tab";
	CharacterCodes[CharacterCodes["verticalTab"] = 11] = "verticalTab";
})(CharacterCodes || (CharacterCodes = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/commentDirectiveType.js
var CommentDirectiveType;
(function(CommentDirectiveType) {
	CommentDirectiveType[CommentDirectiveType["ExpectError"] = 0] = "ExpectError";
	CommentDirectiveType[CommentDirectiveType["Ignore"] = 1] = "Ignore";
})(CommentDirectiveType || (CommentDirectiveType = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/internalSymbolName.js
var InternalSymbolName;
(function(InternalSymbolName) {
	InternalSymbolName["Call"] = "__call";
	InternalSymbolName["Constructor"] = "__constructor";
	InternalSymbolName["New"] = "__new";
	InternalSymbolName["Index"] = "__index";
	InternalSymbolName["ExportStar"] = "__export";
	InternalSymbolName["Global"] = "__global";
	InternalSymbolName["Missing"] = "__missing";
	InternalSymbolName["Type"] = "__type";
	InternalSymbolName["Object"] = "__object";
	InternalSymbolName["JSXAttributes"] = "__jsxAttributes";
	InternalSymbolName["Class"] = "__class";
	InternalSymbolName["Function"] = "__function";
	InternalSymbolName["Computed"] = "__computed";
	InternalSymbolName["AssignmentDeclaration"] = "__assignment";
	InternalSymbolName["InstantiationExpression"] = "__instantiationExpression";
	InternalSymbolName["ImportAttributes"] = "__importAttributes";
	InternalSymbolName["ExportEquals"] = "export=";
	InternalSymbolName["Default"] = "default";
	InternalSymbolName["This"] = "this";
	InternalSymbolName["ModuleExports"] = "module.exports";
})(InternalSymbolName || (InternalSymbolName = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/languageVariant.js
var LanguageVariant;
(function(LanguageVariant) {
	LanguageVariant[LanguageVariant["Standard"] = 0] = "Standard";
	LanguageVariant[LanguageVariant["JSX"] = 1] = "JSX";
})(LanguageVariant || (LanguageVariant = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/modifierFlags.js
var ModifierFlags;
(function(ModifierFlags) {
	ModifierFlags[ModifierFlags["None"] = 0] = "None";
	ModifierFlags[ModifierFlags["Public"] = 1] = "Public";
	ModifierFlags[ModifierFlags["Private"] = 2] = "Private";
	ModifierFlags[ModifierFlags["Protected"] = 4] = "Protected";
	ModifierFlags[ModifierFlags["Readonly"] = 8] = "Readonly";
	ModifierFlags[ModifierFlags["Override"] = 16] = "Override";
	ModifierFlags[ModifierFlags["Export"] = 32] = "Export";
	ModifierFlags[ModifierFlags["Abstract"] = 64] = "Abstract";
	ModifierFlags[ModifierFlags["Ambient"] = 128] = "Ambient";
	ModifierFlags[ModifierFlags["Static"] = 256] = "Static";
	ModifierFlags[ModifierFlags["Accessor"] = 512] = "Accessor";
	ModifierFlags[ModifierFlags["Async"] = 1024] = "Async";
	ModifierFlags[ModifierFlags["Default"] = 2048] = "Default";
	ModifierFlags[ModifierFlags["Const"] = 4096] = "Const";
	ModifierFlags[ModifierFlags["In"] = 8192] = "In";
	ModifierFlags[ModifierFlags["Out"] = 16384] = "Out";
	ModifierFlags[ModifierFlags["Decorator"] = 32768] = "Decorator";
	ModifierFlags[ModifierFlags["Deprecated"] = 65536] = "Deprecated";
	ModifierFlags[ModifierFlags["JSDocPublic"] = 8388608] = "JSDocPublic";
	ModifierFlags[ModifierFlags["JSDocPrivate"] = 16777216] = "JSDocPrivate";
	ModifierFlags[ModifierFlags["JSDocProtected"] = 33554432] = "JSDocProtected";
	ModifierFlags[ModifierFlags["JSDocReadonly"] = 67108864] = "JSDocReadonly";
	ModifierFlags[ModifierFlags["JSDocOverride"] = 134217728] = "JSDocOverride";
	ModifierFlags[ModifierFlags["HasComputedJSDocModifiers"] = 268435456] = "HasComputedJSDocModifiers";
	ModifierFlags[ModifierFlags["HasComputedFlags"] = 536870912] = "HasComputedFlags";
	ModifierFlags[ModifierFlags["SyntacticOrJSDocModifiers"] = 31] = "SyntacticOrJSDocModifiers";
	ModifierFlags[ModifierFlags["SyntacticOnlyModifiers"] = 65504] = "SyntacticOnlyModifiers";
	ModifierFlags[ModifierFlags["SyntacticModifiers"] = 65535] = "SyntacticModifiers";
	ModifierFlags[ModifierFlags["JSDocCacheOnlyModifiers"] = 260046848] = "JSDocCacheOnlyModifiers";
	ModifierFlags[ModifierFlags["JSDocOnlyModifiers"] = 65536] = "JSDocOnlyModifiers";
	ModifierFlags[ModifierFlags["NonCacheOnlyModifiers"] = 131071] = "NonCacheOnlyModifiers";
	ModifierFlags[ModifierFlags["AccessibilityModifier"] = 7] = "AccessibilityModifier";
	ModifierFlags[ModifierFlags["ParameterPropertyModifier"] = 31] = "ParameterPropertyModifier";
	ModifierFlags[ModifierFlags["NonPublicAccessibilityModifier"] = 6] = "NonPublicAccessibilityModifier";
	ModifierFlags[ModifierFlags["TypeScriptModifier"] = 28895] = "TypeScriptModifier";
	ModifierFlags[ModifierFlags["ExportDefault"] = 2080] = "ExportDefault";
	ModifierFlags[ModifierFlags["All"] = 131071] = "All";
	ModifierFlags[ModifierFlags["Modifier"] = 98303] = "Modifier";
	ModifierFlags[ModifierFlags["JavaScript"] = 3872] = "JavaScript";
})(ModifierFlags || (ModifierFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/nodeFlags.js
var NodeFlags;
(function(NodeFlags) {
	NodeFlags[NodeFlags["None"] = 0] = "None";
	NodeFlags[NodeFlags["Let"] = 1] = "Let";
	NodeFlags[NodeFlags["Const"] = 2] = "Const";
	NodeFlags[NodeFlags["Using"] = 4] = "Using";
	NodeFlags[NodeFlags["Reparsed"] = 8] = "Reparsed";
	NodeFlags[NodeFlags["Synthesized"] = 16] = "Synthesized";
	NodeFlags[NodeFlags["OptionalChain"] = 32] = "OptionalChain";
	NodeFlags[NodeFlags["ExportContext"] = 64] = "ExportContext";
	NodeFlags[NodeFlags["ContainsThis"] = 128] = "ContainsThis";
	NodeFlags[NodeFlags["HasImplicitReturn"] = 256] = "HasImplicitReturn";
	NodeFlags[NodeFlags["HasExplicitReturn"] = 512] = "HasExplicitReturn";
	NodeFlags[NodeFlags["DisallowInContext"] = 1024] = "DisallowInContext";
	NodeFlags[NodeFlags["YieldContext"] = 2048] = "YieldContext";
	NodeFlags[NodeFlags["DecoratorContext"] = 4096] = "DecoratorContext";
	NodeFlags[NodeFlags["AwaitContext"] = 8192] = "AwaitContext";
	NodeFlags[NodeFlags["DisallowConditionalTypesContext"] = 16384] = "DisallowConditionalTypesContext";
	NodeFlags[NodeFlags["ThisNodeHasError"] = 32768] = "ThisNodeHasError";
	NodeFlags[NodeFlags["JavaScriptFile"] = 65536] = "JavaScriptFile";
	NodeFlags[NodeFlags["ThisNodeOrAnySubNodesHasError"] = 131072] = "ThisNodeOrAnySubNodesHasError";
	NodeFlags[NodeFlags["HasAsyncFunctions"] = 262144] = "HasAsyncFunctions";
	NodeFlags[NodeFlags["PossiblyContainsDynamicImport"] = 524288] = "PossiblyContainsDynamicImport";
	NodeFlags[NodeFlags["PossiblyContainsImportMeta"] = 1048576] = "PossiblyContainsImportMeta";
	NodeFlags[NodeFlags["HasJSDoc"] = 2097152] = "HasJSDoc";
	NodeFlags[NodeFlags["JSDoc"] = 4194304] = "JSDoc";
	NodeFlags[NodeFlags["Ambient"] = 8388608] = "Ambient";
	NodeFlags[NodeFlags["InWithStatement"] = 16777216] = "InWithStatement";
	NodeFlags[NodeFlags["JsonFile"] = 33554432] = "JsonFile";
	NodeFlags[NodeFlags["PossiblyContainsDeprecatedTag"] = 67108864] = "PossiblyContainsDeprecatedTag";
	NodeFlags[NodeFlags["Unreachable"] = 134217728] = "Unreachable";
	NodeFlags[NodeFlags["ReparserTransformedLiteral"] = 268435456] = "ReparserTransformedLiteral";
	NodeFlags[NodeFlags["BlockScoped"] = 7] = "BlockScoped";
	NodeFlags[NodeFlags["Constant"] = 6] = "Constant";
	NodeFlags[NodeFlags["AwaitUsing"] = 6] = "AwaitUsing";
	NodeFlags[NodeFlags["ReachabilityCheckFlags"] = 768] = "ReachabilityCheckFlags";
	NodeFlags[NodeFlags["ReachabilityAndEmitFlags"] = 262912] = "ReachabilityAndEmitFlags";
	NodeFlags[NodeFlags["ContextFlags"] = 25263104] = "ContextFlags";
	NodeFlags[NodeFlags["TypeExcludesFlags"] = 10240] = "TypeExcludesFlags";
	NodeFlags[NodeFlags["PermanentlySetIncrementalFlags"] = 1572864] = "PermanentlySetIncrementalFlags";
	NodeFlags[NodeFlags["IdentifierHasExtendedUnicodeEscape"] = 128] = "IdentifierHasExtendedUnicodeEscape";
	NodeFlags[NodeFlags["IdentifierIsInJSDocNamespace"] = 262144] = "IdentifierIsInJSDocNamespace";
	NodeFlags[NodeFlags["NestedNamespace"] = 32] = "NestedNamespace";
})(NodeFlags || (NodeFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/regularExpressionFlags.js
var RegularExpressionFlags;
(function(RegularExpressionFlags) {
	RegularExpressionFlags[RegularExpressionFlags["None"] = 0] = "None";
	RegularExpressionFlags[RegularExpressionFlags["HasIndices"] = 1] = "HasIndices";
	RegularExpressionFlags[RegularExpressionFlags["Global"] = 2] = "Global";
	RegularExpressionFlags[RegularExpressionFlags["IgnoreCase"] = 4] = "IgnoreCase";
	RegularExpressionFlags[RegularExpressionFlags["Multiline"] = 8] = "Multiline";
	RegularExpressionFlags[RegularExpressionFlags["DotAll"] = 16] = "DotAll";
	RegularExpressionFlags[RegularExpressionFlags["Unicode"] = 32] = "Unicode";
	RegularExpressionFlags[RegularExpressionFlags["UnicodeSets"] = 64] = "UnicodeSets";
	RegularExpressionFlags[RegularExpressionFlags["Sticky"] = 128] = "Sticky";
	RegularExpressionFlags[RegularExpressionFlags["AnyUnicodeMode"] = 96] = "AnyUnicodeMode";
})(RegularExpressionFlags || (RegularExpressionFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/scriptKind.js
var ScriptKind;
(function(ScriptKind) {
	ScriptKind[ScriptKind["Unknown"] = 0] = "Unknown";
	ScriptKind[ScriptKind["JS"] = 1] = "JS";
	ScriptKind[ScriptKind["JSX"] = 2] = "JSX";
	ScriptKind[ScriptKind["TS"] = 3] = "TS";
	ScriptKind[ScriptKind["TSX"] = 4] = "TSX";
	ScriptKind[ScriptKind["External"] = 5] = "External";
	ScriptKind[ScriptKind["JSON"] = 6] = "JSON";
	ScriptKind[ScriptKind["Deferred"] = 7] = "Deferred";
})(ScriptKind || (ScriptKind = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/scriptTarget.js
var ScriptTarget;
(function(ScriptTarget) {
	ScriptTarget[ScriptTarget["ES2015"] = 2] = "ES2015";
	ScriptTarget[ScriptTarget["ES2016"] = 3] = "ES2016";
	ScriptTarget[ScriptTarget["ES2017"] = 4] = "ES2017";
	ScriptTarget[ScriptTarget["ES2018"] = 5] = "ES2018";
	ScriptTarget[ScriptTarget["ES2019"] = 6] = "ES2019";
	ScriptTarget[ScriptTarget["ES2020"] = 7] = "ES2020";
	ScriptTarget[ScriptTarget["ES2021"] = 8] = "ES2021";
	ScriptTarget[ScriptTarget["ES2022"] = 9] = "ES2022";
	ScriptTarget[ScriptTarget["ES2023"] = 10] = "ES2023";
	ScriptTarget[ScriptTarget["ES2024"] = 11] = "ES2024";
	ScriptTarget[ScriptTarget["ES2025"] = 12] = "ES2025";
	ScriptTarget[ScriptTarget["ESNext"] = 99] = "ESNext";
	ScriptTarget[ScriptTarget["JSON"] = 100] = "JSON";
	ScriptTarget[ScriptTarget["Latest"] = 99] = "Latest";
})(ScriptTarget || (ScriptTarget = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/syntaxKind.js
var SyntaxKind;
(function(SyntaxKind) {
	SyntaxKind[SyntaxKind["Unknown"] = 0] = "Unknown";
	SyntaxKind[SyntaxKind["EndOfFile"] = 1] = "EndOfFile";
	SyntaxKind[SyntaxKind["SingleLineCommentTrivia"] = 2] = "SingleLineCommentTrivia";
	SyntaxKind[SyntaxKind["MultiLineCommentTrivia"] = 3] = "MultiLineCommentTrivia";
	SyntaxKind[SyntaxKind["NewLineTrivia"] = 4] = "NewLineTrivia";
	SyntaxKind[SyntaxKind["WhitespaceTrivia"] = 5] = "WhitespaceTrivia";
	SyntaxKind[SyntaxKind["ConflictMarkerTrivia"] = 6] = "ConflictMarkerTrivia";
	SyntaxKind[SyntaxKind["NonTextFileMarkerTrivia"] = 7] = "NonTextFileMarkerTrivia";
	SyntaxKind[SyntaxKind["NumericLiteral"] = 8] = "NumericLiteral";
	SyntaxKind[SyntaxKind["BigIntLiteral"] = 9] = "BigIntLiteral";
	SyntaxKind[SyntaxKind["StringLiteral"] = 10] = "StringLiteral";
	SyntaxKind[SyntaxKind["JsxText"] = 11] = "JsxText";
	SyntaxKind[SyntaxKind["JsxTextAllWhiteSpaces"] = 12] = "JsxTextAllWhiteSpaces";
	SyntaxKind[SyntaxKind["RegularExpressionLiteral"] = 13] = "RegularExpressionLiteral";
	SyntaxKind[SyntaxKind["NoSubstitutionTemplateLiteral"] = 14] = "NoSubstitutionTemplateLiteral";
	SyntaxKind[SyntaxKind["TemplateHead"] = 15] = "TemplateHead";
	SyntaxKind[SyntaxKind["TemplateMiddle"] = 16] = "TemplateMiddle";
	SyntaxKind[SyntaxKind["TemplateTail"] = 17] = "TemplateTail";
	SyntaxKind[SyntaxKind["OpenBraceToken"] = 18] = "OpenBraceToken";
	SyntaxKind[SyntaxKind["CloseBraceToken"] = 19] = "CloseBraceToken";
	SyntaxKind[SyntaxKind["OpenParenToken"] = 20] = "OpenParenToken";
	SyntaxKind[SyntaxKind["CloseParenToken"] = 21] = "CloseParenToken";
	SyntaxKind[SyntaxKind["OpenBracketToken"] = 22] = "OpenBracketToken";
	SyntaxKind[SyntaxKind["CloseBracketToken"] = 23] = "CloseBracketToken";
	SyntaxKind[SyntaxKind["DotToken"] = 24] = "DotToken";
	SyntaxKind[SyntaxKind["DotDotDotToken"] = 25] = "DotDotDotToken";
	SyntaxKind[SyntaxKind["SemicolonToken"] = 26] = "SemicolonToken";
	SyntaxKind[SyntaxKind["CommaToken"] = 27] = "CommaToken";
	SyntaxKind[SyntaxKind["QuestionDotToken"] = 28] = "QuestionDotToken";
	SyntaxKind[SyntaxKind["LessThanToken"] = 29] = "LessThanToken";
	SyntaxKind[SyntaxKind["LessThanSlashToken"] = 30] = "LessThanSlashToken";
	SyntaxKind[SyntaxKind["GreaterThanToken"] = 31] = "GreaterThanToken";
	SyntaxKind[SyntaxKind["LessThanEqualsToken"] = 32] = "LessThanEqualsToken";
	SyntaxKind[SyntaxKind["GreaterThanEqualsToken"] = 33] = "GreaterThanEqualsToken";
	SyntaxKind[SyntaxKind["EqualsEqualsToken"] = 34] = "EqualsEqualsToken";
	SyntaxKind[SyntaxKind["ExclamationEqualsToken"] = 35] = "ExclamationEqualsToken";
	SyntaxKind[SyntaxKind["EqualsEqualsEqualsToken"] = 36] = "EqualsEqualsEqualsToken";
	SyntaxKind[SyntaxKind["ExclamationEqualsEqualsToken"] = 37] = "ExclamationEqualsEqualsToken";
	SyntaxKind[SyntaxKind["EqualsGreaterThanToken"] = 38] = "EqualsGreaterThanToken";
	SyntaxKind[SyntaxKind["PlusToken"] = 39] = "PlusToken";
	SyntaxKind[SyntaxKind["MinusToken"] = 40] = "MinusToken";
	SyntaxKind[SyntaxKind["AsteriskToken"] = 41] = "AsteriskToken";
	SyntaxKind[SyntaxKind["AsteriskAsteriskToken"] = 42] = "AsteriskAsteriskToken";
	SyntaxKind[SyntaxKind["SlashToken"] = 43] = "SlashToken";
	SyntaxKind[SyntaxKind["PercentToken"] = 44] = "PercentToken";
	SyntaxKind[SyntaxKind["PlusPlusToken"] = 45] = "PlusPlusToken";
	SyntaxKind[SyntaxKind["MinusMinusToken"] = 46] = "MinusMinusToken";
	SyntaxKind[SyntaxKind["LessThanLessThanToken"] = 47] = "LessThanLessThanToken";
	SyntaxKind[SyntaxKind["GreaterThanGreaterThanToken"] = 48] = "GreaterThanGreaterThanToken";
	SyntaxKind[SyntaxKind["GreaterThanGreaterThanGreaterThanToken"] = 49] = "GreaterThanGreaterThanGreaterThanToken";
	SyntaxKind[SyntaxKind["AmpersandToken"] = 50] = "AmpersandToken";
	SyntaxKind[SyntaxKind["BarToken"] = 51] = "BarToken";
	SyntaxKind[SyntaxKind["CaretToken"] = 52] = "CaretToken";
	SyntaxKind[SyntaxKind["ExclamationToken"] = 53] = "ExclamationToken";
	SyntaxKind[SyntaxKind["TildeToken"] = 54] = "TildeToken";
	SyntaxKind[SyntaxKind["AmpersandAmpersandToken"] = 55] = "AmpersandAmpersandToken";
	SyntaxKind[SyntaxKind["BarBarToken"] = 56] = "BarBarToken";
	SyntaxKind[SyntaxKind["QuestionToken"] = 57] = "QuestionToken";
	SyntaxKind[SyntaxKind["ColonToken"] = 58] = "ColonToken";
	SyntaxKind[SyntaxKind["AtToken"] = 59] = "AtToken";
	SyntaxKind[SyntaxKind["QuestionQuestionToken"] = 60] = "QuestionQuestionToken";
	SyntaxKind[SyntaxKind["BacktickToken"] = 61] = "BacktickToken";
	SyntaxKind[SyntaxKind["HashToken"] = 62] = "HashToken";
	SyntaxKind[SyntaxKind["EqualsToken"] = 63] = "EqualsToken";
	SyntaxKind[SyntaxKind["PlusEqualsToken"] = 64] = "PlusEqualsToken";
	SyntaxKind[SyntaxKind["MinusEqualsToken"] = 65] = "MinusEqualsToken";
	SyntaxKind[SyntaxKind["AsteriskEqualsToken"] = 66] = "AsteriskEqualsToken";
	SyntaxKind[SyntaxKind["AsteriskAsteriskEqualsToken"] = 67] = "AsteriskAsteriskEqualsToken";
	SyntaxKind[SyntaxKind["SlashEqualsToken"] = 68] = "SlashEqualsToken";
	SyntaxKind[SyntaxKind["PercentEqualsToken"] = 69] = "PercentEqualsToken";
	SyntaxKind[SyntaxKind["LessThanLessThanEqualsToken"] = 70] = "LessThanLessThanEqualsToken";
	SyntaxKind[SyntaxKind["GreaterThanGreaterThanEqualsToken"] = 71] = "GreaterThanGreaterThanEqualsToken";
	SyntaxKind[SyntaxKind["GreaterThanGreaterThanGreaterThanEqualsToken"] = 72] = "GreaterThanGreaterThanGreaterThanEqualsToken";
	SyntaxKind[SyntaxKind["AmpersandEqualsToken"] = 73] = "AmpersandEqualsToken";
	SyntaxKind[SyntaxKind["BarEqualsToken"] = 74] = "BarEqualsToken";
	SyntaxKind[SyntaxKind["BarBarEqualsToken"] = 75] = "BarBarEqualsToken";
	SyntaxKind[SyntaxKind["AmpersandAmpersandEqualsToken"] = 76] = "AmpersandAmpersandEqualsToken";
	SyntaxKind[SyntaxKind["QuestionQuestionEqualsToken"] = 77] = "QuestionQuestionEqualsToken";
	SyntaxKind[SyntaxKind["CaretEqualsToken"] = 78] = "CaretEqualsToken";
	SyntaxKind[SyntaxKind["Identifier"] = 79] = "Identifier";
	SyntaxKind[SyntaxKind["PrivateIdentifier"] = 80] = "PrivateIdentifier";
	SyntaxKind[SyntaxKind["JSDocCommentTextToken"] = 81] = "JSDocCommentTextToken";
	SyntaxKind[SyntaxKind["BreakKeyword"] = 82] = "BreakKeyword";
	SyntaxKind[SyntaxKind["CaseKeyword"] = 83] = "CaseKeyword";
	SyntaxKind[SyntaxKind["CatchKeyword"] = 84] = "CatchKeyword";
	SyntaxKind[SyntaxKind["ClassKeyword"] = 85] = "ClassKeyword";
	SyntaxKind[SyntaxKind["ConstKeyword"] = 86] = "ConstKeyword";
	SyntaxKind[SyntaxKind["ContinueKeyword"] = 87] = "ContinueKeyword";
	SyntaxKind[SyntaxKind["DebuggerKeyword"] = 88] = "DebuggerKeyword";
	SyntaxKind[SyntaxKind["DefaultKeyword"] = 89] = "DefaultKeyword";
	SyntaxKind[SyntaxKind["DeleteKeyword"] = 90] = "DeleteKeyword";
	SyntaxKind[SyntaxKind["DoKeyword"] = 91] = "DoKeyword";
	SyntaxKind[SyntaxKind["ElseKeyword"] = 92] = "ElseKeyword";
	SyntaxKind[SyntaxKind["EnumKeyword"] = 93] = "EnumKeyword";
	SyntaxKind[SyntaxKind["ExportKeyword"] = 94] = "ExportKeyword";
	SyntaxKind[SyntaxKind["ExtendsKeyword"] = 95] = "ExtendsKeyword";
	SyntaxKind[SyntaxKind["FalseKeyword"] = 96] = "FalseKeyword";
	SyntaxKind[SyntaxKind["FinallyKeyword"] = 97] = "FinallyKeyword";
	SyntaxKind[SyntaxKind["ForKeyword"] = 98] = "ForKeyword";
	SyntaxKind[SyntaxKind["FunctionKeyword"] = 99] = "FunctionKeyword";
	SyntaxKind[SyntaxKind["IfKeyword"] = 100] = "IfKeyword";
	SyntaxKind[SyntaxKind["ImportKeyword"] = 101] = "ImportKeyword";
	SyntaxKind[SyntaxKind["InKeyword"] = 102] = "InKeyword";
	SyntaxKind[SyntaxKind["InstanceOfKeyword"] = 103] = "InstanceOfKeyword";
	SyntaxKind[SyntaxKind["NewKeyword"] = 104] = "NewKeyword";
	SyntaxKind[SyntaxKind["NullKeyword"] = 105] = "NullKeyword";
	SyntaxKind[SyntaxKind["ReturnKeyword"] = 106] = "ReturnKeyword";
	SyntaxKind[SyntaxKind["SuperKeyword"] = 107] = "SuperKeyword";
	SyntaxKind[SyntaxKind["SwitchKeyword"] = 108] = "SwitchKeyword";
	SyntaxKind[SyntaxKind["ThisKeyword"] = 109] = "ThisKeyword";
	SyntaxKind[SyntaxKind["ThrowKeyword"] = 110] = "ThrowKeyword";
	SyntaxKind[SyntaxKind["TrueKeyword"] = 111] = "TrueKeyword";
	SyntaxKind[SyntaxKind["TryKeyword"] = 112] = "TryKeyword";
	SyntaxKind[SyntaxKind["TypeOfKeyword"] = 113] = "TypeOfKeyword";
	SyntaxKind[SyntaxKind["VarKeyword"] = 114] = "VarKeyword";
	SyntaxKind[SyntaxKind["VoidKeyword"] = 115] = "VoidKeyword";
	SyntaxKind[SyntaxKind["WhileKeyword"] = 116] = "WhileKeyword";
	SyntaxKind[SyntaxKind["WithKeyword"] = 117] = "WithKeyword";
	SyntaxKind[SyntaxKind["ImplementsKeyword"] = 118] = "ImplementsKeyword";
	SyntaxKind[SyntaxKind["InterfaceKeyword"] = 119] = "InterfaceKeyword";
	SyntaxKind[SyntaxKind["LetKeyword"] = 120] = "LetKeyword";
	SyntaxKind[SyntaxKind["PackageKeyword"] = 121] = "PackageKeyword";
	SyntaxKind[SyntaxKind["PrivateKeyword"] = 122] = "PrivateKeyword";
	SyntaxKind[SyntaxKind["ProtectedKeyword"] = 123] = "ProtectedKeyword";
	SyntaxKind[SyntaxKind["PublicKeyword"] = 124] = "PublicKeyword";
	SyntaxKind[SyntaxKind["StaticKeyword"] = 125] = "StaticKeyword";
	SyntaxKind[SyntaxKind["YieldKeyword"] = 126] = "YieldKeyword";
	SyntaxKind[SyntaxKind["AbstractKeyword"] = 127] = "AbstractKeyword";
	SyntaxKind[SyntaxKind["AccessorKeyword"] = 128] = "AccessorKeyword";
	SyntaxKind[SyntaxKind["AsKeyword"] = 129] = "AsKeyword";
	SyntaxKind[SyntaxKind["AssertsKeyword"] = 130] = "AssertsKeyword";
	SyntaxKind[SyntaxKind["AssertKeyword"] = 131] = "AssertKeyword";
	SyntaxKind[SyntaxKind["AnyKeyword"] = 132] = "AnyKeyword";
	SyntaxKind[SyntaxKind["AsyncKeyword"] = 133] = "AsyncKeyword";
	SyntaxKind[SyntaxKind["AwaitKeyword"] = 134] = "AwaitKeyword";
	SyntaxKind[SyntaxKind["BooleanKeyword"] = 135] = "BooleanKeyword";
	SyntaxKind[SyntaxKind["ConstructorKeyword"] = 136] = "ConstructorKeyword";
	SyntaxKind[SyntaxKind["DeclareKeyword"] = 137] = "DeclareKeyword";
	SyntaxKind[SyntaxKind["GetKeyword"] = 138] = "GetKeyword";
	SyntaxKind[SyntaxKind["ImmediateKeyword"] = 139] = "ImmediateKeyword";
	SyntaxKind[SyntaxKind["InferKeyword"] = 140] = "InferKeyword";
	SyntaxKind[SyntaxKind["IntrinsicKeyword"] = 141] = "IntrinsicKeyword";
	SyntaxKind[SyntaxKind["IsKeyword"] = 142] = "IsKeyword";
	SyntaxKind[SyntaxKind["KeyOfKeyword"] = 143] = "KeyOfKeyword";
	SyntaxKind[SyntaxKind["ModuleKeyword"] = 144] = "ModuleKeyword";
	SyntaxKind[SyntaxKind["NamespaceKeyword"] = 145] = "NamespaceKeyword";
	SyntaxKind[SyntaxKind["NeverKeyword"] = 146] = "NeverKeyword";
	SyntaxKind[SyntaxKind["OutKeyword"] = 147] = "OutKeyword";
	SyntaxKind[SyntaxKind["ReadonlyKeyword"] = 148] = "ReadonlyKeyword";
	SyntaxKind[SyntaxKind["RequireKeyword"] = 149] = "RequireKeyword";
	SyntaxKind[SyntaxKind["NumberKeyword"] = 150] = "NumberKeyword";
	SyntaxKind[SyntaxKind["ObjectKeyword"] = 151] = "ObjectKeyword";
	SyntaxKind[SyntaxKind["SatisfiesKeyword"] = 152] = "SatisfiesKeyword";
	SyntaxKind[SyntaxKind["SetKeyword"] = 153] = "SetKeyword";
	SyntaxKind[SyntaxKind["StringKeyword"] = 154] = "StringKeyword";
	SyntaxKind[SyntaxKind["SymbolKeyword"] = 155] = "SymbolKeyword";
	SyntaxKind[SyntaxKind["TypeKeyword"] = 156] = "TypeKeyword";
	SyntaxKind[SyntaxKind["UndefinedKeyword"] = 157] = "UndefinedKeyword";
	SyntaxKind[SyntaxKind["UniqueKeyword"] = 158] = "UniqueKeyword";
	SyntaxKind[SyntaxKind["UnknownKeyword"] = 159] = "UnknownKeyword";
	SyntaxKind[SyntaxKind["UsingKeyword"] = 160] = "UsingKeyword";
	SyntaxKind[SyntaxKind["FromKeyword"] = 161] = "FromKeyword";
	SyntaxKind[SyntaxKind["GlobalKeyword"] = 162] = "GlobalKeyword";
	SyntaxKind[SyntaxKind["BigIntKeyword"] = 163] = "BigIntKeyword";
	SyntaxKind[SyntaxKind["OverrideKeyword"] = 164] = "OverrideKeyword";
	SyntaxKind[SyntaxKind["OfKeyword"] = 165] = "OfKeyword";
	SyntaxKind[SyntaxKind["DeferKeyword"] = 166] = "DeferKeyword";
	SyntaxKind[SyntaxKind["QualifiedName"] = 167] = "QualifiedName";
	SyntaxKind[SyntaxKind["ComputedPropertyName"] = 168] = "ComputedPropertyName";
	SyntaxKind[SyntaxKind["TypeParameter"] = 169] = "TypeParameter";
	SyntaxKind[SyntaxKind["Parameter"] = 170] = "Parameter";
	SyntaxKind[SyntaxKind["Decorator"] = 171] = "Decorator";
	SyntaxKind[SyntaxKind["PropertySignature"] = 172] = "PropertySignature";
	SyntaxKind[SyntaxKind["PropertyDeclaration"] = 173] = "PropertyDeclaration";
	SyntaxKind[SyntaxKind["MethodSignature"] = 174] = "MethodSignature";
	SyntaxKind[SyntaxKind["MethodDeclaration"] = 175] = "MethodDeclaration";
	SyntaxKind[SyntaxKind["ClassStaticBlockDeclaration"] = 176] = "ClassStaticBlockDeclaration";
	SyntaxKind[SyntaxKind["Constructor"] = 177] = "Constructor";
	SyntaxKind[SyntaxKind["GetAccessor"] = 178] = "GetAccessor";
	SyntaxKind[SyntaxKind["SetAccessor"] = 179] = "SetAccessor";
	SyntaxKind[SyntaxKind["CallSignature"] = 180] = "CallSignature";
	SyntaxKind[SyntaxKind["ConstructSignature"] = 181] = "ConstructSignature";
	SyntaxKind[SyntaxKind["IndexSignature"] = 182] = "IndexSignature";
	SyntaxKind[SyntaxKind["TypePredicate"] = 183] = "TypePredicate";
	SyntaxKind[SyntaxKind["TypeReference"] = 184] = "TypeReference";
	SyntaxKind[SyntaxKind["FunctionType"] = 185] = "FunctionType";
	SyntaxKind[SyntaxKind["ConstructorType"] = 186] = "ConstructorType";
	SyntaxKind[SyntaxKind["TypeQuery"] = 187] = "TypeQuery";
	SyntaxKind[SyntaxKind["TypeLiteral"] = 188] = "TypeLiteral";
	SyntaxKind[SyntaxKind["ArrayType"] = 189] = "ArrayType";
	SyntaxKind[SyntaxKind["TupleType"] = 190] = "TupleType";
	SyntaxKind[SyntaxKind["OptionalType"] = 191] = "OptionalType";
	SyntaxKind[SyntaxKind["RestType"] = 192] = "RestType";
	SyntaxKind[SyntaxKind["UnionType"] = 193] = "UnionType";
	SyntaxKind[SyntaxKind["IntersectionType"] = 194] = "IntersectionType";
	SyntaxKind[SyntaxKind["ConditionalType"] = 195] = "ConditionalType";
	SyntaxKind[SyntaxKind["InferType"] = 196] = "InferType";
	SyntaxKind[SyntaxKind["ParenthesizedType"] = 197] = "ParenthesizedType";
	SyntaxKind[SyntaxKind["ThisType"] = 198] = "ThisType";
	SyntaxKind[SyntaxKind["TypeOperator"] = 199] = "TypeOperator";
	SyntaxKind[SyntaxKind["IndexedAccessType"] = 200] = "IndexedAccessType";
	SyntaxKind[SyntaxKind["MappedType"] = 201] = "MappedType";
	SyntaxKind[SyntaxKind["LiteralType"] = 202] = "LiteralType";
	SyntaxKind[SyntaxKind["NamedTupleMember"] = 203] = "NamedTupleMember";
	SyntaxKind[SyntaxKind["TemplateLiteralType"] = 204] = "TemplateLiteralType";
	SyntaxKind[SyntaxKind["TemplateLiteralTypeSpan"] = 205] = "TemplateLiteralTypeSpan";
	SyntaxKind[SyntaxKind["ImportType"] = 206] = "ImportType";
	SyntaxKind[SyntaxKind["ObjectBindingPattern"] = 207] = "ObjectBindingPattern";
	SyntaxKind[SyntaxKind["ArrayBindingPattern"] = 208] = "ArrayBindingPattern";
	SyntaxKind[SyntaxKind["BindingElement"] = 209] = "BindingElement";
	SyntaxKind[SyntaxKind["ArrayLiteralExpression"] = 210] = "ArrayLiteralExpression";
	SyntaxKind[SyntaxKind["ObjectLiteralExpression"] = 211] = "ObjectLiteralExpression";
	SyntaxKind[SyntaxKind["PropertyAccessExpression"] = 212] = "PropertyAccessExpression";
	SyntaxKind[SyntaxKind["ElementAccessExpression"] = 213] = "ElementAccessExpression";
	SyntaxKind[SyntaxKind["CallExpression"] = 214] = "CallExpression";
	SyntaxKind[SyntaxKind["NewExpression"] = 215] = "NewExpression";
	SyntaxKind[SyntaxKind["TaggedTemplateExpression"] = 216] = "TaggedTemplateExpression";
	SyntaxKind[SyntaxKind["TypeAssertionExpression"] = 217] = "TypeAssertionExpression";
	SyntaxKind[SyntaxKind["ParenthesizedExpression"] = 218] = "ParenthesizedExpression";
	SyntaxKind[SyntaxKind["FunctionExpression"] = 219] = "FunctionExpression";
	SyntaxKind[SyntaxKind["ArrowFunction"] = 220] = "ArrowFunction";
	SyntaxKind[SyntaxKind["DeleteExpression"] = 221] = "DeleteExpression";
	SyntaxKind[SyntaxKind["TypeOfExpression"] = 222] = "TypeOfExpression";
	SyntaxKind[SyntaxKind["VoidExpression"] = 223] = "VoidExpression";
	SyntaxKind[SyntaxKind["AwaitExpression"] = 224] = "AwaitExpression";
	SyntaxKind[SyntaxKind["PrefixUnaryExpression"] = 225] = "PrefixUnaryExpression";
	SyntaxKind[SyntaxKind["PostfixUnaryExpression"] = 226] = "PostfixUnaryExpression";
	SyntaxKind[SyntaxKind["BinaryExpression"] = 227] = "BinaryExpression";
	SyntaxKind[SyntaxKind["ConditionalExpression"] = 228] = "ConditionalExpression";
	SyntaxKind[SyntaxKind["TemplateExpression"] = 229] = "TemplateExpression";
	SyntaxKind[SyntaxKind["YieldExpression"] = 230] = "YieldExpression";
	SyntaxKind[SyntaxKind["SpreadElement"] = 231] = "SpreadElement";
	SyntaxKind[SyntaxKind["ClassExpression"] = 232] = "ClassExpression";
	SyntaxKind[SyntaxKind["OmittedExpression"] = 233] = "OmittedExpression";
	SyntaxKind[SyntaxKind["ExpressionWithTypeArguments"] = 234] = "ExpressionWithTypeArguments";
	SyntaxKind[SyntaxKind["AsExpression"] = 235] = "AsExpression";
	SyntaxKind[SyntaxKind["NonNullExpression"] = 236] = "NonNullExpression";
	SyntaxKind[SyntaxKind["MetaProperty"] = 237] = "MetaProperty";
	SyntaxKind[SyntaxKind["SyntheticExpression"] = 238] = "SyntheticExpression";
	SyntaxKind[SyntaxKind["SatisfiesExpression"] = 239] = "SatisfiesExpression";
	SyntaxKind[SyntaxKind["TemplateSpan"] = 240] = "TemplateSpan";
	SyntaxKind[SyntaxKind["SemicolonClassElement"] = 241] = "SemicolonClassElement";
	SyntaxKind[SyntaxKind["Block"] = 242] = "Block";
	SyntaxKind[SyntaxKind["EmptyStatement"] = 243] = "EmptyStatement";
	SyntaxKind[SyntaxKind["VariableStatement"] = 244] = "VariableStatement";
	SyntaxKind[SyntaxKind["ExpressionStatement"] = 245] = "ExpressionStatement";
	SyntaxKind[SyntaxKind["IfStatement"] = 246] = "IfStatement";
	SyntaxKind[SyntaxKind["DoStatement"] = 247] = "DoStatement";
	SyntaxKind[SyntaxKind["WhileStatement"] = 248] = "WhileStatement";
	SyntaxKind[SyntaxKind["ForStatement"] = 249] = "ForStatement";
	SyntaxKind[SyntaxKind["ForInStatement"] = 250] = "ForInStatement";
	SyntaxKind[SyntaxKind["ForOfStatement"] = 251] = "ForOfStatement";
	SyntaxKind[SyntaxKind["ContinueStatement"] = 252] = "ContinueStatement";
	SyntaxKind[SyntaxKind["BreakStatement"] = 253] = "BreakStatement";
	SyntaxKind[SyntaxKind["ReturnStatement"] = 254] = "ReturnStatement";
	SyntaxKind[SyntaxKind["WithStatement"] = 255] = "WithStatement";
	SyntaxKind[SyntaxKind["SwitchStatement"] = 256] = "SwitchStatement";
	SyntaxKind[SyntaxKind["LabeledStatement"] = 257] = "LabeledStatement";
	SyntaxKind[SyntaxKind["ThrowStatement"] = 258] = "ThrowStatement";
	SyntaxKind[SyntaxKind["TryStatement"] = 259] = "TryStatement";
	SyntaxKind[SyntaxKind["DebuggerStatement"] = 260] = "DebuggerStatement";
	SyntaxKind[SyntaxKind["VariableDeclaration"] = 261] = "VariableDeclaration";
	SyntaxKind[SyntaxKind["VariableDeclarationList"] = 262] = "VariableDeclarationList";
	SyntaxKind[SyntaxKind["FunctionDeclaration"] = 263] = "FunctionDeclaration";
	SyntaxKind[SyntaxKind["ClassDeclaration"] = 264] = "ClassDeclaration";
	SyntaxKind[SyntaxKind["InterfaceDeclaration"] = 265] = "InterfaceDeclaration";
	SyntaxKind[SyntaxKind["TypeAliasDeclaration"] = 266] = "TypeAliasDeclaration";
	SyntaxKind[SyntaxKind["EnumDeclaration"] = 267] = "EnumDeclaration";
	SyntaxKind[SyntaxKind["ModuleDeclaration"] = 268] = "ModuleDeclaration";
	SyntaxKind[SyntaxKind["ModuleBlock"] = 269] = "ModuleBlock";
	SyntaxKind[SyntaxKind["CaseBlock"] = 270] = "CaseBlock";
	SyntaxKind[SyntaxKind["NamespaceExportDeclaration"] = 271] = "NamespaceExportDeclaration";
	SyntaxKind[SyntaxKind["ImportEqualsDeclaration"] = 272] = "ImportEqualsDeclaration";
	SyntaxKind[SyntaxKind["ImportDeclaration"] = 273] = "ImportDeclaration";
	SyntaxKind[SyntaxKind["ImportClause"] = 274] = "ImportClause";
	SyntaxKind[SyntaxKind["NamespaceImport"] = 275] = "NamespaceImport";
	SyntaxKind[SyntaxKind["NamedImports"] = 276] = "NamedImports";
	SyntaxKind[SyntaxKind["ImportSpecifier"] = 277] = "ImportSpecifier";
	SyntaxKind[SyntaxKind["ExportAssignment"] = 278] = "ExportAssignment";
	SyntaxKind[SyntaxKind["ExportDeclaration"] = 279] = "ExportDeclaration";
	SyntaxKind[SyntaxKind["NamedExports"] = 280] = "NamedExports";
	SyntaxKind[SyntaxKind["NamespaceExport"] = 281] = "NamespaceExport";
	SyntaxKind[SyntaxKind["ExportSpecifier"] = 282] = "ExportSpecifier";
	SyntaxKind[SyntaxKind["MissingDeclaration"] = 283] = "MissingDeclaration";
	SyntaxKind[SyntaxKind["ExternalModuleReference"] = 284] = "ExternalModuleReference";
	SyntaxKind[SyntaxKind["JsxElement"] = 285] = "JsxElement";
	SyntaxKind[SyntaxKind["JsxSelfClosingElement"] = 286] = "JsxSelfClosingElement";
	SyntaxKind[SyntaxKind["JsxOpeningElement"] = 287] = "JsxOpeningElement";
	SyntaxKind[SyntaxKind["JsxClosingElement"] = 288] = "JsxClosingElement";
	SyntaxKind[SyntaxKind["JsxFragment"] = 289] = "JsxFragment";
	SyntaxKind[SyntaxKind["JsxOpeningFragment"] = 290] = "JsxOpeningFragment";
	SyntaxKind[SyntaxKind["JsxClosingFragment"] = 291] = "JsxClosingFragment";
	SyntaxKind[SyntaxKind["JsxAttribute"] = 292] = "JsxAttribute";
	SyntaxKind[SyntaxKind["JsxAttributes"] = 293] = "JsxAttributes";
	SyntaxKind[SyntaxKind["JsxSpreadAttribute"] = 294] = "JsxSpreadAttribute";
	SyntaxKind[SyntaxKind["JsxExpression"] = 295] = "JsxExpression";
	SyntaxKind[SyntaxKind["JsxNamespacedName"] = 296] = "JsxNamespacedName";
	SyntaxKind[SyntaxKind["CaseClause"] = 297] = "CaseClause";
	SyntaxKind[SyntaxKind["DefaultClause"] = 298] = "DefaultClause";
	SyntaxKind[SyntaxKind["HeritageClause"] = 299] = "HeritageClause";
	SyntaxKind[SyntaxKind["CatchClause"] = 300] = "CatchClause";
	SyntaxKind[SyntaxKind["ImportAttributes"] = 301] = "ImportAttributes";
	SyntaxKind[SyntaxKind["ImportAttribute"] = 302] = "ImportAttribute";
	SyntaxKind[SyntaxKind["PropertyAssignment"] = 303] = "PropertyAssignment";
	SyntaxKind[SyntaxKind["ShorthandPropertyAssignment"] = 304] = "ShorthandPropertyAssignment";
	SyntaxKind[SyntaxKind["SpreadAssignment"] = 305] = "SpreadAssignment";
	SyntaxKind[SyntaxKind["EnumMember"] = 306] = "EnumMember";
	SyntaxKind[SyntaxKind["SourceFile"] = 307] = "SourceFile";
	SyntaxKind[SyntaxKind["JSDocTypeExpression"] = 308] = "JSDocTypeExpression";
	SyntaxKind[SyntaxKind["JSDocNameReference"] = 309] = "JSDocNameReference";
	SyntaxKind[SyntaxKind["JSDocAllType"] = 310] = "JSDocAllType";
	SyntaxKind[SyntaxKind["JSDocNullableType"] = 311] = "JSDocNullableType";
	SyntaxKind[SyntaxKind["JSDocNonNullableType"] = 312] = "JSDocNonNullableType";
	SyntaxKind[SyntaxKind["JSDocOptionalType"] = 313] = "JSDocOptionalType";
	SyntaxKind[SyntaxKind["JSDocVariadicType"] = 314] = "JSDocVariadicType";
	SyntaxKind[SyntaxKind["JSDoc"] = 315] = "JSDoc";
	SyntaxKind[SyntaxKind["JSDocText"] = 316] = "JSDocText";
	SyntaxKind[SyntaxKind["JSDocTypeLiteral"] = 317] = "JSDocTypeLiteral";
	SyntaxKind[SyntaxKind["JSDocSignature"] = 318] = "JSDocSignature";
	SyntaxKind[SyntaxKind["JSDocLink"] = 319] = "JSDocLink";
	SyntaxKind[SyntaxKind["JSDocLinkCode"] = 320] = "JSDocLinkCode";
	SyntaxKind[SyntaxKind["JSDocLinkPlain"] = 321] = "JSDocLinkPlain";
	SyntaxKind[SyntaxKind["JSDocUnknownTag"] = 322] = "JSDocUnknownTag";
	SyntaxKind[SyntaxKind["JSDocAugmentsTag"] = 323] = "JSDocAugmentsTag";
	SyntaxKind[SyntaxKind["JSDocImplementsTag"] = 324] = "JSDocImplementsTag";
	SyntaxKind[SyntaxKind["JSDocDeprecatedTag"] = 325] = "JSDocDeprecatedTag";
	SyntaxKind[SyntaxKind["JSDocPublicTag"] = 326] = "JSDocPublicTag";
	SyntaxKind[SyntaxKind["JSDocPrivateTag"] = 327] = "JSDocPrivateTag";
	SyntaxKind[SyntaxKind["JSDocProtectedTag"] = 328] = "JSDocProtectedTag";
	SyntaxKind[SyntaxKind["JSDocReadonlyTag"] = 329] = "JSDocReadonlyTag";
	SyntaxKind[SyntaxKind["JSDocOverrideTag"] = 330] = "JSDocOverrideTag";
	SyntaxKind[SyntaxKind["JSDocCallbackTag"] = 331] = "JSDocCallbackTag";
	SyntaxKind[SyntaxKind["JSDocOverloadTag"] = 332] = "JSDocOverloadTag";
	SyntaxKind[SyntaxKind["JSDocParameterTag"] = 333] = "JSDocParameterTag";
	SyntaxKind[SyntaxKind["JSDocReturnTag"] = 334] = "JSDocReturnTag";
	SyntaxKind[SyntaxKind["JSDocThisTag"] = 335] = "JSDocThisTag";
	SyntaxKind[SyntaxKind["JSDocTypeTag"] = 336] = "JSDocTypeTag";
	SyntaxKind[SyntaxKind["JSDocTemplateTag"] = 337] = "JSDocTemplateTag";
	SyntaxKind[SyntaxKind["JSDocTypedefTag"] = 338] = "JSDocTypedefTag";
	SyntaxKind[SyntaxKind["JSDocSeeTag"] = 339] = "JSDocSeeTag";
	SyntaxKind[SyntaxKind["JSDocPropertyTag"] = 340] = "JSDocPropertyTag";
	SyntaxKind[SyntaxKind["JSDocThrowsTag"] = 341] = "JSDocThrowsTag";
	SyntaxKind[SyntaxKind["JSDocSatisfiesTag"] = 342] = "JSDocSatisfiesTag";
	SyntaxKind[SyntaxKind["JSDocImportTag"] = 343] = "JSDocImportTag";
	SyntaxKind[SyntaxKind["SyntaxList"] = 344] = "SyntaxList";
	SyntaxKind[SyntaxKind["JSTypeAliasDeclaration"] = 345] = "JSTypeAliasDeclaration";
	SyntaxKind[SyntaxKind["JSImportDeclaration"] = 346] = "JSImportDeclaration";
	SyntaxKind[SyntaxKind["NotEmittedStatement"] = 347] = "NotEmittedStatement";
	SyntaxKind[SyntaxKind["PartiallyEmittedExpression"] = 348] = "PartiallyEmittedExpression";
	SyntaxKind[SyntaxKind["SyntheticReferenceExpression"] = 349] = "SyntheticReferenceExpression";
	SyntaxKind[SyntaxKind["NotEmittedTypeElement"] = 350] = "NotEmittedTypeElement";
	SyntaxKind[SyntaxKind["Count"] = 351] = "Count";
	SyntaxKind[SyntaxKind["FirstAssignment"] = 63] = "FirstAssignment";
	SyntaxKind[SyntaxKind["LastAssignment"] = 78] = "LastAssignment";
	SyntaxKind[SyntaxKind["FirstCompoundAssignment"] = 64] = "FirstCompoundAssignment";
	SyntaxKind[SyntaxKind["LastCompoundAssignment"] = 78] = "LastCompoundAssignment";
	SyntaxKind[SyntaxKind["FirstReservedWord"] = 82] = "FirstReservedWord";
	SyntaxKind[SyntaxKind["LastReservedWord"] = 117] = "LastReservedWord";
	SyntaxKind[SyntaxKind["FirstKeyword"] = 82] = "FirstKeyword";
	SyntaxKind[SyntaxKind["LastKeyword"] = 166] = "LastKeyword";
	SyntaxKind[SyntaxKind["FirstFutureReservedWord"] = 118] = "FirstFutureReservedWord";
	SyntaxKind[SyntaxKind["LastFutureReservedWord"] = 126] = "LastFutureReservedWord";
	SyntaxKind[SyntaxKind["FirstTypeNode"] = 183] = "FirstTypeNode";
	SyntaxKind[SyntaxKind["LastTypeNode"] = 206] = "LastTypeNode";
	SyntaxKind[SyntaxKind["FirstPunctuation"] = 18] = "FirstPunctuation";
	SyntaxKind[SyntaxKind["LastPunctuation"] = 78] = "LastPunctuation";
	SyntaxKind[SyntaxKind["FirstToken"] = 0] = "FirstToken";
	SyntaxKind[SyntaxKind["LastToken"] = 166] = "LastToken";
	SyntaxKind[SyntaxKind["FirstLiteralToken"] = 8] = "FirstLiteralToken";
	SyntaxKind[SyntaxKind["LastLiteralToken"] = 14] = "LastLiteralToken";
	SyntaxKind[SyntaxKind["FirstTemplateToken"] = 14] = "FirstTemplateToken";
	SyntaxKind[SyntaxKind["LastTemplateToken"] = 17] = "LastTemplateToken";
	SyntaxKind[SyntaxKind["FirstBinaryOperator"] = 29] = "FirstBinaryOperator";
	SyntaxKind[SyntaxKind["LastBinaryOperator"] = 78] = "LastBinaryOperator";
	SyntaxKind[SyntaxKind["FirstStatement"] = 244] = "FirstStatement";
	SyntaxKind[SyntaxKind["LastStatement"] = 260] = "LastStatement";
	SyntaxKind[SyntaxKind["FirstNode"] = 167] = "FirstNode";
	SyntaxKind[SyntaxKind["FirstJSDocNode"] = 308] = "FirstJSDocNode";
	SyntaxKind[SyntaxKind["LastJSDocNode"] = 343] = "LastJSDocNode";
	SyntaxKind[SyntaxKind["FirstJSDocTagNode"] = 322] = "FirstJSDocTagNode";
	SyntaxKind[SyntaxKind["LastJSDocTagNode"] = 343] = "LastJSDocTagNode";
	SyntaxKind[SyntaxKind["FirstContextualKeyword"] = 127] = "FirstContextualKeyword";
	SyntaxKind[SyntaxKind["LastContextualKeyword"] = 166] = "LastContextualKeyword";
	SyntaxKind[SyntaxKind["LastUnaryOperator"] = 54] = "LastUnaryOperator";
	SyntaxKind[SyntaxKind["FirstTriviaToken"] = 2] = "FirstTriviaToken";
	SyntaxKind[SyntaxKind["LastTriviaToken"] = 6] = "LastTriviaToken";
})(SyntaxKind || (SyntaxKind = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/tokenFlags.js
var TokenFlags;
(function(TokenFlags) {
	TokenFlags[TokenFlags["None"] = 0] = "None";
	TokenFlags[TokenFlags["PrecedingLineBreak"] = 1] = "PrecedingLineBreak";
	TokenFlags[TokenFlags["PrecedingJSDocComment"] = 2] = "PrecedingJSDocComment";
	TokenFlags[TokenFlags["Unterminated"] = 4] = "Unterminated";
	TokenFlags[TokenFlags["ExtendedUnicodeEscape"] = 8] = "ExtendedUnicodeEscape";
	TokenFlags[TokenFlags["Scientific"] = 16] = "Scientific";
	TokenFlags[TokenFlags["Octal"] = 32] = "Octal";
	TokenFlags[TokenFlags["HexSpecifier"] = 64] = "HexSpecifier";
	TokenFlags[TokenFlags["BinarySpecifier"] = 128] = "BinarySpecifier";
	TokenFlags[TokenFlags["OctalSpecifier"] = 256] = "OctalSpecifier";
	TokenFlags[TokenFlags["ContainsSeparator"] = 512] = "ContainsSeparator";
	TokenFlags[TokenFlags["UnicodeEscape"] = 1024] = "UnicodeEscape";
	TokenFlags[TokenFlags["ContainsInvalidEscape"] = 2048] = "ContainsInvalidEscape";
	TokenFlags[TokenFlags["HexEscape"] = 4096] = "HexEscape";
	TokenFlags[TokenFlags["ContainsLeadingZero"] = 8192] = "ContainsLeadingZero";
	TokenFlags[TokenFlags["ContainsInvalidSeparator"] = 16384] = "ContainsInvalidSeparator";
	TokenFlags[TokenFlags["PrecedingJSDocLeadingAsterisks"] = 32768] = "PrecedingJSDocLeadingAsterisks";
	TokenFlags[TokenFlags["SingleQuote"] = 65536] = "SingleQuote";
	TokenFlags[TokenFlags["PrecedingJSDocWithDeprecated"] = 131072] = "PrecedingJSDocWithDeprecated";
	TokenFlags[TokenFlags["PrecedingJSDocWithSeeOrLink"] = 262144] = "PrecedingJSDocWithSeeOrLink";
	TokenFlags[TokenFlags["BinaryOrOctalSpecifier"] = 384] = "BinaryOrOctalSpecifier";
	TokenFlags[TokenFlags["WithSpecifier"] = 448] = "WithSpecifier";
	TokenFlags[TokenFlags["StringLiteralFlags"] = 72716] = "StringLiteralFlags";
	TokenFlags[TokenFlags["NumericLiteralFlags"] = 25584] = "NumericLiteralFlags";
	TokenFlags[TokenFlags["TemplateLiteralLikeFlags"] = 7180] = "TemplateLiteralLikeFlags";
	TokenFlags[TokenFlags["RegularExpressionLiteralFlags"] = 4] = "RegularExpressionLiteralFlags";
	TokenFlags[TokenFlags["IsInvalid"] = 26656] = "IsInvalid";
})(TokenFlags || (TokenFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/ast/utils.js
/**
* Remove one extra leading underscore from an identifier name, recovering the
* display form from its escaped {@link __String} key.
*/
function unescapeLeadingUnderscores(identifier) {
	const id = identifier;
	return id.length >= 3 && id.charCodeAt(0) === CharacterCodes._ && id.charCodeAt(1) === CharacterCodes._ && id.charCodeAt(2) === CharacterCodes._ ? id.slice(1) : id;
}
//#endregion
//#region ../../node_modules/typescript/dist/enums/outerExpressionKinds.js
var OuterExpressionKinds;
(function(OuterExpressionKinds) {
	OuterExpressionKinds[OuterExpressionKinds["Parentheses"] = 1] = "Parentheses";
	OuterExpressionKinds[OuterExpressionKinds["TypeAssertions"] = 2] = "TypeAssertions";
	OuterExpressionKinds[OuterExpressionKinds["NonNullAssertions"] = 4] = "NonNullAssertions";
	OuterExpressionKinds[OuterExpressionKinds["PartiallyEmittedExpressions"] = 8] = "PartiallyEmittedExpressions";
	OuterExpressionKinds[OuterExpressionKinds["ExpressionsWithTypeArguments"] = 16] = "ExpressionsWithTypeArguments";
	OuterExpressionKinds[OuterExpressionKinds["Satisfies"] = 32] = "Satisfies";
	OuterExpressionKinds[OuterExpressionKinds["ExcludeJSDocTypeAssertion"] = 64] = "ExcludeJSDocTypeAssertion";
	OuterExpressionKinds[OuterExpressionKinds["Assignments"] = 128] = "Assignments";
	OuterExpressionKinds[OuterExpressionKinds["Comma"] = 256] = "Comma";
	OuterExpressionKinds[OuterExpressionKinds["Assertions"] = 38] = "Assertions";
	OuterExpressionKinds[OuterExpressionKinds["All"] = 63] = "All";
	OuterExpressionKinds[OuterExpressionKinds["AllExceptAssertionsOrExpressionsWithTypeArguments"] = 9] = "AllExceptAssertionsOrExpressionsWithTypeArguments";
	OuterExpressionKinds[OuterExpressionKinds["ExpressionTypePassthrough"] = 385] = "ExpressionTypePassthrough";
})(OuterExpressionKinds || (OuterExpressionKinds = {}));
function isPropertyAccessExpression(node) {
	return node.kind === SyntaxKind.PropertyAccessExpression;
}
function isCallExpression(node) {
	return node.kind === SyntaxKind.CallExpression;
}
function isTokenKind(kind) {
	return kind >= SyntaxKind.FirstToken && kind <= SyntaxKind.LastToken;
}
function isJSDocNodeKind(kind) {
	return kind >= SyntaxKind.FirstJSDocNode && kind <= SyntaxKind.LastJSDocNode;
}
SyntaxKind.QualifiedName, SyntaxKind.ComputedPropertyName, SyntaxKind.Decorator, SyntaxKind.IfStatement, SyntaxKind.DoStatement, SyntaxKind.WhileStatement, SyntaxKind.ForStatement, SyntaxKind.BreakStatement, SyntaxKind.ContinueStatement, SyntaxKind.ReturnStatement, SyntaxKind.WithStatement, SyntaxKind.SwitchStatement, SyntaxKind.CaseBlock, SyntaxKind.ThrowStatement, SyntaxKind.TryStatement, SyntaxKind.CatchClause, SyntaxKind.LabeledStatement, SyntaxKind.ExpressionStatement, SyntaxKind.Block, SyntaxKind.VariableStatement, SyntaxKind.VariableDeclaration, SyntaxKind.VariableDeclarationList, SyntaxKind.Parameter, SyntaxKind.BindingElement, SyntaxKind.MissingDeclaration, SyntaxKind.FunctionDeclaration, SyntaxKind.ClassDeclaration, SyntaxKind.ClassExpression, SyntaxKind.HeritageClause, SyntaxKind.InterfaceDeclaration, SyntaxKind.TypeAliasDeclaration, SyntaxKind.EnumMember, SyntaxKind.EnumDeclaration, SyntaxKind.ModuleBlock, SyntaxKind.ImportDeclaration, SyntaxKind.ExternalModuleReference, SyntaxKind.NamespaceImport, SyntaxKind.NamedImports, SyntaxKind.ExportAssignment, SyntaxKind.NamespaceExportDeclaration, SyntaxKind.NamespaceExport, SyntaxKind.NamedExports, SyntaxKind.ExportSpecifier, SyntaxKind.CallSignature, SyntaxKind.ConstructSignature, SyntaxKind.Constructor, SyntaxKind.GetAccessor, SyntaxKind.SetAccessor, SyntaxKind.IndexSignature, SyntaxKind.MethodSignature, SyntaxKind.MethodDeclaration, SyntaxKind.PropertySignature, SyntaxKind.PropertyDeclaration, SyntaxKind.ClassStaticBlockDeclaration, SyntaxKind.BinaryExpression, SyntaxKind.PrefixUnaryExpression, SyntaxKind.PostfixUnaryExpression, SyntaxKind.YieldExpression, SyntaxKind.ArrowFunction, SyntaxKind.FunctionExpression, SyntaxKind.AsExpression, SyntaxKind.SatisfiesExpression, SyntaxKind.ConditionalExpression, SyntaxKind.PropertyAccessExpression, SyntaxKind.ElementAccessExpression, SyntaxKind.CallExpression, SyntaxKind.NewExpression, SyntaxKind.MetaProperty, SyntaxKind.NonNullExpression, SyntaxKind.SpreadElement, SyntaxKind.TemplateExpression, SyntaxKind.TemplateSpan, SyntaxKind.TaggedTemplateExpression, SyntaxKind.ParenthesizedExpression, SyntaxKind.ArrayLiteralExpression, SyntaxKind.ObjectLiteralExpression, SyntaxKind.SpreadAssignment, SyntaxKind.PropertyAssignment, SyntaxKind.ShorthandPropertyAssignment, SyntaxKind.DeleteExpression, SyntaxKind.TypeOfExpression, SyntaxKind.VoidExpression, SyntaxKind.AwaitExpression, SyntaxKind.TypeAssertionExpression, SyntaxKind.UnionType, SyntaxKind.IntersectionType, SyntaxKind.ConditionalType, SyntaxKind.TypeOperator, SyntaxKind.InferType, SyntaxKind.ArrayType, SyntaxKind.IndexedAccessType, SyntaxKind.TypeReference, SyntaxKind.ExpressionWithTypeArguments, SyntaxKind.LiteralType, SyntaxKind.TypePredicate, SyntaxKind.ImportAttribute, SyntaxKind.ImportAttributes, SyntaxKind.TypeQuery, SyntaxKind.MappedType, SyntaxKind.TypeLiteral, SyntaxKind.TupleType, SyntaxKind.NamedTupleMember, SyntaxKind.OptionalType, SyntaxKind.RestType, SyntaxKind.ParenthesizedType, SyntaxKind.FunctionType, SyntaxKind.ConstructorType, SyntaxKind.TemplateLiteralType, SyntaxKind.TemplateLiteralTypeSpan, SyntaxKind.SyntheticExpression, SyntaxKind.PartiallyEmittedExpression, SyntaxKind.JsxElement, SyntaxKind.JsxAttributes, SyntaxKind.JsxNamespacedName, SyntaxKind.JsxOpeningElement, SyntaxKind.JsxSelfClosingElement, SyntaxKind.JsxFragment, SyntaxKind.JsxAttribute, SyntaxKind.JsxSpreadAttribute, SyntaxKind.JsxClosingElement, SyntaxKind.JsxExpression, SyntaxKind.SyntaxList, SyntaxKind.JSDoc, SyntaxKind.JSDocTypeExpression, SyntaxKind.JSDocNonNullableType, SyntaxKind.JSDocNullableType, SyntaxKind.JSDocVariadicType, SyntaxKind.JSDocOptionalType, SyntaxKind.JSDocTypeTag, SyntaxKind.JSDocUnknownTag, SyntaxKind.JSDocTemplateTag, SyntaxKind.JSDocReturnTag, SyntaxKind.JSDocPublicTag, SyntaxKind.JSDocPrivateTag, SyntaxKind.JSDocProtectedTag, SyntaxKind.JSDocReadonlyTag, SyntaxKind.JSDocOverrideTag, SyntaxKind.JSDocDeprecatedTag, SyntaxKind.JSDocSeeTag, SyntaxKind.JSDocImplementsTag, SyntaxKind.JSDocAugmentsTag, SyntaxKind.JSDocSatisfiesTag, SyntaxKind.JSDocThrowsTag, SyntaxKind.JSDocThisTag, SyntaxKind.JSDocImportTag, SyntaxKind.JSDocCallbackTag, SyntaxKind.JSDocOverloadTag, SyntaxKind.JSDocTypedefTag, SyntaxKind.JSDocSignature, SyntaxKind.JSDocNameReference, SyntaxKind.SourceFile, SyntaxKind.ModuleDeclaration, SyntaxKind.ImportEqualsDeclaration, SyntaxKind.ExportDeclaration, SyntaxKind.ImportType, SyntaxKind.ImportClause, SyntaxKind.ImportSpecifier, SyntaxKind.JSDocLink, SyntaxKind.JSDocLinkPlain, SyntaxKind.JSDocLinkCode, SyntaxKind.TypeParameter, SyntaxKind.SyntheticReferenceExpression, SyntaxKind.JSDocTypeLiteral, SyntaxKind.ForInStatement, SyntaxKind.ForOfStatement, SyntaxKind.CaseClause, SyntaxKind.DefaultClause, SyntaxKind.ObjectBindingPattern, SyntaxKind.ArrayBindingPattern, SyntaxKind.JSDocParameterTag, SyntaxKind.JSDocPropertyTag;
//#endregion
//#region ../../node_modules/typescript/dist/ast/visitor.js
/**
* Hand-written visitor implementations for nodes with runtime-dependent
* child ordering. Generated code in visitor.generated.ts and factory.generated.ts
* delegates to these functions.
*/
function visitNodeForEachChild(cbNode, node) {
	return node ? cbNode(node) : void 0;
}
function visitNodesForEachChild(cbNode, cbNodes, nodes) {
	if (!nodes) return void 0;
	if (cbNodes) return cbNodes(nodes);
	for (const node of nodes) {
		const result = cbNode(node);
		if (result) return result;
	}
}
function forEachChildOfJSDocParameterOrPropertyTag(data, cbNode, cbNodes) {
	return visitNodeForEachChild(cbNode, data.tagName) || (data.isNameFirst ? visitNodeForEachChild(cbNode, data.name) || visitNodeForEachChild(cbNode, data.typeExpression) : visitNodeForEachChild(cbNode, data.typeExpression) || visitNodeForEachChild(cbNode, data.name)) || visitNodesForEachChild(cbNode, cbNodes, data.comment);
}
//#endregion
//#region ../../node_modules/typescript/dist/ast/factory.generated.js
var NodeObject = class {
	kind;
	flags = 0;
	pos = -1;
	end = -1;
	parent = void 0;
	_data;
	constructor(kind, data) {
		this.kind = kind;
		this._data = data;
	}
	get ambientModuleNames() {
		return this._data?.ambientModuleNames;
	}
	get argument() {
		return this._data?.argument;
	}
	get argumentExpression() {
		return this._data?.argumentExpression;
	}
	get arguments() {
		return this._data?.arguments;
	}
	get assertsModifier() {
		return this._data?.assertsModifier;
	}
	get asteriskToken() {
		return this._data?.asteriskToken;
	}
	get attributes() {
		return this._data?.attributes;
	}
	get awaitModifier() {
		return this._data?.awaitModifier;
	}
	get block() {
		return this._data?.block;
	}
	get body() {
		return this._data?.body;
	}
	get caseBlock() {
		return this._data?.caseBlock;
	}
	get catchClause() {
		return this._data?.catchClause;
	}
	get checkType() {
		return this._data?.checkType;
	}
	get children() {
		return this._data?.children;
	}
	get className() {
		return this._data?.className;
	}
	get clauses() {
		return this._data?.clauses;
	}
	get closingElement() {
		return this._data?.closingElement;
	}
	get closingFragment() {
		return this._data?.closingFragment;
	}
	get colonToken() {
		return this._data?.colonToken;
	}
	get comment() {
		return this._data?.comment;
	}
	get condition() {
		return this._data?.condition;
	}
	get constraint() {
		return this._data?.constraint;
	}
	get containsOnlyTriviaWhiteSpaces() {
		return this._data?.containsOnlyTriviaWhiteSpaces;
	}
	get declarationList() {
		return this._data?.declarationList;
	}
	get declarations() {
		return this._data?.declarations;
	}
	get defaultType() {
		return this._data?.defaultType;
	}
	get dotDotDotToken() {
		return this._data?.dotDotDotToken;
	}
	get elementType() {
		return this._data?.elementType;
	}
	get elements() {
		return this._data?.elements;
	}
	get elseStatement() {
		return this._data?.elseStatement;
	}
	get endOfFileToken() {
		return this._data?.endOfFileToken;
	}
	get equalsGreaterThanToken() {
		return this._data?.equalsGreaterThanToken;
	}
	get equalsToken() {
		return this._data?.equalsToken;
	}
	get exclamationToken() {
		return this._data?.exclamationToken;
	}
	get exportClause() {
		return this._data?.exportClause;
	}
	get exprName() {
		return this._data?.exprName;
	}
	get expression() {
		return this._data?.expression;
	}
	get extendsType() {
		return this._data?.extendsType;
	}
	get externalModuleIndicator() {
		return this._data?.externalModuleIndicator;
	}
	get falseType() {
		return this._data?.falseType;
	}
	get fileName() {
		return this._data?.fileName;
	}
	get finallyBlock() {
		return this._data?.finallyBlock;
	}
	get head() {
		return this._data?.head;
	}
	get heritageClauses() {
		return this._data?.heritageClauses;
	}
	get importClause() {
		return this._data?.importClause;
	}
	get imports() {
		return this._data?.imports;
	}
	get incrementor() {
		return this._data?.incrementor;
	}
	get indexType() {
		return this._data?.indexType;
	}
	get initializer() {
		return this._data?.initializer;
	}
	get isArrayType() {
		return this._data?.isArrayType;
	}
	get isBracketed() {
		return this._data?.isBracketed;
	}
	get isDeclarationFile() {
		return this._data?.isDeclarationFile;
	}
	get isExportEquals() {
		return this._data?.isExportEquals;
	}
	get isNameFirst() {
		return this._data?.isNameFirst;
	}
	get isSpread() {
		return this._data?.isSpread;
	}
	get isTypeOf() {
		return this._data?.isTypeOf;
	}
	get isTypeOnly() {
		return this._data?.isTypeOnly;
	}
	get jsdocPropertyTags() {
		return this._data?.jsdocPropertyTags;
	}
	get keyword() {
		return this._data?.keyword;
	}
	get keywordToken() {
		return this._data?.keywordToken;
	}
	get label() {
		return this._data?.label;
	}
	get languageVariant() {
		return this._data?.languageVariant;
	}
	get left() {
		return this._data?.left;
	}
	get libReferenceDirectives() {
		return this._data?.libReferenceDirectives;
	}
	get literal() {
		return this._data?.literal;
	}
	get members() {
		return this._data?.members;
	}
	get modifiers() {
		return this._data?.modifiers;
	}
	get moduleAugmentations() {
		return this._data?.moduleAugmentations;
	}
	get moduleReference() {
		return this._data?.moduleReference;
	}
	get moduleSpecifier() {
		return this._data?.moduleSpecifier;
	}
	get multiLine() {
		return this._data?.multiLine;
	}
	get name() {
		return this._data?.name;
	}
	get nameExpression() {
		return this._data?.nameExpression;
	}
	get nameType() {
		return this._data?.nameType;
	}
	get namedBindings() {
		return this._data?.namedBindings;
	}
	get namespace() {
		return this._data?.namespace;
	}
	get objectAssignmentInitializer() {
		return this._data?.objectAssignmentInitializer;
	}
	get objectType() {
		return this._data?.objectType;
	}
	get openingElement() {
		return this._data?.openingElement;
	}
	get openingFragment() {
		return this._data?.openingFragment;
	}
	get operand() {
		return this._data?.operand;
	}
	get operator() {
		return this._data?.operator;
	}
	get operatorToken() {
		return this._data?.operatorToken;
	}
	get parameterName() {
		return this._data?.parameterName;
	}
	get parameters() {
		return this._data?.parameters;
	}
	get path() {
		return this._data?.path;
	}
	get phaseModifier() {
		return this._data?.phaseModifier;
	}
	get postfixToken() {
		return this._data?.postfixToken;
	}
	get properties() {
		return this._data?.properties;
	}
	get propertyName() {
		return this._data?.propertyName;
	}
	get qualifier() {
		return this._data?.qualifier;
	}
	get questionDotToken() {
		return this._data?.questionDotToken;
	}
	get questionToken() {
		return this._data?.questionToken;
	}
	get rawText() {
		return this._data?.rawText;
	}
	get readonlyToken() {
		return this._data?.readonlyToken;
	}
	get referencedFiles() {
		return this._data?.referencedFiles;
	}
	get right() {
		return this._data?.right;
	}
	get scriptKind() {
		return this._data?.scriptKind;
	}
	get statement() {
		return this._data?.statement;
	}
	get statements() {
		return this._data?.statements;
	}
	get tag() {
		return this._data?.tag;
	}
	get tagName() {
		return this._data?.tagName;
	}
	get tags() {
		return this._data?.tags;
	}
	get template() {
		return this._data?.template;
	}
	get templateFlags() {
		return this._data?.templateFlags;
	}
	get templateSpans() {
		return this._data?.templateSpans;
	}
	get text() {
		return this._data?.text;
	}
	get thenStatement() {
		return this._data?.thenStatement;
	}
	get thisArg() {
		return this._data?.thisArg;
	}
	get token() {
		return this._data?.token;
	}
	get tokenCache() {
		return this._data?.tokenCache;
	}
	get tokenFlags() {
		return this._data?.tokenFlags;
	}
	get trueType() {
		return this._data?.trueType;
	}
	get tryBlock() {
		return this._data?.tryBlock;
	}
	get tupleNameSource() {
		return this._data?.tupleNameSource;
	}
	get type() {
		return this._data?.type;
	}
	get typeArguments() {
		return this._data?.typeArguments;
	}
	get typeExpression() {
		return this._data?.typeExpression;
	}
	get typeName() {
		return this._data?.typeName;
	}
	get typeParameter() {
		return this._data?.typeParameter;
	}
	get typeParameters() {
		return this._data?.typeParameters;
	}
	get typeReferenceDirectives() {
		return this._data?.typeReferenceDirectives;
	}
	get types() {
		return this._data?.types;
	}
	get value() {
		return this._data?.value;
	}
	get variableDeclaration() {
		return this._data?.variableDeclaration;
	}
	get whenFalse() {
		return this._data?.whenFalse;
	}
	get whenTrue() {
		return this._data?.whenTrue;
	}
	forEachChild(visitor, visitArray) {
		const fn = forEachChildTable[this.kind];
		return fn ? fn(this._data, visitor, visitArray) : void 0;
	}
	getSourceFile() {
		let node = this;
		while (node.parent) node = node.parent;
		return node;
	}
	getStart(sourceFile, includeJsDocComment) {
		return getTokenPosOfNode(this, sourceFile ?? this.getSourceFile(), includeJsDocComment);
	}
	getFullStart() {
		return this.pos;
	}
	getEnd() {
		return this.end;
	}
	getWidth(sourceFile) {
		return this.getEnd() - this.getStart(sourceFile);
	}
	getFullWidth() {
		return this.end - this.pos;
	}
	getLeadingTriviaWidth(sourceFile) {
		return this.getStart(sourceFile) - this.pos;
	}
	getFullText(sourceFile) {
		return (sourceFile ?? this.getSourceFile()).text.substring(this.pos, this.end);
	}
	getText(sourceFile) {
		sourceFile ??= this.getSourceFile();
		return sourceFile.text.substring(this.getStart(sourceFile), this.end);
	}
};
const forEachChildTable = {
	[SyntaxKind.QualifiedName]: (data, cbNode, cbNodes) => visitNode(cbNode, data.left) || visitNode(cbNode, data.right),
	[SyntaxKind.ComputedPropertyName]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.Decorator]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.IfStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.thenStatement) || visitNode(cbNode, data.elseStatement),
	[SyntaxKind.DoStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.statement) || visitNode(cbNode, data.expression),
	[SyntaxKind.WhileStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.statement),
	[SyntaxKind.ForStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.initializer) || visitNode(cbNode, data.condition) || visitNode(cbNode, data.incrementor) || visitNode(cbNode, data.statement),
	[SyntaxKind.BreakStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.label),
	[SyntaxKind.ContinueStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.label),
	[SyntaxKind.ReturnStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.WithStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.statement),
	[SyntaxKind.SwitchStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.caseBlock),
	[SyntaxKind.CaseBlock]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.clauses),
	[SyntaxKind.ThrowStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.TryStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tryBlock) || visitNode(cbNode, data.catchClause) || visitNode(cbNode, data.finallyBlock),
	[SyntaxKind.CatchClause]: (data, cbNode, cbNodes) => visitNode(cbNode, data.variableDeclaration) || visitNode(cbNode, data.block),
	[SyntaxKind.LabeledStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.label) || visitNode(cbNode, data.statement),
	[SyntaxKind.ExpressionStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.Block]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.statements),
	[SyntaxKind.VariableStatement]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.declarationList),
	[SyntaxKind.VariableDeclaration]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name) || visitNode(cbNode, data.exclamationToken) || visitNode(cbNode, data.type) || visitNode(cbNode, data.initializer),
	[SyntaxKind.VariableDeclarationList]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.declarations),
	[SyntaxKind.Parameter]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.dotDotDotToken) || visitNode(cbNode, data.name) || visitNode(cbNode, data.questionToken) || visitNode(cbNode, data.type) || visitNode(cbNode, data.initializer),
	[SyntaxKind.BindingElement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.dotDotDotToken) || visitNode(cbNode, data.propertyName) || visitNode(cbNode, data.name) || visitNode(cbNode, data.initializer),
	[SyntaxKind.MissingDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers),
	[SyntaxKind.FunctionDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.asteriskToken) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type) || visitNode(cbNode, data.body),
	[SyntaxKind.ClassDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.heritageClauses) || visitNodes(cbNode, cbNodes, data.members),
	[SyntaxKind.ClassExpression]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.heritageClauses) || visitNodes(cbNode, cbNodes, data.members),
	[SyntaxKind.HeritageClause]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.types),
	[SyntaxKind.InterfaceDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.heritageClauses) || visitNodes(cbNode, cbNodes, data.members),
	[SyntaxKind.TypeAliasDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNode(cbNode, data.type),
	[SyntaxKind.JSTypeAliasDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNode(cbNode, data.type),
	[SyntaxKind.EnumMember]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name) || visitNode(cbNode, data.initializer),
	[SyntaxKind.EnumDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.members),
	[SyntaxKind.ModuleBlock]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.statements),
	[SyntaxKind.ImportDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.importClause) || visitNode(cbNode, data.moduleSpecifier) || visitNode(cbNode, data.attributes),
	[SyntaxKind.JSImportDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.importClause) || visitNode(cbNode, data.moduleSpecifier) || visitNode(cbNode, data.attributes),
	[SyntaxKind.ExternalModuleReference]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.NamespaceImport]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name),
	[SyntaxKind.NamedImports]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.elements),
	[SyntaxKind.ExportAssignment]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.type) || visitNode(cbNode, data.expression),
	[SyntaxKind.NamespaceExportDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name),
	[SyntaxKind.NamespaceExport]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name),
	[SyntaxKind.NamedExports]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.elements),
	[SyntaxKind.ExportSpecifier]: (data, cbNode, cbNodes) => visitNode(cbNode, data.propertyName) || visitNode(cbNode, data.name),
	[SyntaxKind.CallSignature]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type),
	[SyntaxKind.ConstructSignature]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type),
	[SyntaxKind.Constructor]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type) || visitNode(cbNode, data.body),
	[SyntaxKind.GetAccessor]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type) || visitNode(cbNode, data.body),
	[SyntaxKind.SetAccessor]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type) || visitNode(cbNode, data.body),
	[SyntaxKind.IndexSignature]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type),
	[SyntaxKind.MethodSignature]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNode(cbNode, data.postfixToken) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type),
	[SyntaxKind.MethodDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.asteriskToken) || visitNode(cbNode, data.name) || visitNode(cbNode, data.postfixToken) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type) || visitNode(cbNode, data.body),
	[SyntaxKind.PropertySignature]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNode(cbNode, data.postfixToken) || visitNode(cbNode, data.type) || visitNode(cbNode, data.initializer),
	[SyntaxKind.PropertyDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNode(cbNode, data.postfixToken) || visitNode(cbNode, data.type) || visitNode(cbNode, data.initializer),
	[SyntaxKind.ClassStaticBlockDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.body),
	[SyntaxKind.BinaryExpression]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.left) || visitNode(cbNode, data.type) || visitNode(cbNode, data.operatorToken) || visitNode(cbNode, data.right),
	[SyntaxKind.PrefixUnaryExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.operand),
	[SyntaxKind.PostfixUnaryExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.operand),
	[SyntaxKind.YieldExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.asteriskToken) || visitNode(cbNode, data.expression),
	[SyntaxKind.ArrowFunction]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type) || visitNode(cbNode, data.equalsGreaterThanToken) || visitNode(cbNode, data.body),
	[SyntaxKind.FunctionExpression]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.asteriskToken) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type) || visitNode(cbNode, data.body),
	[SyntaxKind.AsExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.type),
	[SyntaxKind.SatisfiesExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.type),
	[SyntaxKind.ConditionalExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.condition) || visitNode(cbNode, data.questionToken) || visitNode(cbNode, data.whenTrue) || visitNode(cbNode, data.colonToken) || visitNode(cbNode, data.whenFalse),
	[SyntaxKind.PropertyAccessExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.questionDotToken) || visitNode(cbNode, data.name),
	[SyntaxKind.ElementAccessExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.questionDotToken) || visitNode(cbNode, data.argumentExpression),
	[SyntaxKind.CallExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.questionDotToken) || visitNodes(cbNode, cbNodes, data.typeArguments) || visitNodes(cbNode, cbNodes, data.arguments),
	[SyntaxKind.NewExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNodes(cbNode, cbNodes, data.typeArguments) || visitNodes(cbNode, cbNodes, data.arguments),
	[SyntaxKind.MetaProperty]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name),
	[SyntaxKind.NonNullExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.SpreadElement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.TemplateExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.head) || visitNodes(cbNode, cbNodes, data.templateSpans),
	[SyntaxKind.TemplateSpan]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.literal),
	[SyntaxKind.TaggedTemplateExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tag) || visitNode(cbNode, data.questionDotToken) || visitNodes(cbNode, cbNodes, data.typeArguments) || visitNode(cbNode, data.template),
	[SyntaxKind.ParenthesizedExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.ArrayLiteralExpression]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.elements),
	[SyntaxKind.ObjectLiteralExpression]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.properties),
	[SyntaxKind.SpreadAssignment]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.PropertyAssignment]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNode(cbNode, data.postfixToken) || visitNode(cbNode, data.type) || visitNode(cbNode, data.initializer),
	[SyntaxKind.ShorthandPropertyAssignment]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNode(cbNode, data.postfixToken) || visitNode(cbNode, data.type) || visitNode(cbNode, data.equalsToken) || visitNode(cbNode, data.objectAssignmentInitializer),
	[SyntaxKind.DeleteExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.TypeOfExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.VoidExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.AwaitExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.TypeAssertionExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type) || visitNode(cbNode, data.expression),
	[SyntaxKind.UnionType]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.types),
	[SyntaxKind.IntersectionType]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.types),
	[SyntaxKind.ConditionalType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.checkType) || visitNode(cbNode, data.extendsType) || visitNode(cbNode, data.trueType) || visitNode(cbNode, data.falseType),
	[SyntaxKind.TypeOperator]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.InferType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.typeParameter),
	[SyntaxKind.ArrayType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.elementType),
	[SyntaxKind.IndexedAccessType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.objectType) || visitNode(cbNode, data.indexType),
	[SyntaxKind.TypeReference]: (data, cbNode, cbNodes) => visitNode(cbNode, data.typeName) || visitNodes(cbNode, cbNodes, data.typeArguments),
	[SyntaxKind.ExpressionWithTypeArguments]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNodes(cbNode, cbNodes, data.typeArguments),
	[SyntaxKind.LiteralType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.literal),
	[SyntaxKind.TypePredicate]: (data, cbNode, cbNodes) => visitNode(cbNode, data.assertsModifier) || visitNode(cbNode, data.parameterName) || visitNode(cbNode, data.type),
	[SyntaxKind.ImportAttribute]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name) || visitNode(cbNode, data.value),
	[SyntaxKind.ImportAttributes]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.attributes),
	[SyntaxKind.TypeQuery]: (data, cbNode, cbNodes) => visitNode(cbNode, data.exprName) || visitNodes(cbNode, cbNodes, data.typeArguments),
	[SyntaxKind.MappedType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.readonlyToken) || visitNode(cbNode, data.typeParameter) || visitNode(cbNode, data.nameType) || visitNode(cbNode, data.questionToken) || visitNode(cbNode, data.type) || visitNodes(cbNode, cbNodes, data.members),
	[SyntaxKind.TypeLiteral]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.members),
	[SyntaxKind.TupleType]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.elements),
	[SyntaxKind.NamedTupleMember]: (data, cbNode, cbNodes) => visitNode(cbNode, data.dotDotDotToken) || visitNode(cbNode, data.name) || visitNode(cbNode, data.questionToken) || visitNode(cbNode, data.type),
	[SyntaxKind.OptionalType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.RestType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.ParenthesizedType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.FunctionType]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type),
	[SyntaxKind.ConstructorType]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type),
	[SyntaxKind.TemplateLiteralType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.head) || visitNodes(cbNode, cbNodes, data.templateSpans),
	[SyntaxKind.TemplateLiteralTypeSpan]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type) || visitNode(cbNode, data.literal),
	[SyntaxKind.SyntheticExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tupleNameSource),
	[SyntaxKind.PartiallyEmittedExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.JsxElement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.openingElement) || visitNodes(cbNode, cbNodes, data.children) || visitNode(cbNode, data.closingElement),
	[SyntaxKind.JsxAttributes]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.properties),
	[SyntaxKind.JsxNamespacedName]: (data, cbNode, cbNodes) => visitNode(cbNode, data.namespace) || visitNode(cbNode, data.name),
	[SyntaxKind.JsxOpeningElement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.typeArguments) || visitNode(cbNode, data.attributes),
	[SyntaxKind.JsxSelfClosingElement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.typeArguments) || visitNode(cbNode, data.attributes),
	[SyntaxKind.JsxFragment]: (data, cbNode, cbNodes) => visitNode(cbNode, data.openingFragment) || visitNodes(cbNode, cbNodes, data.children) || visitNode(cbNode, data.closingFragment),
	[SyntaxKind.JsxAttribute]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name) || visitNode(cbNode, data.initializer),
	[SyntaxKind.JsxSpreadAttribute]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression),
	[SyntaxKind.JsxClosingElement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName),
	[SyntaxKind.JsxExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.dotDotDotToken) || visitNode(cbNode, data.expression),
	[SyntaxKind.SyntaxList]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.children),
	[SyntaxKind.JSDoc]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.comment) || visitNodes(cbNode, cbNodes, data.tags),
	[SyntaxKind.JSDocTypeExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.JSDocNonNullableType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.JSDocNullableType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.JSDocVariadicType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.JSDocOptionalType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.type),
	[SyntaxKind.JSDocTypeTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.typeExpression) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocUnknownTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocTemplateTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.constraint) || visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocReturnTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.typeExpression) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocPublicTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocPrivateTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocProtectedTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocReadonlyTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocOverrideTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocDeprecatedTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocSeeTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.nameExpression) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocImplementsTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.className) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocAugmentsTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.className) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocSatisfiesTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.typeExpression) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocThrowsTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.typeExpression) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocThisTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.typeExpression) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocImportTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.importClause) || visitNode(cbNode, data.moduleSpecifier) || visitNode(cbNode, data.attributes) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocCallbackTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.typeExpression) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocOverloadTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.typeExpression) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocTypedefTag]: (data, cbNode, cbNodes) => visitNode(cbNode, data.tagName) || visitNode(cbNode, data.typeExpression) || visitNode(cbNode, data.name) || visitNodes(cbNode, cbNodes, data.comment),
	[SyntaxKind.JSDocSignature]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.typeParameters) || visitNodes(cbNode, cbNodes, data.parameters) || visitNode(cbNode, data.type),
	[SyntaxKind.JSDocNameReference]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name),
	[SyntaxKind.ModuleDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNode(cbNode, data.body),
	[SyntaxKind.ImportEqualsDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNode(cbNode, data.moduleReference),
	[SyntaxKind.ExportDeclaration]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.exportClause) || visitNode(cbNode, data.moduleSpecifier) || visitNode(cbNode, data.attributes),
	[SyntaxKind.ImportType]: (data, cbNode, cbNodes) => visitNode(cbNode, data.argument) || visitNode(cbNode, data.attributes) || visitNode(cbNode, data.qualifier) || visitNodes(cbNode, cbNodes, data.typeArguments),
	[SyntaxKind.ImportClause]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name) || visitNode(cbNode, data.namedBindings),
	[SyntaxKind.ImportSpecifier]: (data, cbNode, cbNodes) => visitNode(cbNode, data.propertyName) || visitNode(cbNode, data.name),
	[SyntaxKind.JSDocLink]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name),
	[SyntaxKind.JSDocLinkPlain]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name),
	[SyntaxKind.JSDocLinkCode]: (data, cbNode, cbNodes) => visitNode(cbNode, data.name),
	[SyntaxKind.TypeParameter]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.modifiers) || visitNode(cbNode, data.name) || visitNode(cbNode, data.constraint) || visitNode(cbNode, data.expression) || visitNode(cbNode, data.defaultType),
	[SyntaxKind.SyntheticReferenceExpression]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNode(cbNode, data.thisArg),
	[SyntaxKind.JSDocTypeLiteral]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.jsdocPropertyTags),
	[SyntaxKind.ForInStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.awaitModifier) || visitNode(cbNode, data.initializer) || visitNode(cbNode, data.expression) || visitNode(cbNode, data.statement),
	[SyntaxKind.ForOfStatement]: (data, cbNode, cbNodes) => visitNode(cbNode, data.awaitModifier) || visitNode(cbNode, data.initializer) || visitNode(cbNode, data.expression) || visitNode(cbNode, data.statement),
	[SyntaxKind.CaseClause]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNodes(cbNode, cbNodes, data.statements),
	[SyntaxKind.DefaultClause]: (data, cbNode, cbNodes) => visitNode(cbNode, data.expression) || visitNodes(cbNode, cbNodes, data.statements),
	[SyntaxKind.ObjectBindingPattern]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.elements),
	[SyntaxKind.ArrayBindingPattern]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.elements),
	[SyntaxKind.JSDocParameterTag]: forEachChildOfJSDocParameterOrPropertyTag,
	[SyntaxKind.JSDocPropertyTag]: forEachChildOfJSDocParameterOrPropertyTag,
	[SyntaxKind.SourceFile]: (data, cbNode, cbNodes) => visitNodes(cbNode, cbNodes, data.statements) || visitNode(cbNode, data.endOfFileToken)
};
function visitNode(cbNode, node) {
	return node ? cbNode(node) : void 0;
}
function visitNodes(cbNode, cbNodes, nodes) {
	if (!nodes) return void 0;
	if (cbNodes) return cbNodes(nodes);
	for (const node of nodes) {
		const result = cbNode(node);
		if (result) return result;
	}
}
function createToken(kind) {
	return new NodeObject(kind, void 0);
}
//#endregion
//#region ../../node_modules/typescript/dist/ast/scanner.js
const EscapeSequenceScanningFlags = {
	String: 1,
	ReportErrors: 2,
	RegularExpression: 4,
	AnnexB: 8,
	AnyUnicodeMode: 16,
	AtomEscape: 32,
	ReportInvalidEscapeErrors: 6,
	AllowExtendedUnicodeEscape: 17
};
function tokenIsIdentifierOrKeyword(token) {
	return token >= SyntaxKind.Identifier;
}
const textToKeywordObj = {
	abstract: SyntaxKind.AbstractKeyword,
	accessor: SyntaxKind.AccessorKeyword,
	any: SyntaxKind.AnyKeyword,
	as: SyntaxKind.AsKeyword,
	asserts: SyntaxKind.AssertsKeyword,
	assert: SyntaxKind.AssertKeyword,
	bigint: SyntaxKind.BigIntKeyword,
	boolean: SyntaxKind.BooleanKeyword,
	break: SyntaxKind.BreakKeyword,
	case: SyntaxKind.CaseKeyword,
	catch: SyntaxKind.CatchKeyword,
	class: SyntaxKind.ClassKeyword,
	continue: SyntaxKind.ContinueKeyword,
	const: SyntaxKind.ConstKeyword,
	["constructor"]: SyntaxKind.ConstructorKeyword,
	debugger: SyntaxKind.DebuggerKeyword,
	declare: SyntaxKind.DeclareKeyword,
	default: SyntaxKind.DefaultKeyword,
	defer: SyntaxKind.DeferKeyword,
	delete: SyntaxKind.DeleteKeyword,
	do: SyntaxKind.DoKeyword,
	else: SyntaxKind.ElseKeyword,
	enum: SyntaxKind.EnumKeyword,
	export: SyntaxKind.ExportKeyword,
	extends: SyntaxKind.ExtendsKeyword,
	false: SyntaxKind.FalseKeyword,
	finally: SyntaxKind.FinallyKeyword,
	for: SyntaxKind.ForKeyword,
	from: SyntaxKind.FromKeyword,
	function: SyntaxKind.FunctionKeyword,
	get: SyntaxKind.GetKeyword,
	if: SyntaxKind.IfKeyword,
	implements: SyntaxKind.ImplementsKeyword,
	import: SyntaxKind.ImportKeyword,
	in: SyntaxKind.InKeyword,
	infer: SyntaxKind.InferKeyword,
	instanceof: SyntaxKind.InstanceOfKeyword,
	interface: SyntaxKind.InterfaceKeyword,
	intrinsic: SyntaxKind.IntrinsicKeyword,
	is: SyntaxKind.IsKeyword,
	keyof: SyntaxKind.KeyOfKeyword,
	let: SyntaxKind.LetKeyword,
	module: SyntaxKind.ModuleKeyword,
	namespace: SyntaxKind.NamespaceKeyword,
	never: SyntaxKind.NeverKeyword,
	new: SyntaxKind.NewKeyword,
	null: SyntaxKind.NullKeyword,
	number: SyntaxKind.NumberKeyword,
	object: SyntaxKind.ObjectKeyword,
	package: SyntaxKind.PackageKeyword,
	private: SyntaxKind.PrivateKeyword,
	protected: SyntaxKind.ProtectedKeyword,
	public: SyntaxKind.PublicKeyword,
	override: SyntaxKind.OverrideKeyword,
	out: SyntaxKind.OutKeyword,
	readonly: SyntaxKind.ReadonlyKeyword,
	require: SyntaxKind.RequireKeyword,
	global: SyntaxKind.GlobalKeyword,
	return: SyntaxKind.ReturnKeyword,
	satisfies: SyntaxKind.SatisfiesKeyword,
	set: SyntaxKind.SetKeyword,
	static: SyntaxKind.StaticKeyword,
	string: SyntaxKind.StringKeyword,
	super: SyntaxKind.SuperKeyword,
	switch: SyntaxKind.SwitchKeyword,
	symbol: SyntaxKind.SymbolKeyword,
	this: SyntaxKind.ThisKeyword,
	throw: SyntaxKind.ThrowKeyword,
	true: SyntaxKind.TrueKeyword,
	try: SyntaxKind.TryKeyword,
	type: SyntaxKind.TypeKeyword,
	typeof: SyntaxKind.TypeOfKeyword,
	undefined: SyntaxKind.UndefinedKeyword,
	unique: SyntaxKind.UniqueKeyword,
	unknown: SyntaxKind.UnknownKeyword,
	using: SyntaxKind.UsingKeyword,
	var: SyntaxKind.VarKeyword,
	void: SyntaxKind.VoidKeyword,
	while: SyntaxKind.WhileKeyword,
	with: SyntaxKind.WithKeyword,
	yield: SyntaxKind.YieldKeyword,
	async: SyntaxKind.AsyncKeyword,
	await: SyntaxKind.AwaitKeyword,
	of: SyntaxKind.OfKeyword
};
const textToKeyword = new Map(Object.entries(textToKeywordObj));
const textToToken = new Map(Object.entries({
	...textToKeywordObj,
	"{": SyntaxKind.OpenBraceToken,
	"}": SyntaxKind.CloseBraceToken,
	"(": SyntaxKind.OpenParenToken,
	")": SyntaxKind.CloseParenToken,
	"[": SyntaxKind.OpenBracketToken,
	"]": SyntaxKind.CloseBracketToken,
	".": SyntaxKind.DotToken,
	"...": SyntaxKind.DotDotDotToken,
	";": SyntaxKind.SemicolonToken,
	",": SyntaxKind.CommaToken,
	"<": SyntaxKind.LessThanToken,
	">": SyntaxKind.GreaterThanToken,
	"<=": SyntaxKind.LessThanEqualsToken,
	">=": SyntaxKind.GreaterThanEqualsToken,
	"==": SyntaxKind.EqualsEqualsToken,
	"!=": SyntaxKind.ExclamationEqualsToken,
	"===": SyntaxKind.EqualsEqualsEqualsToken,
	"!==": SyntaxKind.ExclamationEqualsEqualsToken,
	"=>": SyntaxKind.EqualsGreaterThanToken,
	"+": SyntaxKind.PlusToken,
	"-": SyntaxKind.MinusToken,
	"**": SyntaxKind.AsteriskAsteriskToken,
	"*": SyntaxKind.AsteriskToken,
	"/": SyntaxKind.SlashToken,
	"%": SyntaxKind.PercentToken,
	"++": SyntaxKind.PlusPlusToken,
	"--": SyntaxKind.MinusMinusToken,
	"<<": SyntaxKind.LessThanLessThanToken,
	"</": SyntaxKind.LessThanSlashToken,
	">>": SyntaxKind.GreaterThanGreaterThanToken,
	">>>": SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
	"&": SyntaxKind.AmpersandToken,
	"|": SyntaxKind.BarToken,
	"^": SyntaxKind.CaretToken,
	"!": SyntaxKind.ExclamationToken,
	"~": SyntaxKind.TildeToken,
	"&&": SyntaxKind.AmpersandAmpersandToken,
	"||": SyntaxKind.BarBarToken,
	"?": SyntaxKind.QuestionToken,
	"??": SyntaxKind.QuestionQuestionToken,
	"?.": SyntaxKind.QuestionDotToken,
	":": SyntaxKind.ColonToken,
	"=": SyntaxKind.EqualsToken,
	"+=": SyntaxKind.PlusEqualsToken,
	"-=": SyntaxKind.MinusEqualsToken,
	"*=": SyntaxKind.AsteriskEqualsToken,
	"**=": SyntaxKind.AsteriskAsteriskEqualsToken,
	"/=": SyntaxKind.SlashEqualsToken,
	"%=": SyntaxKind.PercentEqualsToken,
	"<<=": SyntaxKind.LessThanLessThanEqualsToken,
	">>=": SyntaxKind.GreaterThanGreaterThanEqualsToken,
	">>>=": SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
	"&=": SyntaxKind.AmpersandEqualsToken,
	"|=": SyntaxKind.BarEqualsToken,
	"^=": SyntaxKind.CaretEqualsToken,
	"||=": SyntaxKind.BarBarEqualsToken,
	"&&=": SyntaxKind.AmpersandAmpersandEqualsToken,
	"??=": SyntaxKind.QuestionQuestionEqualsToken,
	"@": SyntaxKind.AtToken,
	"#": SyntaxKind.HashToken,
	"`": SyntaxKind.BacktickToken
}));
const charCodeToRegExpFlag = /* @__PURE__ */ new Map([
	[CharacterCodes.d, RegularExpressionFlags.HasIndices],
	[CharacterCodes.g, RegularExpressionFlags.Global],
	[CharacterCodes.i, RegularExpressionFlags.IgnoreCase],
	[CharacterCodes.m, RegularExpressionFlags.Multiline],
	[CharacterCodes.s, RegularExpressionFlags.DotAll],
	[CharacterCodes.u, RegularExpressionFlags.Unicode],
	[CharacterCodes.v, RegularExpressionFlags.UnicodeSets],
	[CharacterCodes.y, RegularExpressionFlags.Sticky]
]);
/**
* Generated by scripts/regenerate-unicode-identifier-parts.mjs on node v22.1.0 with unicode 15.1
* based on http://www.unicode.org/reports/tr31/ and https://www.ecma-international.org/ecma-262/6.0/#sec-names-and-keywords
* unicodeESNextIdentifierStart corresponds to the ID_Start and Other_ID_Start property, and
* unicodeESNextIdentifierPart corresponds to ID_Continue, Other_ID_Continue, plus ID_Start and Other_ID_Start
*/
const unicodeESNextIdentifierStart = [
	65,
	90,
	97,
	122,
	170,
	170,
	181,
	181,
	186,
	186,
	192,
	214,
	216,
	246,
	248,
	705,
	710,
	721,
	736,
	740,
	748,
	748,
	750,
	750,
	880,
	884,
	886,
	887,
	890,
	893,
	895,
	895,
	902,
	902,
	904,
	906,
	908,
	908,
	910,
	929,
	931,
	1013,
	1015,
	1153,
	1162,
	1327,
	1329,
	1366,
	1369,
	1369,
	1376,
	1416,
	1488,
	1514,
	1519,
	1522,
	1568,
	1610,
	1646,
	1647,
	1649,
	1747,
	1749,
	1749,
	1765,
	1766,
	1774,
	1775,
	1786,
	1788,
	1791,
	1791,
	1808,
	1808,
	1810,
	1839,
	1869,
	1957,
	1969,
	1969,
	1994,
	2026,
	2036,
	2037,
	2042,
	2042,
	2048,
	2069,
	2074,
	2074,
	2084,
	2084,
	2088,
	2088,
	2112,
	2136,
	2144,
	2154,
	2160,
	2183,
	2185,
	2190,
	2208,
	2249,
	2308,
	2361,
	2365,
	2365,
	2384,
	2384,
	2392,
	2401,
	2417,
	2432,
	2437,
	2444,
	2447,
	2448,
	2451,
	2472,
	2474,
	2480,
	2482,
	2482,
	2486,
	2489,
	2493,
	2493,
	2510,
	2510,
	2524,
	2525,
	2527,
	2529,
	2544,
	2545,
	2556,
	2556,
	2565,
	2570,
	2575,
	2576,
	2579,
	2600,
	2602,
	2608,
	2610,
	2611,
	2613,
	2614,
	2616,
	2617,
	2649,
	2652,
	2654,
	2654,
	2674,
	2676,
	2693,
	2701,
	2703,
	2705,
	2707,
	2728,
	2730,
	2736,
	2738,
	2739,
	2741,
	2745,
	2749,
	2749,
	2768,
	2768,
	2784,
	2785,
	2809,
	2809,
	2821,
	2828,
	2831,
	2832,
	2835,
	2856,
	2858,
	2864,
	2866,
	2867,
	2869,
	2873,
	2877,
	2877,
	2908,
	2909,
	2911,
	2913,
	2929,
	2929,
	2947,
	2947,
	2949,
	2954,
	2958,
	2960,
	2962,
	2965,
	2969,
	2970,
	2972,
	2972,
	2974,
	2975,
	2979,
	2980,
	2984,
	2986,
	2990,
	3001,
	3024,
	3024,
	3077,
	3084,
	3086,
	3088,
	3090,
	3112,
	3114,
	3129,
	3133,
	3133,
	3160,
	3162,
	3165,
	3165,
	3168,
	3169,
	3200,
	3200,
	3205,
	3212,
	3214,
	3216,
	3218,
	3240,
	3242,
	3251,
	3253,
	3257,
	3261,
	3261,
	3293,
	3294,
	3296,
	3297,
	3313,
	3314,
	3332,
	3340,
	3342,
	3344,
	3346,
	3386,
	3389,
	3389,
	3406,
	3406,
	3412,
	3414,
	3423,
	3425,
	3450,
	3455,
	3461,
	3478,
	3482,
	3505,
	3507,
	3515,
	3517,
	3517,
	3520,
	3526,
	3585,
	3632,
	3634,
	3635,
	3648,
	3654,
	3713,
	3714,
	3716,
	3716,
	3718,
	3722,
	3724,
	3747,
	3749,
	3749,
	3751,
	3760,
	3762,
	3763,
	3773,
	3773,
	3776,
	3780,
	3782,
	3782,
	3804,
	3807,
	3840,
	3840,
	3904,
	3911,
	3913,
	3948,
	3976,
	3980,
	4096,
	4138,
	4159,
	4159,
	4176,
	4181,
	4186,
	4189,
	4193,
	4193,
	4197,
	4198,
	4206,
	4208,
	4213,
	4225,
	4238,
	4238,
	4256,
	4293,
	4295,
	4295,
	4301,
	4301,
	4304,
	4346,
	4348,
	4680,
	4682,
	4685,
	4688,
	4694,
	4696,
	4696,
	4698,
	4701,
	4704,
	4744,
	4746,
	4749,
	4752,
	4784,
	4786,
	4789,
	4792,
	4798,
	4800,
	4800,
	4802,
	4805,
	4808,
	4822,
	4824,
	4880,
	4882,
	4885,
	4888,
	4954,
	4992,
	5007,
	5024,
	5109,
	5112,
	5117,
	5121,
	5740,
	5743,
	5759,
	5761,
	5786,
	5792,
	5866,
	5870,
	5880,
	5888,
	5905,
	5919,
	5937,
	5952,
	5969,
	5984,
	5996,
	5998,
	6e3,
	6016,
	6067,
	6103,
	6103,
	6108,
	6108,
	6176,
	6264,
	6272,
	6312,
	6314,
	6314,
	6320,
	6389,
	6400,
	6430,
	6480,
	6509,
	6512,
	6516,
	6528,
	6571,
	6576,
	6601,
	6656,
	6678,
	6688,
	6740,
	6823,
	6823,
	6917,
	6963,
	6981,
	6988,
	7043,
	7072,
	7086,
	7087,
	7098,
	7141,
	7168,
	7203,
	7245,
	7247,
	7258,
	7293,
	7296,
	7304,
	7312,
	7354,
	7357,
	7359,
	7401,
	7404,
	7406,
	7411,
	7413,
	7414,
	7418,
	7418,
	7424,
	7615,
	7680,
	7957,
	7960,
	7965,
	7968,
	8005,
	8008,
	8013,
	8016,
	8023,
	8025,
	8025,
	8027,
	8027,
	8029,
	8029,
	8031,
	8061,
	8064,
	8116,
	8118,
	8124,
	8126,
	8126,
	8130,
	8132,
	8134,
	8140,
	8144,
	8147,
	8150,
	8155,
	8160,
	8172,
	8178,
	8180,
	8182,
	8188,
	8305,
	8305,
	8319,
	8319,
	8336,
	8348,
	8450,
	8450,
	8455,
	8455,
	8458,
	8467,
	8469,
	8469,
	8472,
	8477,
	8484,
	8484,
	8486,
	8486,
	8488,
	8488,
	8490,
	8505,
	8508,
	8511,
	8517,
	8521,
	8526,
	8526,
	8544,
	8584,
	11264,
	11492,
	11499,
	11502,
	11506,
	11507,
	11520,
	11557,
	11559,
	11559,
	11565,
	11565,
	11568,
	11623,
	11631,
	11631,
	11648,
	11670,
	11680,
	11686,
	11688,
	11694,
	11696,
	11702,
	11704,
	11710,
	11712,
	11718,
	11720,
	11726,
	11728,
	11734,
	11736,
	11742,
	12293,
	12295,
	12321,
	12329,
	12337,
	12341,
	12344,
	12348,
	12353,
	12438,
	12443,
	12447,
	12449,
	12538,
	12540,
	12543,
	12549,
	12591,
	12593,
	12686,
	12704,
	12735,
	12784,
	12799,
	13312,
	19903,
	19968,
	42124,
	42192,
	42237,
	42240,
	42508,
	42512,
	42527,
	42538,
	42539,
	42560,
	42606,
	42623,
	42653,
	42656,
	42735,
	42775,
	42783,
	42786,
	42888,
	42891,
	42954,
	42960,
	42961,
	42963,
	42963,
	42965,
	42969,
	42994,
	43009,
	43011,
	43013,
	43015,
	43018,
	43020,
	43042,
	43072,
	43123,
	43138,
	43187,
	43250,
	43255,
	43259,
	43259,
	43261,
	43262,
	43274,
	43301,
	43312,
	43334,
	43360,
	43388,
	43396,
	43442,
	43471,
	43471,
	43488,
	43492,
	43494,
	43503,
	43514,
	43518,
	43520,
	43560,
	43584,
	43586,
	43588,
	43595,
	43616,
	43638,
	43642,
	43642,
	43646,
	43695,
	43697,
	43697,
	43701,
	43702,
	43705,
	43709,
	43712,
	43712,
	43714,
	43714,
	43739,
	43741,
	43744,
	43754,
	43762,
	43764,
	43777,
	43782,
	43785,
	43790,
	43793,
	43798,
	43808,
	43814,
	43816,
	43822,
	43824,
	43866,
	43868,
	43881,
	43888,
	44002,
	44032,
	55203,
	55216,
	55238,
	55243,
	55291,
	63744,
	64109,
	64112,
	64217,
	64256,
	64262,
	64275,
	64279,
	64285,
	64285,
	64287,
	64296,
	64298,
	64310,
	64312,
	64316,
	64318,
	64318,
	64320,
	64321,
	64323,
	64324,
	64326,
	64433,
	64467,
	64829,
	64848,
	64911,
	64914,
	64967,
	65008,
	65019,
	65136,
	65140,
	65142,
	65276,
	65313,
	65338,
	65345,
	65370,
	65382,
	65470,
	65474,
	65479,
	65482,
	65487,
	65490,
	65495,
	65498,
	65500,
	65536,
	65547,
	65549,
	65574,
	65576,
	65594,
	65596,
	65597,
	65599,
	65613,
	65616,
	65629,
	65664,
	65786,
	65856,
	65908,
	66176,
	66204,
	66208,
	66256,
	66304,
	66335,
	66349,
	66378,
	66384,
	66421,
	66432,
	66461,
	66464,
	66499,
	66504,
	66511,
	66513,
	66517,
	66560,
	66717,
	66736,
	66771,
	66776,
	66811,
	66816,
	66855,
	66864,
	66915,
	66928,
	66938,
	66940,
	66954,
	66956,
	66962,
	66964,
	66965,
	66967,
	66977,
	66979,
	66993,
	66995,
	67001,
	67003,
	67004,
	67072,
	67382,
	67392,
	67413,
	67424,
	67431,
	67456,
	67461,
	67463,
	67504,
	67506,
	67514,
	67584,
	67589,
	67592,
	67592,
	67594,
	67637,
	67639,
	67640,
	67644,
	67644,
	67647,
	67669,
	67680,
	67702,
	67712,
	67742,
	67808,
	67826,
	67828,
	67829,
	67840,
	67861,
	67872,
	67897,
	67968,
	68023,
	68030,
	68031,
	68096,
	68096,
	68112,
	68115,
	68117,
	68119,
	68121,
	68149,
	68192,
	68220,
	68224,
	68252,
	68288,
	68295,
	68297,
	68324,
	68352,
	68405,
	68416,
	68437,
	68448,
	68466,
	68480,
	68497,
	68608,
	68680,
	68736,
	68786,
	68800,
	68850,
	68864,
	68899,
	69248,
	69289,
	69296,
	69297,
	69376,
	69404,
	69415,
	69415,
	69424,
	69445,
	69488,
	69505,
	69552,
	69572,
	69600,
	69622,
	69635,
	69687,
	69745,
	69746,
	69749,
	69749,
	69763,
	69807,
	69840,
	69864,
	69891,
	69926,
	69956,
	69956,
	69959,
	69959,
	69968,
	70002,
	70006,
	70006,
	70019,
	70066,
	70081,
	70084,
	70106,
	70106,
	70108,
	70108,
	70144,
	70161,
	70163,
	70187,
	70207,
	70208,
	70272,
	70278,
	70280,
	70280,
	70282,
	70285,
	70287,
	70301,
	70303,
	70312,
	70320,
	70366,
	70405,
	70412,
	70415,
	70416,
	70419,
	70440,
	70442,
	70448,
	70450,
	70451,
	70453,
	70457,
	70461,
	70461,
	70480,
	70480,
	70493,
	70497,
	70656,
	70708,
	70727,
	70730,
	70751,
	70753,
	70784,
	70831,
	70852,
	70853,
	70855,
	70855,
	71040,
	71086,
	71128,
	71131,
	71168,
	71215,
	71236,
	71236,
	71296,
	71338,
	71352,
	71352,
	71424,
	71450,
	71488,
	71494,
	71680,
	71723,
	71840,
	71903,
	71935,
	71942,
	71945,
	71945,
	71948,
	71955,
	71957,
	71958,
	71960,
	71983,
	71999,
	71999,
	72001,
	72001,
	72096,
	72103,
	72106,
	72144,
	72161,
	72161,
	72163,
	72163,
	72192,
	72192,
	72203,
	72242,
	72250,
	72250,
	72272,
	72272,
	72284,
	72329,
	72349,
	72349,
	72368,
	72440,
	72704,
	72712,
	72714,
	72750,
	72768,
	72768,
	72818,
	72847,
	72960,
	72966,
	72968,
	72969,
	72971,
	73008,
	73030,
	73030,
	73056,
	73061,
	73063,
	73064,
	73066,
	73097,
	73112,
	73112,
	73440,
	73458,
	73474,
	73474,
	73476,
	73488,
	73490,
	73523,
	73648,
	73648,
	73728,
	74649,
	74752,
	74862,
	74880,
	75075,
	77712,
	77808,
	77824,
	78895,
	78913,
	78918,
	82944,
	83526,
	92160,
	92728,
	92736,
	92766,
	92784,
	92862,
	92880,
	92909,
	92928,
	92975,
	92992,
	92995,
	93027,
	93047,
	93053,
	93071,
	93760,
	93823,
	93952,
	94026,
	94032,
	94032,
	94099,
	94111,
	94176,
	94177,
	94179,
	94179,
	94208,
	100343,
	100352,
	101589,
	101632,
	101640,
	110576,
	110579,
	110581,
	110587,
	110589,
	110590,
	110592,
	110882,
	110898,
	110898,
	110928,
	110930,
	110933,
	110933,
	110948,
	110951,
	110960,
	111355,
	113664,
	113770,
	113776,
	113788,
	113792,
	113800,
	113808,
	113817,
	119808,
	119892,
	119894,
	119964,
	119966,
	119967,
	119970,
	119970,
	119973,
	119974,
	119977,
	119980,
	119982,
	119993,
	119995,
	119995,
	119997,
	120003,
	120005,
	120069,
	120071,
	120074,
	120077,
	120084,
	120086,
	120092,
	120094,
	120121,
	120123,
	120126,
	120128,
	120132,
	120134,
	120134,
	120138,
	120144,
	120146,
	120485,
	120488,
	120512,
	120514,
	120538,
	120540,
	120570,
	120572,
	120596,
	120598,
	120628,
	120630,
	120654,
	120656,
	120686,
	120688,
	120712,
	120714,
	120744,
	120746,
	120770,
	120772,
	120779,
	122624,
	122654,
	122661,
	122666,
	122928,
	122989,
	123136,
	123180,
	123191,
	123197,
	123214,
	123214,
	123536,
	123565,
	123584,
	123627,
	124112,
	124139,
	124896,
	124902,
	124904,
	124907,
	124909,
	124910,
	124912,
	124926,
	124928,
	125124,
	125184,
	125251,
	125259,
	125259,
	126464,
	126467,
	126469,
	126495,
	126497,
	126498,
	126500,
	126500,
	126503,
	126503,
	126505,
	126514,
	126516,
	126519,
	126521,
	126521,
	126523,
	126523,
	126530,
	126530,
	126535,
	126535,
	126537,
	126537,
	126539,
	126539,
	126541,
	126543,
	126545,
	126546,
	126548,
	126548,
	126551,
	126551,
	126553,
	126553,
	126555,
	126555,
	126557,
	126557,
	126559,
	126559,
	126561,
	126562,
	126564,
	126564,
	126567,
	126570,
	126572,
	126578,
	126580,
	126583,
	126585,
	126588,
	126590,
	126590,
	126592,
	126601,
	126603,
	126619,
	126625,
	126627,
	126629,
	126633,
	126635,
	126651,
	131072,
	173791,
	173824,
	177977,
	177984,
	178205,
	178208,
	183969,
	183984,
	191456,
	191472,
	192093,
	194560,
	195101,
	196608,
	201546,
	201552,
	205743
];
const unicodeESNextIdentifierPart = [
	48,
	57,
	65,
	90,
	95,
	95,
	97,
	122,
	170,
	170,
	181,
	181,
	183,
	183,
	186,
	186,
	192,
	214,
	216,
	246,
	248,
	705,
	710,
	721,
	736,
	740,
	748,
	748,
	750,
	750,
	768,
	884,
	886,
	887,
	890,
	893,
	895,
	895,
	902,
	906,
	908,
	908,
	910,
	929,
	931,
	1013,
	1015,
	1153,
	1155,
	1159,
	1162,
	1327,
	1329,
	1366,
	1369,
	1369,
	1376,
	1416,
	1425,
	1469,
	1471,
	1471,
	1473,
	1474,
	1476,
	1477,
	1479,
	1479,
	1488,
	1514,
	1519,
	1522,
	1552,
	1562,
	1568,
	1641,
	1646,
	1747,
	1749,
	1756,
	1759,
	1768,
	1770,
	1788,
	1791,
	1791,
	1808,
	1866,
	1869,
	1969,
	1984,
	2037,
	2042,
	2042,
	2045,
	2045,
	2048,
	2093,
	2112,
	2139,
	2144,
	2154,
	2160,
	2183,
	2185,
	2190,
	2200,
	2273,
	2275,
	2403,
	2406,
	2415,
	2417,
	2435,
	2437,
	2444,
	2447,
	2448,
	2451,
	2472,
	2474,
	2480,
	2482,
	2482,
	2486,
	2489,
	2492,
	2500,
	2503,
	2504,
	2507,
	2510,
	2519,
	2519,
	2524,
	2525,
	2527,
	2531,
	2534,
	2545,
	2556,
	2556,
	2558,
	2558,
	2561,
	2563,
	2565,
	2570,
	2575,
	2576,
	2579,
	2600,
	2602,
	2608,
	2610,
	2611,
	2613,
	2614,
	2616,
	2617,
	2620,
	2620,
	2622,
	2626,
	2631,
	2632,
	2635,
	2637,
	2641,
	2641,
	2649,
	2652,
	2654,
	2654,
	2662,
	2677,
	2689,
	2691,
	2693,
	2701,
	2703,
	2705,
	2707,
	2728,
	2730,
	2736,
	2738,
	2739,
	2741,
	2745,
	2748,
	2757,
	2759,
	2761,
	2763,
	2765,
	2768,
	2768,
	2784,
	2787,
	2790,
	2799,
	2809,
	2815,
	2817,
	2819,
	2821,
	2828,
	2831,
	2832,
	2835,
	2856,
	2858,
	2864,
	2866,
	2867,
	2869,
	2873,
	2876,
	2884,
	2887,
	2888,
	2891,
	2893,
	2901,
	2903,
	2908,
	2909,
	2911,
	2915,
	2918,
	2927,
	2929,
	2929,
	2946,
	2947,
	2949,
	2954,
	2958,
	2960,
	2962,
	2965,
	2969,
	2970,
	2972,
	2972,
	2974,
	2975,
	2979,
	2980,
	2984,
	2986,
	2990,
	3001,
	3006,
	3010,
	3014,
	3016,
	3018,
	3021,
	3024,
	3024,
	3031,
	3031,
	3046,
	3055,
	3072,
	3084,
	3086,
	3088,
	3090,
	3112,
	3114,
	3129,
	3132,
	3140,
	3142,
	3144,
	3146,
	3149,
	3157,
	3158,
	3160,
	3162,
	3165,
	3165,
	3168,
	3171,
	3174,
	3183,
	3200,
	3203,
	3205,
	3212,
	3214,
	3216,
	3218,
	3240,
	3242,
	3251,
	3253,
	3257,
	3260,
	3268,
	3270,
	3272,
	3274,
	3277,
	3285,
	3286,
	3293,
	3294,
	3296,
	3299,
	3302,
	3311,
	3313,
	3315,
	3328,
	3340,
	3342,
	3344,
	3346,
	3396,
	3398,
	3400,
	3402,
	3406,
	3412,
	3415,
	3423,
	3427,
	3430,
	3439,
	3450,
	3455,
	3457,
	3459,
	3461,
	3478,
	3482,
	3505,
	3507,
	3515,
	3517,
	3517,
	3520,
	3526,
	3530,
	3530,
	3535,
	3540,
	3542,
	3542,
	3544,
	3551,
	3558,
	3567,
	3570,
	3571,
	3585,
	3642,
	3648,
	3662,
	3664,
	3673,
	3713,
	3714,
	3716,
	3716,
	3718,
	3722,
	3724,
	3747,
	3749,
	3749,
	3751,
	3773,
	3776,
	3780,
	3782,
	3782,
	3784,
	3790,
	3792,
	3801,
	3804,
	3807,
	3840,
	3840,
	3864,
	3865,
	3872,
	3881,
	3893,
	3893,
	3895,
	3895,
	3897,
	3897,
	3902,
	3911,
	3913,
	3948,
	3953,
	3972,
	3974,
	3991,
	3993,
	4028,
	4038,
	4038,
	4096,
	4169,
	4176,
	4253,
	4256,
	4293,
	4295,
	4295,
	4301,
	4301,
	4304,
	4346,
	4348,
	4680,
	4682,
	4685,
	4688,
	4694,
	4696,
	4696,
	4698,
	4701,
	4704,
	4744,
	4746,
	4749,
	4752,
	4784,
	4786,
	4789,
	4792,
	4798,
	4800,
	4800,
	4802,
	4805,
	4808,
	4822,
	4824,
	4880,
	4882,
	4885,
	4888,
	4954,
	4957,
	4959,
	4969,
	4977,
	4992,
	5007,
	5024,
	5109,
	5112,
	5117,
	5121,
	5740,
	5743,
	5759,
	5761,
	5786,
	5792,
	5866,
	5870,
	5880,
	5888,
	5909,
	5919,
	5940,
	5952,
	5971,
	5984,
	5996,
	5998,
	6e3,
	6002,
	6003,
	6016,
	6099,
	6103,
	6103,
	6108,
	6109,
	6112,
	6121,
	6155,
	6157,
	6159,
	6169,
	6176,
	6264,
	6272,
	6314,
	6320,
	6389,
	6400,
	6430,
	6432,
	6443,
	6448,
	6459,
	6470,
	6509,
	6512,
	6516,
	6528,
	6571,
	6576,
	6601,
	6608,
	6618,
	6656,
	6683,
	6688,
	6750,
	6752,
	6780,
	6783,
	6793,
	6800,
	6809,
	6823,
	6823,
	6832,
	6845,
	6847,
	6862,
	6912,
	6988,
	6992,
	7001,
	7019,
	7027,
	7040,
	7155,
	7168,
	7223,
	7232,
	7241,
	7245,
	7293,
	7296,
	7304,
	7312,
	7354,
	7357,
	7359,
	7376,
	7378,
	7380,
	7418,
	7424,
	7957,
	7960,
	7965,
	7968,
	8005,
	8008,
	8013,
	8016,
	8023,
	8025,
	8025,
	8027,
	8027,
	8029,
	8029,
	8031,
	8061,
	8064,
	8116,
	8118,
	8124,
	8126,
	8126,
	8130,
	8132,
	8134,
	8140,
	8144,
	8147,
	8150,
	8155,
	8160,
	8172,
	8178,
	8180,
	8182,
	8188,
	8204,
	8205,
	8255,
	8256,
	8276,
	8276,
	8305,
	8305,
	8319,
	8319,
	8336,
	8348,
	8400,
	8412,
	8417,
	8417,
	8421,
	8432,
	8450,
	8450,
	8455,
	8455,
	8458,
	8467,
	8469,
	8469,
	8472,
	8477,
	8484,
	8484,
	8486,
	8486,
	8488,
	8488,
	8490,
	8505,
	8508,
	8511,
	8517,
	8521,
	8526,
	8526,
	8544,
	8584,
	11264,
	11492,
	11499,
	11507,
	11520,
	11557,
	11559,
	11559,
	11565,
	11565,
	11568,
	11623,
	11631,
	11631,
	11647,
	11670,
	11680,
	11686,
	11688,
	11694,
	11696,
	11702,
	11704,
	11710,
	11712,
	11718,
	11720,
	11726,
	11728,
	11734,
	11736,
	11742,
	11744,
	11775,
	12293,
	12295,
	12321,
	12335,
	12337,
	12341,
	12344,
	12348,
	12353,
	12438,
	12441,
	12447,
	12449,
	12543,
	12549,
	12591,
	12593,
	12686,
	12704,
	12735,
	12784,
	12799,
	13312,
	19903,
	19968,
	42124,
	42192,
	42237,
	42240,
	42508,
	42512,
	42539,
	42560,
	42607,
	42612,
	42621,
	42623,
	42737,
	42775,
	42783,
	42786,
	42888,
	42891,
	42954,
	42960,
	42961,
	42963,
	42963,
	42965,
	42969,
	42994,
	43047,
	43052,
	43052,
	43072,
	43123,
	43136,
	43205,
	43216,
	43225,
	43232,
	43255,
	43259,
	43259,
	43261,
	43309,
	43312,
	43347,
	43360,
	43388,
	43392,
	43456,
	43471,
	43481,
	43488,
	43518,
	43520,
	43574,
	43584,
	43597,
	43600,
	43609,
	43616,
	43638,
	43642,
	43714,
	43739,
	43741,
	43744,
	43759,
	43762,
	43766,
	43777,
	43782,
	43785,
	43790,
	43793,
	43798,
	43808,
	43814,
	43816,
	43822,
	43824,
	43866,
	43868,
	43881,
	43888,
	44010,
	44012,
	44013,
	44016,
	44025,
	44032,
	55203,
	55216,
	55238,
	55243,
	55291,
	63744,
	64109,
	64112,
	64217,
	64256,
	64262,
	64275,
	64279,
	64285,
	64296,
	64298,
	64310,
	64312,
	64316,
	64318,
	64318,
	64320,
	64321,
	64323,
	64324,
	64326,
	64433,
	64467,
	64829,
	64848,
	64911,
	64914,
	64967,
	65008,
	65019,
	65024,
	65039,
	65056,
	65071,
	65075,
	65076,
	65101,
	65103,
	65136,
	65140,
	65142,
	65276,
	65296,
	65305,
	65313,
	65338,
	65343,
	65343,
	65345,
	65370,
	65381,
	65470,
	65474,
	65479,
	65482,
	65487,
	65490,
	65495,
	65498,
	65500,
	65536,
	65547,
	65549,
	65574,
	65576,
	65594,
	65596,
	65597,
	65599,
	65613,
	65616,
	65629,
	65664,
	65786,
	65856,
	65908,
	66045,
	66045,
	66176,
	66204,
	66208,
	66256,
	66272,
	66272,
	66304,
	66335,
	66349,
	66378,
	66384,
	66426,
	66432,
	66461,
	66464,
	66499,
	66504,
	66511,
	66513,
	66517,
	66560,
	66717,
	66720,
	66729,
	66736,
	66771,
	66776,
	66811,
	66816,
	66855,
	66864,
	66915,
	66928,
	66938,
	66940,
	66954,
	66956,
	66962,
	66964,
	66965,
	66967,
	66977,
	66979,
	66993,
	66995,
	67001,
	67003,
	67004,
	67072,
	67382,
	67392,
	67413,
	67424,
	67431,
	67456,
	67461,
	67463,
	67504,
	67506,
	67514,
	67584,
	67589,
	67592,
	67592,
	67594,
	67637,
	67639,
	67640,
	67644,
	67644,
	67647,
	67669,
	67680,
	67702,
	67712,
	67742,
	67808,
	67826,
	67828,
	67829,
	67840,
	67861,
	67872,
	67897,
	67968,
	68023,
	68030,
	68031,
	68096,
	68099,
	68101,
	68102,
	68108,
	68115,
	68117,
	68119,
	68121,
	68149,
	68152,
	68154,
	68159,
	68159,
	68192,
	68220,
	68224,
	68252,
	68288,
	68295,
	68297,
	68326,
	68352,
	68405,
	68416,
	68437,
	68448,
	68466,
	68480,
	68497,
	68608,
	68680,
	68736,
	68786,
	68800,
	68850,
	68864,
	68903,
	68912,
	68921,
	69248,
	69289,
	69291,
	69292,
	69296,
	69297,
	69373,
	69404,
	69415,
	69415,
	69424,
	69456,
	69488,
	69509,
	69552,
	69572,
	69600,
	69622,
	69632,
	69702,
	69734,
	69749,
	69759,
	69818,
	69826,
	69826,
	69840,
	69864,
	69872,
	69881,
	69888,
	69940,
	69942,
	69951,
	69956,
	69959,
	69968,
	70003,
	70006,
	70006,
	70016,
	70084,
	70089,
	70092,
	70094,
	70106,
	70108,
	70108,
	70144,
	70161,
	70163,
	70199,
	70206,
	70209,
	70272,
	70278,
	70280,
	70280,
	70282,
	70285,
	70287,
	70301,
	70303,
	70312,
	70320,
	70378,
	70384,
	70393,
	70400,
	70403,
	70405,
	70412,
	70415,
	70416,
	70419,
	70440,
	70442,
	70448,
	70450,
	70451,
	70453,
	70457,
	70459,
	70468,
	70471,
	70472,
	70475,
	70477,
	70480,
	70480,
	70487,
	70487,
	70493,
	70499,
	70502,
	70508,
	70512,
	70516,
	70656,
	70730,
	70736,
	70745,
	70750,
	70753,
	70784,
	70853,
	70855,
	70855,
	70864,
	70873,
	71040,
	71093,
	71096,
	71104,
	71128,
	71133,
	71168,
	71232,
	71236,
	71236,
	71248,
	71257,
	71296,
	71352,
	71360,
	71369,
	71424,
	71450,
	71453,
	71467,
	71472,
	71481,
	71488,
	71494,
	71680,
	71738,
	71840,
	71913,
	71935,
	71942,
	71945,
	71945,
	71948,
	71955,
	71957,
	71958,
	71960,
	71989,
	71991,
	71992,
	71995,
	72003,
	72016,
	72025,
	72096,
	72103,
	72106,
	72151,
	72154,
	72161,
	72163,
	72164,
	72192,
	72254,
	72263,
	72263,
	72272,
	72345,
	72349,
	72349,
	72368,
	72440,
	72704,
	72712,
	72714,
	72758,
	72760,
	72768,
	72784,
	72793,
	72818,
	72847,
	72850,
	72871,
	72873,
	72886,
	72960,
	72966,
	72968,
	72969,
	72971,
	73014,
	73018,
	73018,
	73020,
	73021,
	73023,
	73031,
	73040,
	73049,
	73056,
	73061,
	73063,
	73064,
	73066,
	73102,
	73104,
	73105,
	73107,
	73112,
	73120,
	73129,
	73440,
	73462,
	73472,
	73488,
	73490,
	73530,
	73534,
	73538,
	73552,
	73561,
	73648,
	73648,
	73728,
	74649,
	74752,
	74862,
	74880,
	75075,
	77712,
	77808,
	77824,
	78895,
	78912,
	78933,
	82944,
	83526,
	92160,
	92728,
	92736,
	92766,
	92768,
	92777,
	92784,
	92862,
	92864,
	92873,
	92880,
	92909,
	92912,
	92916,
	92928,
	92982,
	92992,
	92995,
	93008,
	93017,
	93027,
	93047,
	93053,
	93071,
	93760,
	93823,
	93952,
	94026,
	94031,
	94087,
	94095,
	94111,
	94176,
	94177,
	94179,
	94180,
	94192,
	94193,
	94208,
	100343,
	100352,
	101589,
	101632,
	101640,
	110576,
	110579,
	110581,
	110587,
	110589,
	110590,
	110592,
	110882,
	110898,
	110898,
	110928,
	110930,
	110933,
	110933,
	110948,
	110951,
	110960,
	111355,
	113664,
	113770,
	113776,
	113788,
	113792,
	113800,
	113808,
	113817,
	113821,
	113822,
	118528,
	118573,
	118576,
	118598,
	119141,
	119145,
	119149,
	119154,
	119163,
	119170,
	119173,
	119179,
	119210,
	119213,
	119362,
	119364,
	119808,
	119892,
	119894,
	119964,
	119966,
	119967,
	119970,
	119970,
	119973,
	119974,
	119977,
	119980,
	119982,
	119993,
	119995,
	119995,
	119997,
	120003,
	120005,
	120069,
	120071,
	120074,
	120077,
	120084,
	120086,
	120092,
	120094,
	120121,
	120123,
	120126,
	120128,
	120132,
	120134,
	120134,
	120138,
	120144,
	120146,
	120485,
	120488,
	120512,
	120514,
	120538,
	120540,
	120570,
	120572,
	120596,
	120598,
	120628,
	120630,
	120654,
	120656,
	120686,
	120688,
	120712,
	120714,
	120744,
	120746,
	120770,
	120772,
	120779,
	120782,
	120831,
	121344,
	121398,
	121403,
	121452,
	121461,
	121461,
	121476,
	121476,
	121499,
	121503,
	121505,
	121519,
	122624,
	122654,
	122661,
	122666,
	122880,
	122886,
	122888,
	122904,
	122907,
	122913,
	122915,
	122916,
	122918,
	122922,
	122928,
	122989,
	123023,
	123023,
	123136,
	123180,
	123184,
	123197,
	123200,
	123209,
	123214,
	123214,
	123536,
	123566,
	123584,
	123641,
	124112,
	124153,
	124896,
	124902,
	124904,
	124907,
	124909,
	124910,
	124912,
	124926,
	124928,
	125124,
	125136,
	125142,
	125184,
	125259,
	125264,
	125273,
	126464,
	126467,
	126469,
	126495,
	126497,
	126498,
	126500,
	126500,
	126503,
	126503,
	126505,
	126514,
	126516,
	126519,
	126521,
	126521,
	126523,
	126523,
	126530,
	126530,
	126535,
	126535,
	126537,
	126537,
	126539,
	126539,
	126541,
	126543,
	126545,
	126546,
	126548,
	126548,
	126551,
	126551,
	126553,
	126553,
	126555,
	126555,
	126557,
	126557,
	126559,
	126559,
	126561,
	126562,
	126564,
	126564,
	126567,
	126570,
	126572,
	126578,
	126580,
	126583,
	126585,
	126588,
	126590,
	126590,
	126592,
	126601,
	126603,
	126619,
	126625,
	126627,
	126629,
	126633,
	126635,
	126651,
	130032,
	130041,
	131072,
	173791,
	173824,
	177977,
	177984,
	178205,
	178208,
	183969,
	183984,
	191456,
	191472,
	192093,
	194560,
	195101,
	196608,
	201546,
	201552,
	205743,
	917760,
	917999
];
const commentDirectiveRegExSingleLine = /^\/\/\/?\s*@(ts-expect-error|ts-ignore)/;
const commentDirectiveRegExMultiLine = /^(?:\/|\*)*\s*@(ts-expect-error|ts-ignore)/;
const jsDocTagTerminators = /* @__PURE__ */ new Set([
	" ",
	"	",
	"\n",
	"\r",
	"}",
	"*"
]);
function hasJSDocTag(text, offset, ...tags) {
	for (const tag of tags) if (text.startsWith(tag, offset)) {
		if (offset + tag.length === text.length) return true;
		if (jsDocTagTerminators.has(text[offset + tag.length])) return true;
	}
	return false;
}
function scanJSDocCommentForTags(text, tokenFlags) {
	let offset = 0;
	while (true) {
		const i = text.indexOf("@", offset);
		if (i < 0) return tokenFlags;
		offset = i + 1;
		if (!(tokenFlags & TokenFlags.PrecedingJSDocWithDeprecated) && hasJSDocTag(text, offset, "deprecated")) tokenFlags |= TokenFlags.PrecedingJSDocWithDeprecated;
		if (!(tokenFlags & TokenFlags.PrecedingJSDocWithSeeOrLink) && hasJSDocTag(text, offset, "see", "link", "linkcode", "linkplain")) tokenFlags |= TokenFlags.PrecedingJSDocWithSeeOrLink;
		if ((tokenFlags & (TokenFlags.PrecedingJSDocWithDeprecated | TokenFlags.PrecedingJSDocWithSeeOrLink)) === (TokenFlags.PrecedingJSDocWithDeprecated | TokenFlags.PrecedingJSDocWithSeeOrLink)) return tokenFlags;
	}
}
function lookupInUnicodeMap(code, map) {
	if (code < map[0]) return false;
	let lo = 0;
	let hi = map.length;
	let mid;
	while (lo + 1 < hi) {
		mid = lo + (hi - lo) / 2;
		mid -= mid % 2;
		if (map[mid] <= code && code <= map[mid + 1]) return true;
		if (code < map[mid]) hi = mid;
		else lo = mid + 2;
	}
	return false;
}
function isUnicodeIdentifierStart(code) {
	return lookupInUnicodeMap(code, unicodeESNextIdentifierStart);
}
function isUnicodeIdentifierPart(code) {
	return lookupInUnicodeMap(code, unicodeESNextIdentifierPart);
}
function makeReverseMap(source) {
	const result = [];
	source.forEach((value, name) => {
		result[value] = name;
	});
	return result;
}
makeReverseMap(textToToken);
function characterCodeToRegularExpressionFlag(ch) {
	return charCodeToRegExpFlag.get(ch);
}
function computeLineStarts(text) {
	const result = [];
	let pos = 0;
	let lineStart = 0;
	while (pos < text.length) {
		const ch = text.charCodeAt(pos);
		pos++;
		switch (ch) {
			case CharacterCodes.carriageReturn: if (text.charCodeAt(pos) === CharacterCodes.lineFeed) pos++;
			case CharacterCodes.lineFeed:
				result.push(lineStart);
				lineStart = pos;
				break;
			default: if (ch > CharacterCodes.maxAsciiCharacter && isLineBreak(ch)) {
				result.push(lineStart);
				lineStart = pos;
			}
		}
	}
	result.push(lineStart);
	return result;
}
function isWhiteSpaceLike(ch) {
	return isWhiteSpaceSingleLine(ch) || isLineBreak(ch);
}
function isWhiteSpaceSingleLine(ch) {
	return ch === CharacterCodes.space || ch === CharacterCodes.tab || ch === CharacterCodes.verticalTab || ch === CharacterCodes.formFeed || ch === CharacterCodes.nonBreakingSpace || ch === CharacterCodes.nextLine || ch === CharacterCodes.ogham || ch >= CharacterCodes.enQuad && ch <= CharacterCodes.zeroWidthSpace || ch === CharacterCodes.narrowNoBreakSpace || ch === CharacterCodes.mathematicalSpace || ch === CharacterCodes.ideographicSpace || ch === CharacterCodes.byteOrderMark;
}
function isLineBreak(ch) {
	return ch === CharacterCodes.lineFeed || ch === CharacterCodes.carriageReturn || ch === CharacterCodes.lineSeparator || ch === CharacterCodes.paragraphSeparator;
}
function isDigit(ch) {
	return ch >= CharacterCodes._0 && ch <= CharacterCodes._9;
}
function isHexDigit(ch) {
	return isDigit(ch) || ch >= CharacterCodes.A && ch <= CharacterCodes.F || ch >= CharacterCodes.a && ch <= CharacterCodes.f;
}
function isOctalDigit(ch) {
	return ch >= CharacterCodes._0 && ch <= CharacterCodes._7;
}
function skipTrivia(text, pos, stopAfterLineBreak, stopAtComments, inJSDoc) {
	if (pos < 0) return pos;
	let canConsumeStar = false;
	while (true) {
		const ch = text.charCodeAt(pos);
		switch (ch) {
			case CharacterCodes.carriageReturn: if (text.charCodeAt(pos + 1) === CharacterCodes.lineFeed) pos++;
			case CharacterCodes.lineFeed:
				pos++;
				if (stopAfterLineBreak) return pos;
				canConsumeStar = !!inJSDoc;
				continue;
			case CharacterCodes.tab:
			case CharacterCodes.verticalTab:
			case CharacterCodes.formFeed:
			case CharacterCodes.space:
				pos++;
				continue;
			case CharacterCodes.slash:
				if (stopAtComments) break;
				if (text.charCodeAt(pos + 1) === CharacterCodes.slash) {
					pos += 2;
					while (pos < text.length) {
						if (isLineBreak(text.charCodeAt(pos))) break;
						pos++;
					}
					canConsumeStar = false;
					continue;
				}
				if (text.charCodeAt(pos + 1) === CharacterCodes.asterisk) {
					pos += 2;
					while (pos < text.length) {
						if (text.charCodeAt(pos) === CharacterCodes.asterisk && text.charCodeAt(pos + 1) === CharacterCodes.slash) {
							pos += 2;
							break;
						}
						pos++;
					}
					canConsumeStar = false;
					continue;
				}
				break;
			case CharacterCodes.lessThan:
			case CharacterCodes.bar:
			case CharacterCodes.equals:
			case CharacterCodes.greaterThan:
				if (isConflictMarkerTrivia(text, pos)) {
					pos = scanConflictMarkerTrivia(text, pos);
					canConsumeStar = false;
					continue;
				}
				break;
			case CharacterCodes.hash:
				if (pos === 0 && isShebangTrivia(text, pos)) {
					pos = scanShebangTrivia(text, pos);
					continue;
				}
				break;
			case CharacterCodes.asterisk:
				if (canConsumeStar) {
					pos++;
					canConsumeStar = false;
					continue;
				}
				break;
			default: if (ch > CharacterCodes.maxAsciiCharacter && isWhiteSpaceLike(ch)) {
				pos++;
				continue;
			}
		}
		return pos;
	}
}
function isConflictMarkerTrivia(text, pos) {
	if (pos >= text.length) return false;
	const ch = text.charCodeAt(pos);
	if (pos === 0 || isLineBreak(text.charCodeAt(pos - 1))) {
		if (ch === CharacterCodes.lessThan || ch === CharacterCodes.greaterThan || ch === CharacterCodes.equals) {
			if (pos + 6 < text.length && text.charCodeAt(pos + 1) === ch && text.charCodeAt(pos + 2) === ch && text.charCodeAt(pos + 3) === ch && text.charCodeAt(pos + 4) === ch && text.charCodeAt(pos + 5) === ch && text.charCodeAt(pos + 6) === ch) return ch === CharacterCodes.equals || text.charCodeAt(pos + 7) === CharacterCodes.space;
		}
		if (ch === CharacterCodes.bar && pos + 6 < text.length && text.charCodeAt(pos + 1) === ch && text.charCodeAt(pos + 2) === ch && text.charCodeAt(pos + 3) === ch && text.charCodeAt(pos + 4) === ch && text.charCodeAt(pos + 5) === ch && text.charCodeAt(pos + 6) === ch) return true;
	}
	return false;
}
function scanConflictMarkerTrivia(text, pos) {
	const ch = text.charCodeAt(pos);
	const len = text.length;
	if (ch === CharacterCodes.lessThan || ch === CharacterCodes.greaterThan) while (pos < len && !isLineBreak(text.charCodeAt(pos))) pos++;
	else {
		pos += 7;
		while (pos < len) {
			const currentChar = text.charCodeAt(pos);
			if ((currentChar === CharacterCodes.equals || currentChar === CharacterCodes.greaterThan) && isConflictMarkerTrivia(text, pos)) break;
			pos++;
		}
	}
	return pos;
}
function isShebangTrivia(text, pos) {
	return pos === 0 && text.charCodeAt(0) === CharacterCodes.hash && text.charCodeAt(1) === CharacterCodes.exclamation;
}
function scanShebangTrivia(text, pos) {
	pos += 2;
	while (pos < text.length) {
		if (isLineBreak(text.charCodeAt(pos))) break;
		pos++;
	}
	return pos;
}
function isIdentifierStart(ch, _languageVersion) {
	return ch >= CharacterCodes.A && ch <= CharacterCodes.Z || ch >= CharacterCodes.a && ch <= CharacterCodes.z || ch === CharacterCodes.$ || ch === CharacterCodes._ || ch > CharacterCodes.maxAsciiCharacter && isUnicodeIdentifierStart(ch);
}
function isIdentifierPart(ch, _languageVersion, identifierVariant) {
	return ch >= CharacterCodes.A && ch <= CharacterCodes.Z || ch >= CharacterCodes.a && ch <= CharacterCodes.z || ch >= CharacterCodes._0 && ch <= CharacterCodes._9 || ch === CharacterCodes.$ || ch === CharacterCodes._ || (identifierVariant === LanguageVariant.JSX ? ch === CharacterCodes.minus || ch === CharacterCodes.colon : false) || ch > CharacterCodes.maxAsciiCharacter && isUnicodeIdentifierPart(ch);
}
function codePointAt(s, i) {
	return s.codePointAt(i);
}
function charSize(ch) {
	if (ch >= 65536) return 2;
	if (ch === CharacterCodes.EOF) return 0;
	return 1;
}
function utf16EncodeAsString(codePoint) {
	return String.fromCodePoint(codePoint);
}
function parsePseudoBigInt(stringValue) {
	let log2Base;
	switch (stringValue.charCodeAt(1)) {
		case CharacterCodes.b:
		case CharacterCodes.B:
			log2Base = 1;
			break;
		case CharacterCodes.o:
		case CharacterCodes.O:
			log2Base = 3;
			break;
		case CharacterCodes.x:
		case CharacterCodes.X:
			log2Base = 4;
			break;
		default:
			const nIndex = stringValue.length - 1;
			let nonZeroStart = 0;
			while (stringValue.charCodeAt(nonZeroStart) === CharacterCodes._0) nonZeroStart++;
			return stringValue.slice(nonZeroStart, nIndex) || "0";
	}
	const startIndex = 2;
	const endIndex = stringValue.length - 1;
	const bitsNeeded = (endIndex - startIndex) * log2Base;
	const segments = new Uint16Array((bitsNeeded >>> 4) + (bitsNeeded & 15 ? 1 : 0));
	for (let i = endIndex - 1, bitOffset = 0; i >= startIndex; i--, bitOffset += log2Base) {
		const segment = bitOffset >>> 4;
		const digitChar = stringValue.charCodeAt(i);
		const shiftedDigit = (digitChar <= CharacterCodes._9 ? digitChar - CharacterCodes._0 : 10 + digitChar - (digitChar <= CharacterCodes.F ? CharacterCodes.A : CharacterCodes.a)) << (bitOffset & 15);
		segments[segment] |= shiftedDigit;
		const residual = shiftedDigit >>> 16;
		if (residual) segments[segment + 1] |= residual;
	}
	let base10Value = "";
	let firstNonzeroSegment = segments.length - 1;
	let segmentsRemaining = true;
	while (segmentsRemaining) {
		let mod10 = 0;
		segmentsRemaining = false;
		for (let segment = firstNonzeroSegment; segment >= 0; segment--) {
			const newSegment = mod10 << 16 | segments[segment];
			const segmentValue = newSegment / 10 | 0;
			segments[segment] = segmentValue;
			mod10 = newSegment - segmentValue * 10;
			if (segmentValue && !segmentsRemaining) {
				firstNonzeroSegment = segment;
				segmentsRemaining = true;
			}
		}
		base10Value = mod10 + base10Value;
	}
	return base10Value;
}
function createScanner(skipTrivia, languageVariant = LanguageVariant.Standard, textInitial, start, length) {
	var text = textInitial;
	var pos;
	var end;
	var fullStartPos;
	var tokenStart;
	var token;
	var tokenValue;
	var tokenFlags;
	var commentDirectives;
	var skipJsDocLeadingAsterisks = 0;
	setText(text, start, length);
	return {
		getTokenFullStart: () => fullStartPos,
		getTokenEnd: () => pos,
		getToken: () => token,
		getTokenStart: () => tokenStart,
		getTokenText: () => text.substring(tokenStart, pos),
		getTokenValue: () => tokenValue,
		hasUnicodeEscape: () => (tokenFlags & TokenFlags.UnicodeEscape) !== 0,
		hasExtendedUnicodeEscape: () => (tokenFlags & TokenFlags.ExtendedUnicodeEscape) !== 0,
		hasPrecedingLineBreak: () => (tokenFlags & TokenFlags.PrecedingLineBreak) !== 0,
		hasPrecedingJSDocComment: () => (tokenFlags & TokenFlags.PrecedingJSDocComment) !== 0,
		hasPrecedingJSDocLeadingAsterisks: () => (tokenFlags & TokenFlags.PrecedingJSDocLeadingAsterisks) !== 0,
		hasPrecedingJSDocWithDeprecatedTag: () => (tokenFlags & TokenFlags.PrecedingJSDocWithDeprecated) !== 0,
		hasPrecedingJSDocWithSeeOrLink: () => (tokenFlags & TokenFlags.PrecedingJSDocWithSeeOrLink) !== 0,
		isIdentifier: () => token === SyntaxKind.Identifier || token > SyntaxKind.LastReservedWord,
		isReservedWord: () => token >= SyntaxKind.FirstReservedWord && token <= SyntaxKind.LastReservedWord,
		isUnterminated: () => (tokenFlags & TokenFlags.Unterminated) !== 0,
		getCommentDirectives: () => commentDirectives,
		getNumericLiteralFlags: () => tokenFlags & TokenFlags.NumericLiteralFlags,
		getTokenFlags: () => tokenFlags,
		reScanGreaterToken,
		reScanAsteriskEqualsToken,
		reScanSlashToken,
		reScanTemplateToken,
		reScanTemplateHeadOrNoSubstitutionTemplate,
		scanJsxIdentifier,
		scanJsxAttributeValue,
		reScanJsxAttributeValue,
		reScanJsxToken,
		reScanLessThanToken,
		reScanHashToken,
		reScanQuestionToken,
		reScanInvalidIdentifier,
		scanJsxToken,
		scanJsDocToken,
		scanJSDocCommentTextToken,
		scan,
		getText,
		clearCommentDirectives,
		setText,
		setLanguageVariant,
		resetTokenState,
		setSkipJsDocLeadingAsterisks,
		tryScan,
		lookAhead,
		scanRange
	};
	function codePointUnchecked(pos) {
		return codePointAt(text, pos);
	}
	function codePointChecked(pos) {
		return pos >= 0 && pos < end ? codePointUnchecked(pos) : CharacterCodes.EOF;
	}
	function charCodeUnchecked(pos) {
		return text.charCodeAt(pos);
	}
	function charCodeChecked(pos) {
		return pos >= 0 && pos < end ? charCodeUnchecked(pos) : CharacterCodes.EOF;
	}
	function scanNumberFragment() {
		let start = pos;
		let allowSeparator = false;
		let result = "";
		while (true) {
			const ch = charCodeUnchecked(pos);
			if (ch === CharacterCodes._) {
				tokenFlags |= TokenFlags.ContainsSeparator;
				if (allowSeparator) {
					allowSeparator = false;
					result += text.substring(start, pos);
				} else tokenFlags |= TokenFlags.ContainsInvalidSeparator;
				pos++;
				start = pos;
				continue;
			}
			if (isDigit(ch)) {
				allowSeparator = true;
				pos++;
				continue;
			}
			break;
		}
		if (charCodeUnchecked(pos - 1) === CharacterCodes._) tokenFlags |= TokenFlags.ContainsInvalidSeparator;
		return result + text.substring(start, pos);
	}
	function scanNumber() {
		let start = pos;
		let mainFragment;
		if (charCodeUnchecked(pos) === CharacterCodes._0) {
			pos++;
			if (charCodeUnchecked(pos) === CharacterCodes._) {
				tokenFlags |= TokenFlags.ContainsSeparator | TokenFlags.ContainsInvalidSeparator;
				pos--;
				mainFragment = scanNumberFragment();
			} else if (!scanDigits()) {
				tokenFlags |= TokenFlags.ContainsLeadingZero;
				mainFragment = "" + +tokenValue;
			} else if (!tokenValue) mainFragment = "0";
			else {
				tokenValue = "" + parseInt(tokenValue, 8);
				tokenFlags |= TokenFlags.Octal;
				const withMinus = token === SyntaxKind.MinusToken;
				"" + (+tokenValue).toString(8);
				if (withMinus) start--;
				return SyntaxKind.NumericLiteral;
			}
		} else mainFragment = scanNumberFragment();
		let decimalFragment;
		let scientificFragment;
		if (charCodeUnchecked(pos) === CharacterCodes.dot) {
			pos++;
			decimalFragment = scanNumberFragment();
		}
		let end = pos;
		if (charCodeUnchecked(pos) === CharacterCodes.E || charCodeUnchecked(pos) === CharacterCodes.e) {
			pos++;
			tokenFlags |= TokenFlags.Scientific;
			if (charCodeUnchecked(pos) === CharacterCodes.plus || charCodeUnchecked(pos) === CharacterCodes.minus) pos++;
			const preNumericPart = pos;
			const finalFragment = scanNumberFragment();
			if (finalFragment) {
				scientificFragment = text.substring(end, preNumericPart) + finalFragment;
				end = pos;
			}
		}
		let result;
		if (tokenFlags & TokenFlags.ContainsSeparator) {
			result = mainFragment;
			if (decimalFragment) result += "." + decimalFragment;
			if (scientificFragment) result += scientificFragment;
		} else result = text.substring(start, end);
		if (tokenFlags & TokenFlags.ContainsLeadingZero) {
			tokenValue = "" + +result;
			return SyntaxKind.NumericLiteral;
		}
		if (decimalFragment !== void 0 || tokenFlags & TokenFlags.Scientific) {
			checkForIdentifierStartAfterNumericLiteral();
			tokenValue = "" + +result;
			return SyntaxKind.NumericLiteral;
		} else {
			tokenValue = result;
			const type = checkBigIntSuffix();
			checkForIdentifierStartAfterNumericLiteral();
			return type;
		}
	}
	function checkForIdentifierStartAfterNumericLiteral() {
		if (!isIdentifierStart(codePointUnchecked(pos))) return;
		const identifierStart = pos;
		const { length } = scanIdentifierParts();
		if (!(length === 1 && text[identifierStart] === "n")) pos = identifierStart;
	}
	function scanDigits() {
		const start = pos;
		let isOctal = true;
		while (isDigit(charCodeChecked(pos))) {
			if (!isOctalDigit(charCodeUnchecked(pos))) isOctal = false;
			pos++;
		}
		tokenValue = text.substring(start, pos);
		return isOctal;
	}
	function scanExactNumberOfHexDigits(count, canHaveSeparators) {
		const valueString = scanHexDigits(count, false, canHaveSeparators);
		return valueString ? parseInt(valueString, 16) : -1;
	}
	function scanMinimumNumberOfHexDigits(count, canHaveSeparators) {
		return scanHexDigits(count, true, canHaveSeparators);
	}
	function scanHexDigits(minCount, scanAsManyAsPossible, canHaveSeparators) {
		let valueChars = [];
		let allowSeparator = false;
		while (valueChars.length < minCount || scanAsManyAsPossible) {
			let ch = charCodeUnchecked(pos);
			if (canHaveSeparators && ch === CharacterCodes._) {
				tokenFlags |= TokenFlags.ContainsSeparator;
				if (allowSeparator) allowSeparator = false;
				pos++;
				continue;
			}
			allowSeparator = canHaveSeparators;
			if (ch >= CharacterCodes.A && ch <= CharacterCodes.F) ch += CharacterCodes.a - CharacterCodes.A;
			else if (!(ch >= CharacterCodes._0 && ch <= CharacterCodes._9 || ch >= CharacterCodes.a && ch <= CharacterCodes.f)) break;
			valueChars.push(ch);
			pos++;
		}
		if (valueChars.length < minCount) valueChars = [];
		return String.fromCharCode(...valueChars);
	}
	function scanString(jsxAttributeString = false) {
		const quote = charCodeUnchecked(pos);
		pos++;
		let result = "";
		let start = pos;
		while (true) {
			if (pos >= end) {
				result += text.substring(start, pos);
				tokenFlags |= TokenFlags.Unterminated;
				break;
			}
			const ch = charCodeUnchecked(pos);
			if (ch === quote) {
				result += text.substring(start, pos);
				pos++;
				break;
			}
			if (ch === CharacterCodes.backslash && !jsxAttributeString) {
				result += text.substring(start, pos);
				result += scanEscapeSequence(EscapeSequenceScanningFlags.String | EscapeSequenceScanningFlags.ReportErrors);
				start = pos;
				continue;
			}
			if ((ch === CharacterCodes.lineFeed || ch === CharacterCodes.carriageReturn) && !jsxAttributeString) {
				result += text.substring(start, pos);
				tokenFlags |= TokenFlags.Unterminated;
				break;
			}
			pos++;
		}
		return result;
	}
	function scanTemplateAndSetTokenValue(shouldEmitInvalidEscapeError) {
		const startedWithBacktick = charCodeUnchecked(pos) === CharacterCodes.backtick;
		pos++;
		let start = pos;
		let contents = "";
		let resultingToken;
		while (true) {
			if (pos >= end) {
				contents += text.substring(start, pos);
				tokenFlags |= TokenFlags.Unterminated;
				resultingToken = startedWithBacktick ? SyntaxKind.NoSubstitutionTemplateLiteral : SyntaxKind.TemplateTail;
				break;
			}
			const currChar = charCodeUnchecked(pos);
			if (currChar === CharacterCodes.backtick) {
				contents += text.substring(start, pos);
				pos++;
				resultingToken = startedWithBacktick ? SyntaxKind.NoSubstitutionTemplateLiteral : SyntaxKind.TemplateTail;
				break;
			}
			if (currChar === CharacterCodes.$ && pos + 1 < end && charCodeUnchecked(pos + 1) === CharacterCodes.openBrace) {
				contents += text.substring(start, pos);
				pos += 2;
				resultingToken = startedWithBacktick ? SyntaxKind.TemplateHead : SyntaxKind.TemplateMiddle;
				break;
			}
			if (currChar === CharacterCodes.backslash) {
				contents += text.substring(start, pos);
				contents += scanEscapeSequence(EscapeSequenceScanningFlags.String | (shouldEmitInvalidEscapeError ? EscapeSequenceScanningFlags.ReportErrors : 0));
				start = pos;
				continue;
			}
			if (currChar === CharacterCodes.carriageReturn) {
				contents += text.substring(start, pos);
				pos++;
				if (pos < end && charCodeUnchecked(pos) === CharacterCodes.lineFeed) pos++;
				contents += "\n";
				start = pos;
				continue;
			}
			pos++;
		}
		tokenValue = contents;
		return resultingToken;
	}
	function scanEscapeSequence(flags) {
		const start = pos;
		pos++;
		if (pos >= end) return "";
		const ch = charCodeUnchecked(pos);
		pos++;
		switch (ch) {
			case CharacterCodes._0: if (pos >= end || !isDigit(charCodeUnchecked(pos))) return "\0";
			case CharacterCodes._1:
			case CharacterCodes._2:
			case CharacterCodes._3: if (pos < end && isOctalDigit(charCodeUnchecked(pos))) pos++;
			case CharacterCodes._4:
			case CharacterCodes._5:
			case CharacterCodes._6:
			case CharacterCodes._7:
				if (pos < end && isOctalDigit(charCodeUnchecked(pos))) pos++;
				tokenFlags |= TokenFlags.ContainsInvalidEscape;
				if (flags & EscapeSequenceScanningFlags.ReportInvalidEscapeErrors) {
					const code = parseInt(text.substring(start + 1, pos), 8);
					return String.fromCharCode(code);
				}
				return text.substring(start, pos);
			case CharacterCodes._8:
			case CharacterCodes._9:
				tokenFlags |= TokenFlags.ContainsInvalidEscape;
				if (flags & EscapeSequenceScanningFlags.ReportInvalidEscapeErrors) return String.fromCharCode(ch);
				return text.substring(start, pos);
			case CharacterCodes.b: return "\b";
			case CharacterCodes.t: return "	";
			case CharacterCodes.n: return "\n";
			case CharacterCodes.v: return "\v";
			case CharacterCodes.f: return "\f";
			case CharacterCodes.r: return "\r";
			case CharacterCodes.singleQuote: return "'";
			case CharacterCodes.doubleQuote: return "\"";
			case CharacterCodes.u:
				if (pos < end && charCodeUnchecked(pos) === CharacterCodes.openBrace) {
					pos -= 2;
					const result = scanExtendedUnicodeEscape();
					if (!(flags & EscapeSequenceScanningFlags.AllowExtendedUnicodeEscape)) tokenFlags |= TokenFlags.ContainsInvalidEscape;
					return result;
				}
				for (; pos < start + 6; pos++) if (!(pos < end && isHexDigit(charCodeUnchecked(pos)))) {
					tokenFlags |= TokenFlags.ContainsInvalidEscape;
					return text.substring(start, pos);
				}
				tokenFlags |= TokenFlags.UnicodeEscape;
				{
					const escapedValue = parseInt(text.substring(start + 2, pos), 16);
					const escapedValueString = String.fromCharCode(escapedValue);
					if (flags & EscapeSequenceScanningFlags.AnyUnicodeMode && escapedValue >= 55296 && escapedValue <= 56319 && pos + 6 < end && text.substring(pos, pos + 2) === "\\u" && charCodeUnchecked(pos + 2) !== CharacterCodes.openBrace) {
						const nextStart = pos;
						let nextPos = pos + 2;
						for (; nextPos < nextStart + 6; nextPos++) if (!isHexDigit(charCodeUnchecked(nextPos))) return escapedValueString;
						const nextEscapedValue = parseInt(text.substring(nextStart + 2, nextPos), 16);
						if (nextEscapedValue >= 56320 && nextEscapedValue <= 57343) {
							pos = nextPos;
							return escapedValueString + String.fromCharCode(nextEscapedValue);
						}
					}
					return escapedValueString;
				}
			case CharacterCodes.x:
				for (; pos < start + 4; pos++) if (!(pos < end && isHexDigit(charCodeUnchecked(pos)))) {
					tokenFlags |= TokenFlags.ContainsInvalidEscape;
					return text.substring(start, pos);
				}
				tokenFlags |= TokenFlags.HexEscape;
				return String.fromCharCode(parseInt(text.substring(start + 2, pos), 16));
			case CharacterCodes.carriageReturn: if (pos < end && charCodeUnchecked(pos) === CharacterCodes.lineFeed) pos++;
			case CharacterCodes.lineFeed:
			case CharacterCodes.lineSeparator:
			case CharacterCodes.paragraphSeparator: return "";
			default: return String.fromCharCode(ch);
		}
	}
	function scanExtendedUnicodeEscape() {
		const start = pos;
		pos += 3;
		const escapedValueString = scanMinimumNumberOfHexDigits(1, false);
		const escapedValue = escapedValueString ? parseInt(escapedValueString, 16) : -1;
		let isInvalidExtendedEscape = false;
		if (escapedValue < 0) isInvalidExtendedEscape = true;
		else if (escapedValue > 1114111) isInvalidExtendedEscape = true;
		if (pos >= end) isInvalidExtendedEscape = true;
		else if (charCodeUnchecked(pos) === CharacterCodes.closeBrace) pos++;
		else isInvalidExtendedEscape = true;
		if (isInvalidExtendedEscape) {
			tokenFlags |= TokenFlags.ContainsInvalidEscape;
			return text.substring(start, pos);
		}
		tokenFlags |= TokenFlags.ExtendedUnicodeEscape;
		return utf16EncodeAsString(escapedValue);
	}
	function peekUnicodeEscape() {
		if (pos + 5 < end && charCodeUnchecked(pos + 1) === CharacterCodes.u) {
			const start = pos;
			pos += 2;
			const value = scanExactNumberOfHexDigits(4, false);
			pos = start;
			return value;
		}
		return -1;
	}
	function peekExtendedUnicodeEscape() {
		if (codePointUnchecked(pos + 1) === CharacterCodes.u && codePointUnchecked(pos + 2) === CharacterCodes.openBrace) {
			const start = pos;
			pos += 3;
			const escapedValueString = scanMinimumNumberOfHexDigits(1, false);
			const escapedValue = escapedValueString ? parseInt(escapedValueString, 16) : -1;
			pos = start;
			return escapedValue;
		}
		return -1;
	}
	function scanIdentifierParts() {
		let result = "";
		let start = pos;
		while (pos < end) {
			let ch = codePointUnchecked(pos);
			if (isIdentifierPart(ch)) pos += charSize(ch);
			else if (ch === CharacterCodes.backslash) {
				ch = peekExtendedUnicodeEscape();
				if (ch >= 0 && isIdentifierPart(ch)) {
					result += scanExtendedUnicodeEscape();
					start = pos;
					continue;
				}
				ch = peekUnicodeEscape();
				if (!(ch >= 0 && isIdentifierPart(ch))) break;
				tokenFlags |= TokenFlags.UnicodeEscape;
				result += text.substring(start, pos);
				result += utf16EncodeAsString(ch);
				pos += 6;
				start = pos;
			} else break;
		}
		result += text.substring(start, pos);
		return result;
	}
	function getIdentifierToken() {
		const len = tokenValue.length;
		if (len >= 2 && len <= 12) {
			const ch = tokenValue.charCodeAt(0);
			if (ch >= CharacterCodes.a && ch <= CharacterCodes.z) {
				const keyword = textToKeyword.get(tokenValue);
				if (keyword !== void 0) return token = keyword;
			}
		}
		return token = SyntaxKind.Identifier;
	}
	function scanBinaryOrOctalDigits(base) {
		let value = "";
		let separatorAllowed = false;
		while (true) {
			const ch = charCodeUnchecked(pos);
			if (ch === CharacterCodes._) {
				tokenFlags |= TokenFlags.ContainsSeparator;
				if (separatorAllowed) separatorAllowed = false;
				pos++;
				continue;
			}
			separatorAllowed = true;
			if (!isDigit(ch) || ch - CharacterCodes._0 >= base) break;
			value += text[pos];
			pos++;
		}
		return value;
	}
	function checkBigIntSuffix() {
		if (charCodeUnchecked(pos) === CharacterCodes.n) {
			tokenValue += "n";
			if (tokenFlags & TokenFlags.BinaryOrOctalSpecifier) tokenValue = parsePseudoBigInt(tokenValue) + "n";
			pos++;
			return SyntaxKind.BigIntLiteral;
		} else {
			tokenValue = "" + (tokenFlags & TokenFlags.BinarySpecifier ? parseInt(tokenValue.slice(2), 2) : tokenFlags & TokenFlags.OctalSpecifier ? parseInt(tokenValue.slice(2), 8) : +tokenValue);
			return SyntaxKind.NumericLiteral;
		}
	}
	function scan() {
		fullStartPos = pos;
		tokenFlags = TokenFlags.None;
		while (true) {
			tokenStart = pos;
			if (pos >= end) return token = SyntaxKind.EndOfFile;
			const ch = codePointUnchecked(pos);
			if (pos === 0) {
				if (ch === CharacterCodes.hash && isShebangTrivia(text, pos)) {
					pos = scanShebangTrivia(text, pos);
					if (skipTrivia) continue;
					else return token = SyntaxKind.Unknown;
				}
			}
			switch (ch) {
				case CharacterCodes.lineFeed:
				case CharacterCodes.carriageReturn:
					tokenFlags |= TokenFlags.PrecedingLineBreak;
					if (skipTrivia) {
						pos++;
						continue;
					} else {
						if (ch === CharacterCodes.carriageReturn && pos + 1 < end && charCodeUnchecked(pos + 1) === CharacterCodes.lineFeed) pos += 2;
						else pos++;
						return token = SyntaxKind.NewLineTrivia;
					}
				case CharacterCodes.tab:
				case CharacterCodes.verticalTab:
				case CharacterCodes.formFeed:
				case CharacterCodes.space:
				case CharacterCodes.nonBreakingSpace:
				case CharacterCodes.ogham:
				case CharacterCodes.enQuad:
				case CharacterCodes.emQuad:
				case CharacterCodes.enSpace:
				case CharacterCodes.emSpace:
				case CharacterCodes.threePerEmSpace:
				case CharacterCodes.fourPerEmSpace:
				case CharacterCodes.sixPerEmSpace:
				case CharacterCodes.figureSpace:
				case CharacterCodes.punctuationSpace:
				case CharacterCodes.thinSpace:
				case CharacterCodes.hairSpace:
				case CharacterCodes.zeroWidthSpace:
				case CharacterCodes.narrowNoBreakSpace:
				case CharacterCodes.mathematicalSpace:
				case CharacterCodes.ideographicSpace:
				case CharacterCodes.byteOrderMark: if (skipTrivia) {
					pos++;
					continue;
				} else {
					while (pos < end && isWhiteSpaceSingleLine(charCodeUnchecked(pos))) pos++;
					return token = SyntaxKind.WhitespaceTrivia;
				}
				case CharacterCodes.exclamation:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) {
						if (charCodeUnchecked(pos + 2) === CharacterCodes.equals) return pos += 3, token = SyntaxKind.ExclamationEqualsEqualsToken;
						return pos += 2, token = SyntaxKind.ExclamationEqualsToken;
					}
					pos++;
					return token = SyntaxKind.ExclamationToken;
				case CharacterCodes.doubleQuote:
				case CharacterCodes.singleQuote:
					tokenValue = scanString();
					return token = SyntaxKind.StringLiteral;
				case CharacterCodes.backtick: return token = scanTemplateAndSetTokenValue(false);
				case CharacterCodes.percent:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.PercentEqualsToken;
					pos++;
					return token = SyntaxKind.PercentToken;
				case CharacterCodes.ampersand:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.ampersand) {
						if (charCodeUnchecked(pos + 2) === CharacterCodes.equals) return pos += 3, token = SyntaxKind.AmpersandAmpersandEqualsToken;
						return pos += 2, token = SyntaxKind.AmpersandAmpersandToken;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.AmpersandEqualsToken;
					pos++;
					return token = SyntaxKind.AmpersandToken;
				case CharacterCodes.openParen:
					pos++;
					return token = SyntaxKind.OpenParenToken;
				case CharacterCodes.closeParen:
					pos++;
					return token = SyntaxKind.CloseParenToken;
				case CharacterCodes.asterisk:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.AsteriskEqualsToken;
					if (charCodeUnchecked(pos + 1) === CharacterCodes.asterisk) {
						if (charCodeUnchecked(pos + 2) === CharacterCodes.equals) return pos += 3, token = SyntaxKind.AsteriskAsteriskEqualsToken;
						return pos += 2, token = SyntaxKind.AsteriskAsteriskToken;
					}
					pos++;
					if (skipJsDocLeadingAsterisks && (tokenFlags & TokenFlags.PrecedingJSDocLeadingAsterisks) === 0 && tokenFlags & TokenFlags.PrecedingLineBreak) {
						tokenFlags |= TokenFlags.PrecedingJSDocLeadingAsterisks;
						continue;
					}
					return token = SyntaxKind.AsteriskToken;
				case CharacterCodes.plus:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.plus) return pos += 2, token = SyntaxKind.PlusPlusToken;
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.PlusEqualsToken;
					pos++;
					return token = SyntaxKind.PlusToken;
				case CharacterCodes.comma:
					pos++;
					return token = SyntaxKind.CommaToken;
				case CharacterCodes.minus:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.minus) return pos += 2, token = SyntaxKind.MinusMinusToken;
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.MinusEqualsToken;
					pos++;
					return token = SyntaxKind.MinusToken;
				case CharacterCodes.dot:
					if (isDigit(charCodeUnchecked(pos + 1))) {
						scanNumber();
						return token = SyntaxKind.NumericLiteral;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.dot && charCodeUnchecked(pos + 2) === CharacterCodes.dot) return pos += 3, token = SyntaxKind.DotDotDotToken;
					pos++;
					return token = SyntaxKind.DotToken;
				case CharacterCodes.slash:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.slash) {
						pos += 2;
						while (pos < end) {
							if (isLineBreak(charCodeUnchecked(pos))) break;
							pos++;
						}
						commentDirectives = appendIfCommentDirective(commentDirectives, text.slice(tokenStart, pos), commentDirectiveRegExSingleLine, tokenStart);
						if (skipTrivia) continue;
						else return token = SyntaxKind.SingleLineCommentTrivia;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.asterisk) {
						pos += 2;
						const isJSDoc = charCodeUnchecked(pos) === CharacterCodes.asterisk && charCodeUnchecked(pos + 1) !== CharacterCodes.slash;
						let commentClosed = false;
						let lastLineStart = tokenStart;
						while (pos < end) {
							const ch = charCodeUnchecked(pos);
							if (ch === CharacterCodes.asterisk && charCodeUnchecked(pos + 1) === CharacterCodes.slash) {
								pos += 2;
								commentClosed = true;
								break;
							}
							pos++;
							if (isLineBreak(ch)) {
								lastLineStart = pos;
								tokenFlags |= TokenFlags.PrecedingLineBreak;
							}
						}
						if (isJSDoc) {
							tokenFlags |= TokenFlags.PrecedingJSDocComment;
							tokenFlags = scanJSDocCommentForTags(text.slice(tokenStart, pos), tokenFlags);
						}
						commentDirectives = appendIfCommentDirective(commentDirectives, text.slice(lastLineStart, pos), commentDirectiveRegExMultiLine, lastLineStart);
						if (skipTrivia) continue;
						else {
							if (!commentClosed) tokenFlags |= TokenFlags.Unterminated;
							return token = SyntaxKind.MultiLineCommentTrivia;
						}
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.SlashEqualsToken;
					pos++;
					return token = SyntaxKind.SlashToken;
				case CharacterCodes._0: if (pos + 2 < end && (charCodeUnchecked(pos + 1) === CharacterCodes.X || charCodeUnchecked(pos + 1) === CharacterCodes.x)) {
					pos += 2;
					tokenValue = scanMinimumNumberOfHexDigits(1, true);
					if (!tokenValue) tokenValue = "0";
					tokenValue = "0x" + tokenValue;
					tokenFlags |= TokenFlags.HexSpecifier;
					return token = checkBigIntSuffix();
				} else if (pos + 2 < end && (charCodeUnchecked(pos + 1) === CharacterCodes.B || charCodeUnchecked(pos + 1) === CharacterCodes.b)) {
					pos += 2;
					tokenValue = scanBinaryOrOctalDigits(2);
					if (!tokenValue) tokenValue = "0";
					tokenValue = "0b" + tokenValue;
					tokenFlags |= TokenFlags.BinarySpecifier;
					return token = checkBigIntSuffix();
				} else if (pos + 2 < end && (charCodeUnchecked(pos + 1) === CharacterCodes.O || charCodeUnchecked(pos + 1) === CharacterCodes.o)) {
					pos += 2;
					tokenValue = scanBinaryOrOctalDigits(8);
					if (!tokenValue) tokenValue = "0";
					tokenValue = "0o" + tokenValue;
					tokenFlags |= TokenFlags.OctalSpecifier;
					return token = checkBigIntSuffix();
				}
				case CharacterCodes._1:
				case CharacterCodes._2:
				case CharacterCodes._3:
				case CharacterCodes._4:
				case CharacterCodes._5:
				case CharacterCodes._6:
				case CharacterCodes._7:
				case CharacterCodes._8:
				case CharacterCodes._9: return token = scanNumber();
				case CharacterCodes.colon:
					pos++;
					return token = SyntaxKind.ColonToken;
				case CharacterCodes.semicolon:
					pos++;
					return token = SyntaxKind.SemicolonToken;
				case CharacterCodes.lessThan:
					if (isConflictMarkerTrivia(text, pos)) {
						pos = scanConflictMarkerTrivia(text, pos);
						if (skipTrivia) continue;
						else return token = SyntaxKind.ConflictMarkerTrivia;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.lessThan) {
						if (charCodeUnchecked(pos + 2) === CharacterCodes.equals) return pos += 3, token = SyntaxKind.LessThanLessThanEqualsToken;
						return pos += 2, token = SyntaxKind.LessThanLessThanToken;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.LessThanEqualsToken;
					if (languageVariant === LanguageVariant.JSX && charCodeUnchecked(pos + 1) === CharacterCodes.slash && charCodeUnchecked(pos + 2) !== CharacterCodes.asterisk) return pos += 2, token = SyntaxKind.LessThanSlashToken;
					pos++;
					return token = SyntaxKind.LessThanToken;
				case CharacterCodes.equals:
					if (isConflictMarkerTrivia(text, pos)) {
						pos = scanConflictMarkerTrivia(text, pos);
						if (skipTrivia) continue;
						else return token = SyntaxKind.ConflictMarkerTrivia;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) {
						if (charCodeUnchecked(pos + 2) === CharacterCodes.equals) return pos += 3, token = SyntaxKind.EqualsEqualsEqualsToken;
						return pos += 2, token = SyntaxKind.EqualsEqualsToken;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.greaterThan) return pos += 2, token = SyntaxKind.EqualsGreaterThanToken;
					pos++;
					return token = SyntaxKind.EqualsToken;
				case CharacterCodes.greaterThan:
					if (isConflictMarkerTrivia(text, pos)) {
						pos = scanConflictMarkerTrivia(text, pos);
						if (skipTrivia) continue;
						else return token = SyntaxKind.ConflictMarkerTrivia;
					}
					pos++;
					return token = SyntaxKind.GreaterThanToken;
				case CharacterCodes.question:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.dot && !isDigit(charCodeUnchecked(pos + 2))) return pos += 2, token = SyntaxKind.QuestionDotToken;
					if (charCodeUnchecked(pos + 1) === CharacterCodes.question) {
						if (charCodeUnchecked(pos + 2) === CharacterCodes.equals) return pos += 3, token = SyntaxKind.QuestionQuestionEqualsToken;
						return pos += 2, token = SyntaxKind.QuestionQuestionToken;
					}
					pos++;
					return token = SyntaxKind.QuestionToken;
				case CharacterCodes.openBracket:
					pos++;
					return token = SyntaxKind.OpenBracketToken;
				case CharacterCodes.closeBracket:
					pos++;
					return token = SyntaxKind.CloseBracketToken;
				case CharacterCodes.caret:
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.CaretEqualsToken;
					pos++;
					return token = SyntaxKind.CaretToken;
				case CharacterCodes.openBrace:
					pos++;
					return token = SyntaxKind.OpenBraceToken;
				case CharacterCodes.bar:
					if (isConflictMarkerTrivia(text, pos)) {
						pos = scanConflictMarkerTrivia(text, pos);
						if (skipTrivia) continue;
						else return token = SyntaxKind.ConflictMarkerTrivia;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.bar) {
						if (charCodeUnchecked(pos + 2) === CharacterCodes.equals) return pos += 3, token = SyntaxKind.BarBarEqualsToken;
						return pos += 2, token = SyntaxKind.BarBarToken;
					}
					if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.BarEqualsToken;
					pos++;
					return token = SyntaxKind.BarToken;
				case CharacterCodes.closeBrace:
					pos++;
					return token = SyntaxKind.CloseBraceToken;
				case CharacterCodes.tilde:
					pos++;
					return token = SyntaxKind.TildeToken;
				case CharacterCodes.at:
					pos++;
					return token = SyntaxKind.AtToken;
				case CharacterCodes.backslash: {
					const extendedCookedChar = peekExtendedUnicodeEscape();
					if (extendedCookedChar >= 0 && isIdentifierStart(extendedCookedChar)) {
						tokenValue = scanExtendedUnicodeEscape() + scanIdentifierParts();
						return token = getIdentifierToken();
					}
					const cookedChar = peekUnicodeEscape();
					if (cookedChar >= 0 && isIdentifierStart(cookedChar)) {
						pos += 6;
						tokenFlags |= TokenFlags.UnicodeEscape;
						tokenValue = String.fromCharCode(cookedChar) + scanIdentifierParts();
						return token = getIdentifierToken();
					}
					pos++;
					return token = SyntaxKind.Unknown;
				}
				case CharacterCodes.hash:
					if (pos !== 0 && text[pos + 1] === "!") {
						pos++;
						return token = SyntaxKind.Unknown;
					}
					{
						const charAfterHash = codePointUnchecked(pos + 1);
						if (charAfterHash === CharacterCodes.backslash) {
							pos++;
							const extendedCookedChar = peekExtendedUnicodeEscape();
							if (extendedCookedChar >= 0 && isIdentifierStart(extendedCookedChar)) {
								tokenValue = "#" + scanExtendedUnicodeEscape() + scanIdentifierParts();
								return token = SyntaxKind.PrivateIdentifier;
							}
							const cookedChar = peekUnicodeEscape();
							if (cookedChar >= 0 && isIdentifierStart(cookedChar)) {
								pos += 6;
								tokenFlags |= TokenFlags.UnicodeEscape;
								tokenValue = "#" + String.fromCharCode(cookedChar) + scanIdentifierParts();
								return token = SyntaxKind.PrivateIdentifier;
							}
							pos--;
						}
						if (isIdentifierStart(charAfterHash)) {
							pos++;
							scanIdentifier(charAfterHash);
						} else tokenValue = "#";
						return token = SyntaxKind.PrivateIdentifier;
					}
				case CharacterCodes.replacementCharacter:
					pos = end;
					return token = SyntaxKind.NonTextFileMarkerTrivia;
				default: {
					const identifierKind = scanIdentifier(ch);
					if (identifierKind) return token = identifierKind;
					else if (isWhiteSpaceSingleLine(ch)) {
						pos += charSize(ch);
						continue;
					} else if (isLineBreak(ch)) {
						tokenFlags |= TokenFlags.PrecedingLineBreak;
						pos += charSize(ch);
						continue;
					}
					const size = charSize(ch);
					pos += size;
					return token = SyntaxKind.Unknown;
				}
			}
		}
	}
	function reScanInvalidIdentifier() {
		pos = tokenStart = fullStartPos;
		tokenFlags = 0;
		const ch = codePointUnchecked(pos);
		const identifierKind = scanIdentifier(ch);
		if (identifierKind) return token = identifierKind;
		pos += charSize(ch);
		return token;
	}
	function scanIdentifier(startCharacter) {
		let ch = startCharacter;
		if (isIdentifierStart(ch)) {
			pos += charSize(ch);
			while (pos < end && isIdentifierPart(ch = codePointUnchecked(pos))) pos += charSize(ch);
			tokenValue = text.substring(tokenStart, pos);
			if (ch === CharacterCodes.backslash) tokenValue += scanIdentifierParts();
			return getIdentifierToken();
		}
	}
	function reScanGreaterToken() {
		if (token === SyntaxKind.GreaterThanToken) {
			if (charCodeUnchecked(pos) === CharacterCodes.greaterThan) {
				if (charCodeUnchecked(pos + 1) === CharacterCodes.greaterThan) {
					if (charCodeUnchecked(pos + 2) === CharacterCodes.equals) return pos += 3, token = SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken;
					return pos += 2, token = SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
				}
				if (charCodeUnchecked(pos + 1) === CharacterCodes.equals) return pos += 2, token = SyntaxKind.GreaterThanGreaterThanEqualsToken;
				pos++;
				return token = SyntaxKind.GreaterThanGreaterThanToken;
			}
			if (charCodeUnchecked(pos) === CharacterCodes.equals) {
				pos++;
				return token = SyntaxKind.GreaterThanEqualsToken;
			}
		}
		return token;
	}
	function reScanAsteriskEqualsToken() {
		pos = tokenStart + 1;
		return token = SyntaxKind.EqualsToken;
	}
	function reScanSlashToken() {
		if (token === SyntaxKind.SlashToken || token === SyntaxKind.SlashEqualsToken) {
			const startOfRegExpBody = tokenStart + 1;
			pos = startOfRegExpBody;
			let inEscape = false;
			let inCharacterClass = false;
			while (true) {
				const ch = charCodeChecked(pos);
				if (ch === CharacterCodes.EOF || isLineBreak(ch)) {
					tokenFlags |= TokenFlags.Unterminated;
					break;
				}
				if (inEscape) inEscape = false;
				else if (ch === CharacterCodes.slash && !inCharacterClass) break;
				else if (ch === CharacterCodes.openBracket) inCharacterClass = true;
				else if (ch === CharacterCodes.backslash) inEscape = true;
				else if (ch === CharacterCodes.closeBracket) inCharacterClass = false;
				pos++;
			}
			if (tokenFlags & TokenFlags.Unterminated) {
				pos = startOfRegExpBody;
				inEscape = false;
				let characterClassDepth = 0;
				let inDecimalQuantifier = false;
				let groupDepth = 0;
				while (pos < end && !isLineBreak(charCodeUnchecked(pos))) {
					const ch = charCodeUnchecked(pos);
					if (inEscape) inEscape = false;
					else if (ch === CharacterCodes.backslash) inEscape = true;
					else if (ch === CharacterCodes.openBracket) characterClassDepth++;
					else if (ch === CharacterCodes.closeBracket && characterClassDepth) characterClassDepth--;
					else if (!characterClassDepth) {
						if (ch === CharacterCodes.openBrace) inDecimalQuantifier = true;
						else if (ch === CharacterCodes.closeBrace && inDecimalQuantifier) inDecimalQuantifier = false;
						else if (!inDecimalQuantifier) {
							if (ch === CharacterCodes.openParen) groupDepth++;
							else if (ch === CharacterCodes.closeParen && groupDepth) groupDepth--;
							else if (ch === CharacterCodes.closeParen || ch === CharacterCodes.closeBracket || ch === CharacterCodes.closeBrace) break;
						}
					}
					pos++;
				}
				while (isWhiteSpaceLike(charCodeChecked(pos - 1)) || charCodeChecked(pos - 1) === CharacterCodes.semicolon) pos--;
			} else {
				pos++;
				let regExpFlags = RegularExpressionFlags.None;
				while (true) {
					const ch = codePointChecked(pos);
					if (ch === CharacterCodes.EOF || !isIdentifierPart(ch)) break;
					const size = charSize(ch);
					const flag = characterCodeToRegularExpressionFlag(ch);
					if (flag !== void 0) regExpFlags |= flag;
					pos += size;
				}
			}
			tokenValue = text.substring(tokenStart, pos);
			token = SyntaxKind.RegularExpressionLiteral;
		}
		return token;
	}
	function appendIfCommentDirective(commentDirectives, text, commentDirectiveRegEx, lineStart) {
		const type = getDirectiveFromComment(text.trimStart(), commentDirectiveRegEx);
		if (type === void 0) return commentDirectives;
		if (!commentDirectives) commentDirectives = [];
		commentDirectives.push({
			range: {
				pos: lineStart,
				end: pos
			},
			type
		});
		return commentDirectives;
	}
	function getDirectiveFromComment(text, commentDirectiveRegEx) {
		const match = commentDirectiveRegEx.exec(text);
		if (!match) return;
		switch (match[1]) {
			case "ts-expect-error": return CommentDirectiveType.ExpectError;
			case "ts-ignore": return CommentDirectiveType.Ignore;
		}
	}
	function reScanTemplateToken(isTaggedTemplate) {
		pos = tokenStart;
		return token = scanTemplateAndSetTokenValue(!isTaggedTemplate);
	}
	function reScanTemplateHeadOrNoSubstitutionTemplate() {
		pos = tokenStart;
		return token = scanTemplateAndSetTokenValue(true);
	}
	function reScanJsxToken(allowMultilineJsxText = true) {
		pos = tokenStart = fullStartPos;
		return token = scanJsxToken(allowMultilineJsxText);
	}
	function reScanLessThanToken() {
		if (token === SyntaxKind.LessThanLessThanToken) {
			pos = tokenStart + 1;
			return token = SyntaxKind.LessThanToken;
		}
		return token;
	}
	function reScanHashToken() {
		if (token === SyntaxKind.PrivateIdentifier) {
			pos = tokenStart + 1;
			return token = SyntaxKind.HashToken;
		}
		return token;
	}
	function reScanQuestionToken() {
		pos = tokenStart + 1;
		return token = SyntaxKind.QuestionToken;
	}
	function scanJsxToken(allowMultilineJsxText = true) {
		fullStartPos = tokenStart = pos;
		if (pos >= end) return token = SyntaxKind.EndOfFile;
		let char = charCodeUnchecked(pos);
		if (char === CharacterCodes.lessThan) {
			if (charCodeUnchecked(pos + 1) === CharacterCodes.slash) {
				pos += 2;
				return token = SyntaxKind.LessThanSlashToken;
			}
			pos++;
			return token = SyntaxKind.LessThanToken;
		}
		if (char === CharacterCodes.openBrace) {
			pos++;
			return token = SyntaxKind.OpenBraceToken;
		}
		let firstNonWhitespace = 0;
		while (pos < end) {
			char = charCodeUnchecked(pos);
			if (char === CharacterCodes.openBrace) break;
			if (char === CharacterCodes.lessThan) {
				if (isConflictMarkerTrivia(text, pos)) {
					pos = scanConflictMarkerTrivia(text, pos);
					return token = SyntaxKind.ConflictMarkerTrivia;
				}
				break;
			}
			if (isLineBreak(char) && firstNonWhitespace === 0) firstNonWhitespace = -1;
			else if (!allowMultilineJsxText && isLineBreak(char) && firstNonWhitespace > 0) break;
			else if (!isWhiteSpaceLike(char)) firstNonWhitespace = pos;
			pos++;
		}
		tokenValue = text.substring(fullStartPos, pos);
		return firstNonWhitespace === -1 ? SyntaxKind.JsxTextAllWhiteSpaces : SyntaxKind.JsxText;
	}
	function scanJsxIdentifier() {
		if (tokenIsIdentifierOrKeyword(token)) {
			while (pos < end) {
				if (charCodeUnchecked(pos) === CharacterCodes.minus) {
					tokenValue += "-";
					pos++;
					continue;
				}
				const oldPos = pos;
				tokenValue += scanIdentifierParts();
				if (pos === oldPos) break;
			}
			return getIdentifierToken();
		}
		return token;
	}
	function scanJsxAttributeValue() {
		fullStartPos = pos;
		switch (charCodeUnchecked(pos)) {
			case CharacterCodes.doubleQuote:
			case CharacterCodes.singleQuote:
				tokenValue = scanString(true);
				return token = SyntaxKind.StringLiteral;
			default: return scan();
		}
	}
	function reScanJsxAttributeValue() {
		pos = tokenStart = fullStartPos;
		return scanJsxAttributeValue();
	}
	function scanJSDocCommentTextToken(inBackticks) {
		fullStartPos = tokenStart = pos;
		tokenFlags = TokenFlags.None;
		if (pos >= end) return token = SyntaxKind.EndOfFile;
		for (let ch = charCodeUnchecked(pos); pos < end && !isLineBreak(ch) && ch !== CharacterCodes.backtick; ch = codePointUnchecked(++pos)) if (!inBackticks) {
			if (ch === CharacterCodes.openBrace) break;
			else if (ch === CharacterCodes.at && pos - 1 >= 0 && isWhiteSpaceSingleLine(charCodeUnchecked(pos - 1)) && pos + 1 < end && isIdentifierStart(charCodeUnchecked(pos + 1))) break;
		}
		if (pos === tokenStart) return scanJsDocToken();
		tokenValue = text.substring(tokenStart, pos);
		return token = SyntaxKind.JSDocCommentTextToken;
	}
	function scanJsDocToken() {
		fullStartPos = tokenStart = pos;
		tokenFlags = TokenFlags.None;
		if (pos >= end) return token = SyntaxKind.EndOfFile;
		const ch = codePointUnchecked(pos);
		pos += charSize(ch);
		switch (ch) {
			case CharacterCodes.tab:
			case CharacterCodes.verticalTab:
			case CharacterCodes.formFeed:
			case CharacterCodes.space:
				while (pos < end && isWhiteSpaceSingleLine(charCodeUnchecked(pos))) pos++;
				return token = SyntaxKind.WhitespaceTrivia;
			case CharacterCodes.at: return token = SyntaxKind.AtToken;
			case CharacterCodes.carriageReturn: if (charCodeUnchecked(pos) === CharacterCodes.lineFeed) pos++;
			case CharacterCodes.lineFeed:
				tokenFlags |= TokenFlags.PrecedingLineBreak;
				return token = SyntaxKind.NewLineTrivia;
			case CharacterCodes.asterisk: return token = SyntaxKind.AsteriskToken;
			case CharacterCodes.openBrace: return token = SyntaxKind.OpenBraceToken;
			case CharacterCodes.closeBrace: return token = SyntaxKind.CloseBraceToken;
			case CharacterCodes.openBracket: return token = SyntaxKind.OpenBracketToken;
			case CharacterCodes.closeBracket: return token = SyntaxKind.CloseBracketToken;
			case CharacterCodes.openParen: return token = SyntaxKind.OpenParenToken;
			case CharacterCodes.closeParen: return token = SyntaxKind.CloseParenToken;
			case CharacterCodes.lessThan: return token = SyntaxKind.LessThanToken;
			case CharacterCodes.greaterThan: return token = SyntaxKind.GreaterThanToken;
			case CharacterCodes.equals: return token = SyntaxKind.EqualsToken;
			case CharacterCodes.comma: return token = SyntaxKind.CommaToken;
			case CharacterCodes.dot: return token = SyntaxKind.DotToken;
			case CharacterCodes.backtick: return token = SyntaxKind.BacktickToken;
			case CharacterCodes.hash: return token = SyntaxKind.HashToken;
			case CharacterCodes.backslash:
				pos--;
				{
					const extendedCookedChar = peekExtendedUnicodeEscape();
					if (extendedCookedChar >= 0 && isIdentifierStart(extendedCookedChar)) {
						tokenValue = scanExtendedUnicodeEscape() + scanIdentifierParts();
						return token = getIdentifierToken();
					}
					const cookedChar = peekUnicodeEscape();
					if (cookedChar >= 0 && isIdentifierStart(cookedChar)) {
						pos += 6;
						tokenFlags |= TokenFlags.UnicodeEscape;
						tokenValue = String.fromCharCode(cookedChar) + scanIdentifierParts();
						return token = getIdentifierToken();
					}
				}
				pos++;
				return token = SyntaxKind.Unknown;
		}
		if (isIdentifierStart(ch)) {
			let char = ch;
			while (pos < end && isIdentifierPart(char = codePointUnchecked(pos)) || char === CharacterCodes.minus) pos += charSize(char);
			tokenValue = text.substring(tokenStart, pos);
			if (char === CharacterCodes.backslash) tokenValue += scanIdentifierParts();
			return token = getIdentifierToken();
		} else return token = SyntaxKind.Unknown;
	}
	function speculationHelper(callback, isLookahead) {
		const savePos = pos;
		const saveStartPos = fullStartPos;
		const saveTokenPos = tokenStart;
		const saveToken = token;
		const saveTokenValue = tokenValue;
		const saveTokenFlags = tokenFlags;
		const result = callback();
		if (!result || isLookahead) {
			pos = savePos;
			fullStartPos = saveStartPos;
			tokenStart = saveTokenPos;
			token = saveToken;
			tokenValue = saveTokenValue;
			tokenFlags = saveTokenFlags;
		}
		return result;
	}
	function scanRange(start, length, callback) {
		const saveEnd = end;
		const savePos = pos;
		const saveStartPos = fullStartPos;
		const saveTokenPos = tokenStart;
		const saveToken = token;
		const saveTokenValue = tokenValue;
		const saveTokenFlags = tokenFlags;
		const saveErrorExpectations = commentDirectives;
		setText(text, start, length);
		const result = callback();
		end = saveEnd;
		pos = savePos;
		fullStartPos = saveStartPos;
		tokenStart = saveTokenPos;
		token = saveToken;
		tokenValue = saveTokenValue;
		tokenFlags = saveTokenFlags;
		commentDirectives = saveErrorExpectations;
		return result;
	}
	function lookAhead(callback) {
		return speculationHelper(callback, true);
	}
	function tryScan(callback) {
		return speculationHelper(callback, false);
	}
	function getText() {
		return text;
	}
	function clearCommentDirectives() {
		commentDirectives = void 0;
	}
	function setText(newText, start, length) {
		text = newText || "";
		end = length === void 0 ? text.length : start + length;
		resetTokenState(start || 0);
	}
	function setLanguageVariant(variant) {
		languageVariant = variant;
	}
	function resetTokenState(position) {
		pos = position;
		fullStartPos = position;
		tokenStart = position;
		token = SyntaxKind.Unknown;
		tokenValue = void 0;
		tokenFlags = TokenFlags.None;
	}
	function setSkipJsDocLeadingAsterisks(skip) {
		skipJsDocLeadingAsterisks += skip ? 1 : -1;
	}
}
//#endregion
//#region ../../node_modules/typescript/dist/ast/astnav.js
function getTokenAtPosition(sourceFile, position) {
	return getTokenAtPositionImpl(sourceFile, position, true, void 0);
}
function getTokenAtPositionImpl(sourceFile, position, allowPositionInLeadingTrivia, includePrecedingTokenAtEndPosition) {
	let current = sourceFile;
	let nodeAfterLeft;
	const state = {
		next: void 0,
		prevSubtree: void 0,
		left: 0
	};
	const testNode = (node) => {
		if (node.kind !== SyntaxKind.EndOfFile && node.end === position && includePrecedingTokenAtEndPosition !== void 0) state.prevSubtree = node;
		if (node.end < position || node.end === position && node.kind !== SyntaxKind.EndOfFile && (!isJSDocNodeKind(node.kind) || node.end !== sourceFile.endOfFileToken.end)) return -1;
		if (getPosition(node, sourceFile, allowPositionInLeadingTrivia) > position) return 1;
		return 0;
	};
	while (true) {
		state.next = void 0;
		nodeAfterLeft = void 0;
		let skipSingleCommentChildren = false;
		const visitNode = (node) => {
			if (node.flags & NodeFlags.Reparsed) return;
			if (skipSingleCommentChildren && isJSDocCommentChildKind(node.kind)) return;
			if (nodeAfterLeft === void 0) nodeAfterLeft = node;
			if (state.next === void 0) switch (testNode(node)) {
				case -1:
					if (!isJSDocNodeKind(node.kind)) state.left = node.end;
					nodeAfterLeft = void 0;
					break;
				case 0: state.next = node;
			}
		};
		if (current.jsDoc) for (const jsdoc of current.jsDoc) visitNode(jsdoc);
		current.forEachChild(visitNode, (nodes) => {
			skipSingleCommentChildren = isJSDocSingleCommentNodeList(nodes);
			if (nodes.length === 0 || skipSingleCommentChildren) return;
			if (nodeAfterLeft === void 0) {
				for (const node of nodes) if (!(node.flags & NodeFlags.Reparsed)) {
					nodeAfterLeft = node;
					break;
				}
			}
			if (state.next === void 0) {
				if (nodes.end === position && includePrecedingTokenAtEndPosition !== void 0) {
					state.left = nodes.end;
					nodeAfterLeft = void 0;
					state.prevSubtree = nodes[nodes.length - 1];
				} else if (nodes.end <= position) {
					state.left = nodes.end;
					nodeAfterLeft = void 0;
				} else if (nodes.pos <= position) binarySearchNodeList(nodes, testNode, (node, middle, arr) => {
					state.left = node.end;
					nodeAfterLeft = void 0;
					for (let i = middle + 1; i < arr.length; i++) if (!(arr[i].flags & NodeFlags.Reparsed)) {
						nodeAfterLeft = arr[i];
						break;
					}
				}, (found) => {
					state.next = found;
				});
			}
		});
		if (state.prevSubtree !== void 0) {
			const child = findPrecedingTokenImpl(sourceFile, position, state.prevSubtree);
			if (child !== void 0 && child.end === position && includePrecedingTokenAtEndPosition(child)) return child;
			state.prevSubtree = void 0;
		}
		if (state.next === void 0) {
			if (isTokenKind(current.kind) || shouldSkipChild(current)) return current;
			const scanner = getScannerForSourceFile(sourceFile, state.left);
			let end = current.end;
			const afterLeft = nodeAfterLeft;
			if (afterLeft !== void 0) end = afterLeft.pos;
			while (state.left < end) {
				const token = scanner.getToken();
				const tokenFullStart = scanner.getTokenFullStart();
				const tokenStart = allowPositionInLeadingTrivia ? tokenFullStart : scanner.getTokenStart();
				const tokenEnd = scanner.getTokenEnd();
				const flags = scanner.getTokenFlags();
				if (tokenEnd > end) break;
				if (tokenStart <= position && position < tokenEnd) {
					if (token === SyntaxKind.Identifier || !isTokenKind(token)) {
						if (isJSDocNodeKind(current.kind)) return current;
						throw new Error(`did not expect ${SyntaxKind[current.kind]} to have ${SyntaxKind[token]} in its trivia`);
					}
					return getOrCreateToken(sourceFile, token, tokenFullStart, tokenEnd, current, flags);
				}
				if (includePrecedingTokenAtEndPosition !== void 0 && tokenEnd === position) {
					const prevToken = getOrCreateToken(sourceFile, token, tokenFullStart, tokenEnd, current, flags);
					if (includePrecedingTokenAtEndPosition(prevToken)) return prevToken;
				}
				state.left = tokenEnd;
				scanner.scan();
			}
			return current;
		}
		current = state.next;
		state.left = current.pos;
		nodeAfterLeft = void 0;
	}
}
function getPosition(node, sourceFile, allowPositionInLeadingTrivia) {
	if (allowPositionInLeadingTrivia) return node.pos;
	return getTokenPosOfNode(node, sourceFile, true);
}
/** @internal */
function getTokenPosOfNode(node, sourceFile, includeJSDoc) {
	if (nodeIsMissing(node)) return node.pos;
	if (isJSDocNodeKind(node.kind) || node.kind === SyntaxKind.JsxText) return skipTrivia(sourceFile.text, node.pos, false, true);
	if (includeJSDoc && node.jsDoc && node.jsDoc.length > 0) return getTokenPosOfNode(node.jsDoc[0], sourceFile, false);
	return skipTrivia(sourceFile.text, node.pos, false, false, !!(node.flags & NodeFlags.JSDoc));
}
function nodeIsMissing(node) {
	return node.pos === node.end && node.pos >= 0 && node.kind !== SyntaxKind.EndOfFile;
}
function findPrecedingTokenImpl(sourceFile, position, startNode) {
	const find = (n) => {
		if (isTokenKind(n.kind) && n.kind !== SyntaxKind.EndOfFile) return n;
		let foundChild;
		let prevChild;
		if (n.jsDoc) for (const jsdoc of n.jsDoc) {
			if (jsdoc.flags & NodeFlags.Reparsed) continue;
			if (foundChild !== void 0) break;
			if (position < jsdoc.end && (prevChild === void 0 || prevChild.end <= position)) foundChild = jsdoc;
			else prevChild = jsdoc;
		}
		let skipSingleCommentChildrenImpl = false;
		n.forEachChild((node) => {
			if (node.flags & NodeFlags.Reparsed) return;
			if (skipSingleCommentChildrenImpl && isJSDocCommentChildKind(node.kind)) return;
			if (foundChild !== void 0) return;
			if (position < node.end && (prevChild === void 0 || prevChild.end <= position)) foundChild = node;
			else prevChild = node;
		}, (nodes) => {
			skipSingleCommentChildrenImpl = isJSDocSingleCommentNodeList(nodes);
			if (foundChild !== void 0) return;
			if (nodes.length > 0 && !skipSingleCommentChildrenImpl) {
				const index = binarySearchForPrecedingToken(nodes, position);
				if (index >= 0 && !(nodes[index].flags & NodeFlags.Reparsed)) foundChild = nodes[index];
				const lookupIndex = index >= 0 ? index - 1 : nodes.length - 1;
				for (let i = lookupIndex; i >= 0; i--) if (!(nodes[i].flags & NodeFlags.Reparsed)) {
					if (prevChild === void 0) prevChild = nodes[i];
					break;
				}
			}
		});
		if (foundChild !== void 0) {
			if (getTokenPosOfNode(foundChild, sourceFile, true) >= position) {
				if (position >= foundChild.pos) {
					let jsDoc;
					if (n.jsDoc) {
						for (let i = n.jsDoc.length - 1; i >= 0; i--) if (n.jsDoc[i].pos >= foundChild.pos) {
							jsDoc = n.jsDoc[i];
							break;
						}
					}
					if (jsDoc !== void 0) {
						if (position < jsDoc.end) return find(jsDoc);
						return findRightmostValidToken(sourceFile, jsDoc.end, n, position);
					}
					return findRightmostValidToken(sourceFile, foundChild.pos, n, -1);
				}
				return findRightmostValidToken(sourceFile, foundChild.pos, n, position);
			}
			return find(foundChild);
		}
		if (position >= n.end) return findRightmostValidToken(sourceFile, n.end, n, -1);
		return findRightmostValidToken(sourceFile, n.end, n, position);
	};
	return find(startNode);
}
function findRightmostValidToken(sourceFile, endPos, containingNode, position) {
	if (position === -1) position = containingNode.end;
	const find = (n, endPos) => {
		if (isTokenKind(n.kind) && n.kind !== SyntaxKind.EndOfFile) return n;
		let rightmostValidNode;
		let hasChildren = false;
		if (n.jsDoc) {
			hasChildren = true;
			for (const jsdoc of n.jsDoc) {
				if (jsdoc.flags & NodeFlags.Reparsed) continue;
				if (jsdoc.end > endPos || getTokenPosOfNode(jsdoc, sourceFile) >= position) continue;
				if (isValidPrecedingNode(jsdoc, sourceFile)) rightmostValidNode = jsdoc;
			}
		}
		let skipSingleCommentChildren = false;
		n.forEachChild((node) => {
			if (node.flags & NodeFlags.Reparsed) return;
			if (skipSingleCommentChildren && isJSDocCommentChildKind(node.kind)) return;
			hasChildren = true;
			if (node.end > endPos || getTokenPosOfNode(node, sourceFile) >= position) return;
			if (isValidPrecedingNode(node, sourceFile)) rightmostValidNode = node;
		}, (nodes) => {
			skipSingleCommentChildren = isJSDocSingleCommentNodeList(nodes);
			if (nodes.length > 0 && !skipSingleCommentChildren) {
				hasChildren = true;
				for (let i = nodes.length - 1; i >= 0; i--) {
					const node = nodes[i];
					if (node.flags & NodeFlags.Reparsed) continue;
					if (node.end > endPos || getTokenPosOfNode(node, sourceFile) >= position) continue;
					if (isValidPrecedingNode(node, sourceFile)) {
						rightmostValidNode = node;
						break;
					}
				}
			}
		});
		if (!shouldSkipChild(n)) {
			const startPos = rightmostValidNode !== void 0 ? rightmostValidNode.end : n.pos;
			const targetEnd = Math.min(endPos, position);
			if (startPos < targetEnd) {
				const scanner = getScannerForSourceFile(sourceFile, startPos);
				let pos = startPos;
				let lastScannedToken;
				while (pos < targetEnd) {
					if (scanner.getTokenStart() >= position) break;
					const tokenFullStart = scanner.getTokenFullStart();
					const tokenEnd = scanner.getTokenEnd();
					lastScannedToken = getOrCreateToken(sourceFile, scanner.getToken(), tokenFullStart, tokenEnd, n, scanner.getTokenFlags());
					pos = tokenEnd;
					scanner.scan();
				}
				if (lastScannedToken !== void 0) return lastScannedToken;
			}
		}
		if (!hasChildren) {
			if (n !== containingNode) return n;
			return;
		}
		if (rightmostValidNode !== void 0) return find(rightmostValidNode, rightmostValidNode.end);
	};
	return find(containingNode, endPos);
}
function isValidPrecedingNode(node, sourceFile) {
	if (node.kind === SyntaxKind.EndOfFile) return false;
	const start = getTokenPosOfNode(node, sourceFile);
	return node.end - start > 0;
}
function shouldSkipChild(node) {
	return node.kind === SyntaxKind.JSDoc || node.kind === SyntaxKind.JSDocText || node.kind === SyntaxKind.JSDocTypeLiteral || node.kind === SyntaxKind.JSDocSignature || node.kind === SyntaxKind.JSDocLink || node.kind === SyntaxKind.JSDocLinkCode || node.kind === SyntaxKind.JSDocLinkPlain || isJSDocTag(node);
}
function isJSDocTag(node) {
	return node.kind >= SyntaxKind.FirstJSDocTagNode && node.kind <= SyntaxKind.LastJSDocTagNode;
}
function isJSDocCommentChildKind(kind) {
	switch (kind) {
		case SyntaxKind.JSDocText:
		case SyntaxKind.JSDocLink:
		case SyntaxKind.JSDocLinkCode:
		case SyntaxKind.JSDocLinkPlain: return true;
		default: return false;
	}
}
function isJSDocSingleCommentNodeList(nodes) {
	return nodes.length === 1 && isJSDocCommentChildKind(nodes[0].kind);
}
function getScannerForSourceFile(sourceFile, pos) {
	const scanner = createScanner(true, sourceFile.languageVariant, sourceFile.text);
	scanner.resetTokenState(pos);
	scanner.scan();
	return scanner;
}
function getOrCreateToken(sourceFile, kind, pos, end, parent, _flags) {
	const key = `${pos}_${end}`;
	if (!sourceFile.tokenCache) sourceFile.tokenCache = /* @__PURE__ */ new Map();
	const existing = sourceFile.tokenCache.get(key);
	if (existing !== void 0) return existing;
	const token = createToken(kind);
	token.pos = pos;
	token.end = end;
	token.parent = parent;
	sourceFile.tokenCache.set(key, token);
	return token;
}
/** Binary search a node list for the node containing position. */
function binarySearchNodeList(nodes, testNode, onLeft, onMatch) {
	let lo = 0;
	let hi = nodes.length - 1;
	while (lo <= hi) {
		const mid = lo + hi >>> 1;
		const node = nodes[mid];
		if (node.flags & NodeFlags.Reparsed) {
			let found = false;
			for (let i = mid + 1; i <= hi; i++) if (!(nodes[i].flags & NodeFlags.Reparsed)) {
				const cmp = testNode(nodes[i]);
				if (cmp < 0) {
					onLeft(nodes[i], i, nodes);
					lo = i + 1;
				} else if (cmp > 0) hi = i - 1;
				else {
					onMatch(nodes[i]);
					return;
				}
				found = true;
				break;
			}
			if (!found) hi = mid - 1;
			continue;
		}
		const cmp = testNode(node);
		if (cmp < 0) {
			onLeft(node, mid, nodes);
			lo = mid + 1;
		} else if (cmp > 0) hi = mid - 1;
		else {
			onMatch(node);
			return;
		}
	}
}
function binarySearchForPrecedingToken(nodes, position) {
	let lo = 0;
	let hi = nodes.length - 1;
	let result = -1;
	while (lo <= hi) {
		const mid = lo + hi >>> 1;
		const node = nodes[mid];
		if (node.flags & NodeFlags.Reparsed) {
			lo = mid + 1;
			continue;
		}
		if (position < node.end) {
			if (mid === 0 || position >= nodes[mid - 1].end) {
				result = mid;
				break;
			}
			hi = mid - 1;
		} else lo = mid + 1;
	}
	return result;
}
//#endregion
//#region ../../node_modules/typescript/dist/enums/completionItemKind.js
var CompletionItemKind;
(function(CompletionItemKind) {
	CompletionItemKind[CompletionItemKind["Text"] = 1] = "Text";
	CompletionItemKind[CompletionItemKind["Method"] = 2] = "Method";
	CompletionItemKind[CompletionItemKind["Function"] = 3] = "Function";
	CompletionItemKind[CompletionItemKind["Constructor"] = 4] = "Constructor";
	CompletionItemKind[CompletionItemKind["Field"] = 5] = "Field";
	CompletionItemKind[CompletionItemKind["Variable"] = 6] = "Variable";
	CompletionItemKind[CompletionItemKind["Class"] = 7] = "Class";
	CompletionItemKind[CompletionItemKind["Interface"] = 8] = "Interface";
	CompletionItemKind[CompletionItemKind["Module"] = 9] = "Module";
	CompletionItemKind[CompletionItemKind["Property"] = 10] = "Property";
	CompletionItemKind[CompletionItemKind["Unit"] = 11] = "Unit";
	CompletionItemKind[CompletionItemKind["Value"] = 12] = "Value";
	CompletionItemKind[CompletionItemKind["Enum"] = 13] = "Enum";
	CompletionItemKind[CompletionItemKind["Keyword"] = 14] = "Keyword";
	CompletionItemKind[CompletionItemKind["Snippet"] = 15] = "Snippet";
	CompletionItemKind[CompletionItemKind["Color"] = 16] = "Color";
	CompletionItemKind[CompletionItemKind["File"] = 17] = "File";
	CompletionItemKind[CompletionItemKind["Reference"] = 18] = "Reference";
	CompletionItemKind[CompletionItemKind["Folder"] = 19] = "Folder";
	CompletionItemKind[CompletionItemKind["EnumMember"] = 20] = "EnumMember";
	CompletionItemKind[CompletionItemKind["Constant"] = 21] = "Constant";
	CompletionItemKind[CompletionItemKind["Struct"] = 22] = "Struct";
	CompletionItemKind[CompletionItemKind["Event"] = 23] = "Event";
	CompletionItemKind[CompletionItemKind["Operator"] = 24] = "Operator";
	CompletionItemKind[CompletionItemKind["TypeParameter"] = 25] = "TypeParameter";
})(CompletionItemKind || (CompletionItemKind = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/diagnosticCategory.js
var DiagnosticCategory;
(function(DiagnosticCategory) {
	DiagnosticCategory[DiagnosticCategory["Warning"] = 0] = "Warning";
	DiagnosticCategory[DiagnosticCategory["Error"] = 1] = "Error";
	DiagnosticCategory[DiagnosticCategory["Suggestion"] = 2] = "Suggestion";
	DiagnosticCategory[DiagnosticCategory["Message"] = 3] = "Message";
})(DiagnosticCategory || (DiagnosticCategory = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/elementFlags.js
var ElementFlags;
(function(ElementFlags) {
	ElementFlags[ElementFlags["None"] = 0] = "None";
	ElementFlags[ElementFlags["Required"] = 1] = "Required";
	ElementFlags[ElementFlags["Optional"] = 2] = "Optional";
	ElementFlags[ElementFlags["Rest"] = 4] = "Rest";
	ElementFlags[ElementFlags["Variadic"] = 8] = "Variadic";
	ElementFlags[ElementFlags["Fixed"] = 3] = "Fixed";
	ElementFlags[ElementFlags["Variable"] = 12] = "Variable";
	ElementFlags[ElementFlags["NonRequired"] = 14] = "NonRequired";
	ElementFlags[ElementFlags["NonRest"] = 11] = "NonRest";
})(ElementFlags || (ElementFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/moduleKind.js
var ModuleKind;
(function(ModuleKind) {
	ModuleKind[ModuleKind["None"] = 0] = "None";
	ModuleKind[ModuleKind["CommonJS"] = 1] = "CommonJS";
	ModuleKind[ModuleKind["AMD"] = 2] = "AMD";
	ModuleKind[ModuleKind["UMD"] = 3] = "UMD";
	ModuleKind[ModuleKind["System"] = 4] = "System";
	ModuleKind[ModuleKind["ES2015"] = 5] = "ES2015";
	ModuleKind[ModuleKind["ES2020"] = 6] = "ES2020";
	ModuleKind[ModuleKind["ES2022"] = 7] = "ES2022";
	ModuleKind[ModuleKind["ESNext"] = 99] = "ESNext";
	ModuleKind[ModuleKind["Node16"] = 100] = "Node16";
	ModuleKind[ModuleKind["Node18"] = 101] = "Node18";
	ModuleKind[ModuleKind["Node20"] = 102] = "Node20";
	ModuleKind[ModuleKind["NodeNext"] = 199] = "NodeNext";
	ModuleKind[ModuleKind["Preserve"] = 200] = "Preserve";
})(ModuleKind || (ModuleKind = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/nodeBuilderFlags.js
var NodeBuilderFlags;
(function(NodeBuilderFlags) {
	NodeBuilderFlags[NodeBuilderFlags["None"] = 0] = "None";
	NodeBuilderFlags[NodeBuilderFlags["NoTruncation"] = 1] = "NoTruncation";
	NodeBuilderFlags[NodeBuilderFlags["WriteArrayAsGenericType"] = 2] = "WriteArrayAsGenericType";
	NodeBuilderFlags[NodeBuilderFlags["GenerateNamesForShadowedTypeParams"] = 4] = "GenerateNamesForShadowedTypeParams";
	NodeBuilderFlags[NodeBuilderFlags["UseStructuralFallback"] = 8] = "UseStructuralFallback";
	NodeBuilderFlags[NodeBuilderFlags["ForbidIndexedAccessSymbolReferences"] = 16] = "ForbidIndexedAccessSymbolReferences";
	NodeBuilderFlags[NodeBuilderFlags["WriteTypeArgumentsOfSignature"] = 32] = "WriteTypeArgumentsOfSignature";
	NodeBuilderFlags[NodeBuilderFlags["UseFullyQualifiedType"] = 64] = "UseFullyQualifiedType";
	NodeBuilderFlags[NodeBuilderFlags["UseOnlyExternalAliasing"] = 128] = "UseOnlyExternalAliasing";
	NodeBuilderFlags[NodeBuilderFlags["SuppressAnyReturnType"] = 256] = "SuppressAnyReturnType";
	NodeBuilderFlags[NodeBuilderFlags["WriteTypeParametersInQualifiedName"] = 512] = "WriteTypeParametersInQualifiedName";
	NodeBuilderFlags[NodeBuilderFlags["MultilineObjectLiterals"] = 1024] = "MultilineObjectLiterals";
	NodeBuilderFlags[NodeBuilderFlags["WriteClassExpressionAsTypeLiteral"] = 2048] = "WriteClassExpressionAsTypeLiteral";
	NodeBuilderFlags[NodeBuilderFlags["UseTypeOfFunction"] = 4096] = "UseTypeOfFunction";
	NodeBuilderFlags[NodeBuilderFlags["OmitParameterModifiers"] = 8192] = "OmitParameterModifiers";
	NodeBuilderFlags[NodeBuilderFlags["UseAliasDefinedOutsideCurrentScope"] = 16384] = "UseAliasDefinedOutsideCurrentScope";
	NodeBuilderFlags[NodeBuilderFlags["UseSingleQuotesForStringLiteralType"] = 268435456] = "UseSingleQuotesForStringLiteralType";
	NodeBuilderFlags[NodeBuilderFlags["NoTypeReduction"] = 536870912] = "NoTypeReduction";
	NodeBuilderFlags[NodeBuilderFlags["UseInstantiationExpressions"] = 1073741824] = "UseInstantiationExpressions";
	NodeBuilderFlags[NodeBuilderFlags["OmitThisParameter"] = 33554432] = "OmitThisParameter";
	NodeBuilderFlags[NodeBuilderFlags["WriteCallStyleSignature"] = 134217728] = "WriteCallStyleSignature";
	NodeBuilderFlags[NodeBuilderFlags["AllowThisInObjectLiteral"] = 32768] = "AllowThisInObjectLiteral";
	NodeBuilderFlags[NodeBuilderFlags["AllowQualifiedNameInPlaceOfIdentifier"] = 65536] = "AllowQualifiedNameInPlaceOfIdentifier";
	NodeBuilderFlags[NodeBuilderFlags["AllowAnonymousIdentifier"] = 131072] = "AllowAnonymousIdentifier";
	NodeBuilderFlags[NodeBuilderFlags["AllowEmptyUnionOrIntersection"] = 262144] = "AllowEmptyUnionOrIntersection";
	NodeBuilderFlags[NodeBuilderFlags["AllowEmptyTuple"] = 524288] = "AllowEmptyTuple";
	NodeBuilderFlags[NodeBuilderFlags["AllowUniqueESSymbolType"] = 1048576] = "AllowUniqueESSymbolType";
	NodeBuilderFlags[NodeBuilderFlags["AllowEmptyIndexInfoType"] = 2097152] = "AllowEmptyIndexInfoType";
	NodeBuilderFlags[NodeBuilderFlags["AllowNodeModulesRelativePaths"] = 67108864] = "AllowNodeModulesRelativePaths";
	NodeBuilderFlags[NodeBuilderFlags["IgnoreErrors"] = 70221824] = "IgnoreErrors";
	NodeBuilderFlags[NodeBuilderFlags["InObjectTypeLiteral"] = 4194304] = "InObjectTypeLiteral";
	NodeBuilderFlags[NodeBuilderFlags["InTypeAlias"] = 8388608] = "InTypeAlias";
	NodeBuilderFlags[NodeBuilderFlags["InInitialEntityName"] = 16777216] = "InInitialEntityName";
})(NodeBuilderFlags || (NodeBuilderFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/objectFlags.js
var ObjectFlags;
(function(ObjectFlags) {
	ObjectFlags[ObjectFlags["None"] = 0] = "None";
	ObjectFlags[ObjectFlags["Class"] = 1] = "Class";
	ObjectFlags[ObjectFlags["Interface"] = 2] = "Interface";
	ObjectFlags[ObjectFlags["Reference"] = 4] = "Reference";
	ObjectFlags[ObjectFlags["Tuple"] = 8] = "Tuple";
	ObjectFlags[ObjectFlags["Anonymous"] = 16] = "Anonymous";
	ObjectFlags[ObjectFlags["Mapped"] = 32] = "Mapped";
	ObjectFlags[ObjectFlags["Instantiated"] = 64] = "Instantiated";
	ObjectFlags[ObjectFlags["ObjectLiteral"] = 128] = "ObjectLiteral";
	ObjectFlags[ObjectFlags["EvolvingArray"] = 256] = "EvolvingArray";
	ObjectFlags[ObjectFlags["ObjectLiteralPatternWithComputedProperties"] = 512] = "ObjectLiteralPatternWithComputedProperties";
	ObjectFlags[ObjectFlags["ReverseMapped"] = 1024] = "ReverseMapped";
	ObjectFlags[ObjectFlags["JsxAttributes"] = 2048] = "JsxAttributes";
	ObjectFlags[ObjectFlags["JSLiteral"] = 4096] = "JSLiteral";
	ObjectFlags[ObjectFlags["FreshLiteral"] = 8192] = "FreshLiteral";
	ObjectFlags[ObjectFlags["ArrayLiteral"] = 16384] = "ArrayLiteral";
	ObjectFlags[ObjectFlags["PrimitiveUnion"] = 32768] = "PrimitiveUnion";
	ObjectFlags[ObjectFlags["ContainsWideningType"] = 65536] = "ContainsWideningType";
	ObjectFlags[ObjectFlags["ContainsObjectOrArrayLiteral"] = 131072] = "ContainsObjectOrArrayLiteral";
	ObjectFlags[ObjectFlags["NonInferrableType"] = 262144] = "NonInferrableType";
	ObjectFlags[ObjectFlags["CouldContainTypeVariablesComputed"] = 524288] = "CouldContainTypeVariablesComputed";
	ObjectFlags[ObjectFlags["CouldContainTypeVariables"] = 1048576] = "CouldContainTypeVariables";
	ObjectFlags[ObjectFlags["MembersResolved"] = 2097152] = "MembersResolved";
	ObjectFlags[ObjectFlags["ClassOrInterface"] = 3] = "ClassOrInterface";
	ObjectFlags[ObjectFlags["RequiresWidening"] = 196608] = "RequiresWidening";
	ObjectFlags[ObjectFlags["PropagatingFlags"] = 458752] = "PropagatingFlags";
	ObjectFlags[ObjectFlags["InstantiatedMapped"] = 96] = "InstantiatedMapped";
	ObjectFlags[ObjectFlags["InstantiationExpressionType"] = 16777216] = "InstantiationExpressionType";
	ObjectFlags[ObjectFlags["SingleSignatureType"] = 33554432] = "SingleSignatureType";
	ObjectFlags[ObjectFlags["ObjectTypeKindMask"] = 50332991] = "ObjectTypeKindMask";
	ObjectFlags[ObjectFlags["ContainsSpread"] = 4194304] = "ContainsSpread";
	ObjectFlags[ObjectFlags["ObjectRestType"] = 8388608] = "ObjectRestType";
	ObjectFlags[ObjectFlags["IsClassInstanceClone"] = 67108864] = "IsClassInstanceClone";
	ObjectFlags[ObjectFlags["IdenticalBaseTypeCalculated"] = 134217728] = "IdenticalBaseTypeCalculated";
	ObjectFlags[ObjectFlags["IdenticalBaseTypeExists"] = 268435456] = "IdenticalBaseTypeExists";
	ObjectFlags[ObjectFlags["UnresolvedMembers"] = 536870912] = "UnresolvedMembers";
	ObjectFlags[ObjectFlags["FromTypeNode"] = 1073741824] = "FromTypeNode";
	ObjectFlags[ObjectFlags["IsGenericTypeComputed"] = 4194304] = "IsGenericTypeComputed";
	ObjectFlags[ObjectFlags["IsGenericObjectType"] = 8388608] = "IsGenericObjectType";
	ObjectFlags[ObjectFlags["IsGenericIndexType"] = 16777216] = "IsGenericIndexType";
	ObjectFlags[ObjectFlags["IsGenericType"] = 25165824] = "IsGenericType";
	ObjectFlags[ObjectFlags["ContainsIntersections"] = 33554432] = "ContainsIntersections";
	ObjectFlags[ObjectFlags["IsUnknownLikeUnionComputed"] = 67108864] = "IsUnknownLikeUnionComputed";
	ObjectFlags[ObjectFlags["IsUnknownLikeUnion"] = 134217728] = "IsUnknownLikeUnion";
	ObjectFlags[ObjectFlags["IsNeverIntersectionComputed"] = 33554432] = "IsNeverIntersectionComputed";
	ObjectFlags[ObjectFlags["IsNeverIntersection"] = 67108864] = "IsNeverIntersection";
	ObjectFlags[ObjectFlags["IsConstrainedTypeVariable"] = 134217728] = "IsConstrainedTypeVariable";
})(ObjectFlags || (ObjectFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/signatureFlags.js
var SignatureFlags;
(function(SignatureFlags) {
	SignatureFlags[SignatureFlags["None"] = 0] = "None";
	SignatureFlags[SignatureFlags["HasRestParameter"] = 1] = "HasRestParameter";
	SignatureFlags[SignatureFlags["HasLiteralTypes"] = 2] = "HasLiteralTypes";
	SignatureFlags[SignatureFlags["Construct"] = 4] = "Construct";
	SignatureFlags[SignatureFlags["Abstract"] = 8] = "Abstract";
	SignatureFlags[SignatureFlags["IsInnerCallChain"] = 16] = "IsInnerCallChain";
	SignatureFlags[SignatureFlags["IsOuterCallChain"] = 32] = "IsOuterCallChain";
	SignatureFlags[SignatureFlags["IsUntypedSignatureInJSFile"] = 64] = "IsUntypedSignatureInJSFile";
	SignatureFlags[SignatureFlags["IsNonInferrable"] = 128] = "IsNonInferrable";
	SignatureFlags[SignatureFlags["IsSignatureCandidateForOverloadFailure"] = 256] = "IsSignatureCandidateForOverloadFailure";
	SignatureFlags[SignatureFlags["PropagatingFlags"] = 335] = "PropagatingFlags";
	SignatureFlags[SignatureFlags["CallChainFlags"] = 48] = "CallChainFlags";
})(SignatureFlags || (SignatureFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/signatureKind.js
var SignatureKind;
(function(SignatureKind) {
	SignatureKind[SignatureKind["Call"] = 0] = "Call";
	SignatureKind[SignatureKind["Construct"] = 1] = "Construct";
})(SignatureKind || (SignatureKind = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/symbolFlags.js
var SymbolFlags;
(function(SymbolFlags) {
	SymbolFlags[SymbolFlags["None"] = 0] = "None";
	SymbolFlags[SymbolFlags["FunctionScopedVariable"] = 1] = "FunctionScopedVariable";
	SymbolFlags[SymbolFlags["BlockScopedVariable"] = 2] = "BlockScopedVariable";
	SymbolFlags[SymbolFlags["Property"] = 4] = "Property";
	SymbolFlags[SymbolFlags["EnumMember"] = 8] = "EnumMember";
	SymbolFlags[SymbolFlags["Function"] = 16] = "Function";
	SymbolFlags[SymbolFlags["Class"] = 32] = "Class";
	SymbolFlags[SymbolFlags["Interface"] = 64] = "Interface";
	SymbolFlags[SymbolFlags["ConstEnum"] = 128] = "ConstEnum";
	SymbolFlags[SymbolFlags["RegularEnum"] = 256] = "RegularEnum";
	SymbolFlags[SymbolFlags["ValueModule"] = 512] = "ValueModule";
	SymbolFlags[SymbolFlags["NamespaceModule"] = 1024] = "NamespaceModule";
	SymbolFlags[SymbolFlags["TypeLiteral"] = 2048] = "TypeLiteral";
	SymbolFlags[SymbolFlags["ObjectLiteral"] = 4096] = "ObjectLiteral";
	SymbolFlags[SymbolFlags["Method"] = 8192] = "Method";
	SymbolFlags[SymbolFlags["Constructor"] = 16384] = "Constructor";
	SymbolFlags[SymbolFlags["GetAccessor"] = 32768] = "GetAccessor";
	SymbolFlags[SymbolFlags["SetAccessor"] = 65536] = "SetAccessor";
	SymbolFlags[SymbolFlags["Signature"] = 131072] = "Signature";
	SymbolFlags[SymbolFlags["TypeParameter"] = 262144] = "TypeParameter";
	SymbolFlags[SymbolFlags["TypeAlias"] = 524288] = "TypeAlias";
	SymbolFlags[SymbolFlags["ExportValue"] = 1048576] = "ExportValue";
	SymbolFlags[SymbolFlags["Alias"] = 2097152] = "Alias";
	SymbolFlags[SymbolFlags["Prototype"] = 4194304] = "Prototype";
	SymbolFlags[SymbolFlags["ExportStar"] = 8388608] = "ExportStar";
	SymbolFlags[SymbolFlags["Optional"] = 16777216] = "Optional";
	SymbolFlags[SymbolFlags["Transient"] = 33554432] = "Transient";
	SymbolFlags[SymbolFlags["Assignment"] = 67108864] = "Assignment";
	SymbolFlags[SymbolFlags["ModuleExports"] = 134217728] = "ModuleExports";
	SymbolFlags[SymbolFlags["ConstEnumOnlyModule"] = 268435456] = "ConstEnumOnlyModule";
	SymbolFlags[SymbolFlags["ReplaceableByMethod"] = 536870912] = "ReplaceableByMethod";
	SymbolFlags[SymbolFlags["GlobalLookup"] = 1073741824] = "GlobalLookup";
	SymbolFlags[SymbolFlags["All"] = 536870912] = "All";
	SymbolFlags[SymbolFlags["Enum"] = 384] = "Enum";
	SymbolFlags[SymbolFlags["Variable"] = 3] = "Variable";
	SymbolFlags[SymbolFlags["Value"] = 111551] = "Value";
	SymbolFlags[SymbolFlags["Type"] = 788968] = "Type";
	SymbolFlags[SymbolFlags["Namespace"] = 1920] = "Namespace";
	SymbolFlags[SymbolFlags["Module"] = 1536] = "Module";
	SymbolFlags[SymbolFlags["Accessor"] = 98304] = "Accessor";
	SymbolFlags[SymbolFlags["FunctionScopedVariableExcludes"] = 111550] = "FunctionScopedVariableExcludes";
	SymbolFlags[SymbolFlags["BlockScopedVariableExcludes"] = 111551] = "BlockScopedVariableExcludes";
	SymbolFlags[SymbolFlags["ParameterExcludes"] = 111551] = "ParameterExcludes";
	SymbolFlags[SymbolFlags["PropertyExcludes"] = 13243] = "PropertyExcludes";
	SymbolFlags[SymbolFlags["EnumMemberExcludes"] = 900095] = "EnumMemberExcludes";
	SymbolFlags[SymbolFlags["FunctionExcludes"] = 110991] = "FunctionExcludes";
	SymbolFlags[SymbolFlags["ClassExcludes"] = 899503] = "ClassExcludes";
	SymbolFlags[SymbolFlags["InterfaceExcludes"] = 788872] = "InterfaceExcludes";
	SymbolFlags[SymbolFlags["RegularEnumExcludes"] = 899327] = "RegularEnumExcludes";
	SymbolFlags[SymbolFlags["ConstEnumExcludes"] = 899967] = "ConstEnumExcludes";
	SymbolFlags[SymbolFlags["ValueModuleExcludes"] = 110735] = "ValueModuleExcludes";
	SymbolFlags[SymbolFlags["NamespaceModuleExcludes"] = 0] = "NamespaceModuleExcludes";
	SymbolFlags[SymbolFlags["MethodExcludes"] = 103359] = "MethodExcludes";
	SymbolFlags[SymbolFlags["GetAccessorExcludes"] = 46011] = "GetAccessorExcludes";
	SymbolFlags[SymbolFlags["SetAccessorExcludes"] = 78779] = "SetAccessorExcludes";
	SymbolFlags[SymbolFlags["AccessorExcludes"] = 111547] = "AccessorExcludes";
	SymbolFlags[SymbolFlags["TypeParameterExcludes"] = 526824] = "TypeParameterExcludes";
	SymbolFlags[SymbolFlags["TypeAliasExcludes"] = 788968] = "TypeAliasExcludes";
	SymbolFlags[SymbolFlags["AliasExcludes"] = 2097152] = "AliasExcludes";
	SymbolFlags[SymbolFlags["ModuleMember"] = 2623475] = "ModuleMember";
	SymbolFlags[SymbolFlags["ExportHasLocal"] = 944] = "ExportHasLocal";
	SymbolFlags[SymbolFlags["BlockScoped"] = 418] = "BlockScoped";
	SymbolFlags[SymbolFlags["PropertyOrAccessor"] = 98308] = "PropertyOrAccessor";
	SymbolFlags[SymbolFlags["ClassMember"] = 106500] = "ClassMember";
	SymbolFlags[SymbolFlags["ExportSupportsDefaultModifier"] = 112] = "ExportSupportsDefaultModifier";
	SymbolFlags[SymbolFlags["ExportDoesNotSupportDefaultModifier"] = -113] = "ExportDoesNotSupportDefaultModifier";
	SymbolFlags[SymbolFlags["Classifiable"] = 2885600] = "Classifiable";
	SymbolFlags[SymbolFlags["LateBindingContainer"] = 6256] = "LateBindingContainer";
})(SymbolFlags || (SymbolFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/typeFlags.js
var TypeFlags;
(function(TypeFlags) {
	TypeFlags[TypeFlags["None"] = 0] = "None";
	TypeFlags[TypeFlags["Any"] = 1] = "Any";
	TypeFlags[TypeFlags["Unknown"] = 2] = "Unknown";
	TypeFlags[TypeFlags["Undefined"] = 4] = "Undefined";
	TypeFlags[TypeFlags["Null"] = 8] = "Null";
	TypeFlags[TypeFlags["Void"] = 16] = "Void";
	TypeFlags[TypeFlags["String"] = 32] = "String";
	TypeFlags[TypeFlags["Number"] = 64] = "Number";
	TypeFlags[TypeFlags["BigInt"] = 128] = "BigInt";
	TypeFlags[TypeFlags["Boolean"] = 256] = "Boolean";
	TypeFlags[TypeFlags["ESSymbol"] = 512] = "ESSymbol";
	TypeFlags[TypeFlags["StringLiteral"] = 1024] = "StringLiteral";
	TypeFlags[TypeFlags["NumberLiteral"] = 2048] = "NumberLiteral";
	TypeFlags[TypeFlags["BigIntLiteral"] = 4096] = "BigIntLiteral";
	TypeFlags[TypeFlags["BooleanLiteral"] = 8192] = "BooleanLiteral";
	TypeFlags[TypeFlags["UniqueESSymbol"] = 16384] = "UniqueESSymbol";
	TypeFlags[TypeFlags["EnumLiteral"] = 32768] = "EnumLiteral";
	TypeFlags[TypeFlags["Enum"] = 65536] = "Enum";
	TypeFlags[TypeFlags["NonPrimitive"] = 131072] = "NonPrimitive";
	TypeFlags[TypeFlags["Never"] = 262144] = "Never";
	TypeFlags[TypeFlags["TypeParameter"] = 524288] = "TypeParameter";
	TypeFlags[TypeFlags["Object"] = 1048576] = "Object";
	TypeFlags[TypeFlags["Index"] = 2097152] = "Index";
	TypeFlags[TypeFlags["TemplateLiteral"] = 4194304] = "TemplateLiteral";
	TypeFlags[TypeFlags["StringMapping"] = 8388608] = "StringMapping";
	TypeFlags[TypeFlags["Substitution"] = 16777216] = "Substitution";
	TypeFlags[TypeFlags["IndexedAccess"] = 33554432] = "IndexedAccess";
	TypeFlags[TypeFlags["Conditional"] = 67108864] = "Conditional";
	TypeFlags[TypeFlags["Union"] = 134217728] = "Union";
	TypeFlags[TypeFlags["Intersection"] = 268435456] = "Intersection";
	TypeFlags[TypeFlags["Reserved1"] = 536870912] = "Reserved1";
	TypeFlags[TypeFlags["Reserved2"] = 1073741824] = "Reserved2";
	TypeFlags[TypeFlags["Reserved3"] = -2147483648] = "Reserved3";
	TypeFlags[TypeFlags["AnyOrUnknown"] = 3] = "AnyOrUnknown";
	TypeFlags[TypeFlags["Nullable"] = 12] = "Nullable";
	TypeFlags[TypeFlags["Literal"] = 15360] = "Literal";
	TypeFlags[TypeFlags["Unit"] = 97292] = "Unit";
	TypeFlags[TypeFlags["Freshable"] = 80896] = "Freshable";
	TypeFlags[TypeFlags["StringOrNumberLiteral"] = 3072] = "StringOrNumberLiteral";
	TypeFlags[TypeFlags["StringOrNumberLiteralOrUnique"] = 19456] = "StringOrNumberLiteralOrUnique";
	TypeFlags[TypeFlags["DefinitelyFalsy"] = 15388] = "DefinitelyFalsy";
	TypeFlags[TypeFlags["PossiblyFalsy"] = 15868] = "PossiblyFalsy";
	TypeFlags[TypeFlags["Intrinsic"] = 393983] = "Intrinsic";
	TypeFlags[TypeFlags["StringLike"] = 12583968] = "StringLike";
	TypeFlags[TypeFlags["NumberLike"] = 67648] = "NumberLike";
	TypeFlags[TypeFlags["BigIntLike"] = 4224] = "BigIntLike";
	TypeFlags[TypeFlags["BooleanLike"] = 8448] = "BooleanLike";
	TypeFlags[TypeFlags["EnumLike"] = 98304] = "EnumLike";
	TypeFlags[TypeFlags["ESSymbolLike"] = 16896] = "ESSymbolLike";
	TypeFlags[TypeFlags["VoidLike"] = 20] = "VoidLike";
	TypeFlags[TypeFlags["Primitive"] = 12713980] = "Primitive";
	TypeFlags[TypeFlags["DefinitelyNonNullable"] = 13893600] = "DefinitelyNonNullable";
	TypeFlags[TypeFlags["DisjointDomains"] = 12812284] = "DisjointDomains";
	TypeFlags[TypeFlags["UnionOrIntersection"] = 402653184] = "UnionOrIntersection";
	TypeFlags[TypeFlags["StructuredType"] = 403701760] = "StructuredType";
	TypeFlags[TypeFlags["TypeVariable"] = 34078720] = "TypeVariable";
	TypeFlags[TypeFlags["InstantiableNonPrimitive"] = 117964800] = "InstantiableNonPrimitive";
	TypeFlags[TypeFlags["InstantiablePrimitive"] = 14680064] = "InstantiablePrimitive";
	TypeFlags[TypeFlags["Instantiable"] = 132644864] = "Instantiable";
	TypeFlags[TypeFlags["StructuredOrInstantiable"] = 536346624] = "StructuredOrInstantiable";
	TypeFlags[TypeFlags["ObjectFlagsType"] = 403963917] = "ObjectFlagsType";
	TypeFlags[TypeFlags["Simplifiable"] = 102760448] = "Simplifiable";
	TypeFlags[TypeFlags["Singleton"] = 394239] = "Singleton";
	TypeFlags[TypeFlags["Narrowable"] = 536575971] = "Narrowable";
	TypeFlags[TypeFlags["IncludesMask"] = 416808959] = "IncludesMask";
	TypeFlags[TypeFlags["IncludesMissingType"] = 524288] = "IncludesMissingType";
	TypeFlags[TypeFlags["IncludesNonWideningType"] = 2097152] = "IncludesNonWideningType";
	TypeFlags[TypeFlags["IncludesWildcard"] = 33554432] = "IncludesWildcard";
	TypeFlags[TypeFlags["IncludesEmptyObject"] = 67108864] = "IncludesEmptyObject";
	TypeFlags[TypeFlags["IncludesInstantiable"] = 16777216] = "IncludesInstantiable";
	TypeFlags[TypeFlags["IncludesConstrainedTypeVariable"] = 536870912] = "IncludesConstrainedTypeVariable";
	TypeFlags[TypeFlags["IncludesError"] = 1073741824] = "IncludesError";
	TypeFlags[TypeFlags["NotPrimitiveUnion"] = 286523411] = "NotPrimitiveUnion";
})(TypeFlags || (TypeFlags = {}));
//#endregion
//#region ../../node_modules/typescript/dist/enums/typePredicateKind.js
var TypePredicateKind;
(function(TypePredicateKind) {
	TypePredicateKind[TypePredicateKind["This"] = 0] = "This";
	TypePredicateKind[TypePredicateKind["Identifier"] = 1] = "Identifier";
	TypePredicateKind[TypePredicateKind["AssertsThis"] = 2] = "AssertsThis";
	TypePredicateKind[TypePredicateKind["AssertsIdentifier"] = 3] = "AssertsIdentifier";
})(TypePredicateKind || (TypePredicateKind = {}));
//#endregion
//#region ../../node_modules/typescript/dist/api/node/protocol.generated.js
const childProperties = {
	[SyntaxKind.QualifiedName]: ["left", "right"],
	[SyntaxKind.ComputedPropertyName]: ["expression"],
	[SyntaxKind.Decorator]: ["expression"],
	[SyntaxKind.IfStatement]: [
		"expression",
		"thenStatement",
		"elseStatement"
	],
	[SyntaxKind.DoStatement]: ["statement", "expression"],
	[SyntaxKind.WhileStatement]: ["expression", "statement"],
	[SyntaxKind.ForStatement]: [
		"initializer",
		"condition",
		"incrementor",
		"statement"
	],
	[SyntaxKind.ForInStatement]: [
		"awaitModifier",
		"initializer",
		"expression",
		"statement"
	],
	[SyntaxKind.ForOfStatement]: [
		"awaitModifier",
		"initializer",
		"expression",
		"statement"
	],
	[SyntaxKind.BreakStatement]: ["label"],
	[SyntaxKind.ContinueStatement]: ["label"],
	[SyntaxKind.ReturnStatement]: ["expression"],
	[SyntaxKind.WithStatement]: ["expression", "statement"],
	[SyntaxKind.SwitchStatement]: ["expression", "caseBlock"],
	[SyntaxKind.CaseBlock]: ["clauses"],
	[SyntaxKind.CaseClause]: ["expression", "statements"],
	[SyntaxKind.DefaultClause]: ["expression", "statements"],
	[SyntaxKind.ThrowStatement]: ["expression"],
	[SyntaxKind.TryStatement]: [
		"tryBlock",
		"catchClause",
		"finallyBlock"
	],
	[SyntaxKind.CatchClause]: ["variableDeclaration", "block"],
	[SyntaxKind.LabeledStatement]: ["label", "statement"],
	[SyntaxKind.ExpressionStatement]: ["expression"],
	[SyntaxKind.Block]: ["statements"],
	[SyntaxKind.VariableStatement]: ["modifiers", "declarationList"],
	[SyntaxKind.VariableDeclaration]: [
		"name",
		"exclamationToken",
		"type",
		"initializer"
	],
	[SyntaxKind.VariableDeclarationList]: ["declarations"],
	[SyntaxKind.ObjectBindingPattern]: ["elements"],
	[SyntaxKind.ArrayBindingPattern]: ["elements"],
	[SyntaxKind.Parameter]: [
		"modifiers",
		"dotDotDotToken",
		"name",
		"questionToken",
		"type",
		"initializer"
	],
	[SyntaxKind.BindingElement]: [
		"dotDotDotToken",
		"propertyName",
		"name",
		"initializer"
	],
	[SyntaxKind.MissingDeclaration]: ["modifiers"],
	[SyntaxKind.FunctionDeclaration]: [
		"modifiers",
		"asteriskToken",
		"name",
		"typeParameters",
		"parameters",
		"type",
		"body"
	],
	[SyntaxKind.ClassDeclaration]: [
		"modifiers",
		"name",
		"typeParameters",
		"heritageClauses",
		"members"
	],
	[SyntaxKind.ClassExpression]: [
		"modifiers",
		"name",
		"typeParameters",
		"heritageClauses",
		"members"
	],
	[SyntaxKind.HeritageClause]: ["types"],
	[SyntaxKind.InterfaceDeclaration]: [
		"modifiers",
		"name",
		"typeParameters",
		"heritageClauses",
		"members"
	],
	[SyntaxKind.TypeAliasDeclaration]: [
		"modifiers",
		"name",
		"typeParameters",
		"type"
	],
	[SyntaxKind.JSTypeAliasDeclaration]: [
		"modifiers",
		"name",
		"typeParameters",
		"type"
	],
	[SyntaxKind.EnumMember]: ["name", "initializer"],
	[SyntaxKind.EnumDeclaration]: [
		"modifiers",
		"name",
		"members"
	],
	[SyntaxKind.ModuleBlock]: ["statements"],
	[SyntaxKind.ImportDeclaration]: [
		"modifiers",
		"importClause",
		"moduleSpecifier",
		"attributes"
	],
	[SyntaxKind.JSImportDeclaration]: [
		"modifiers",
		"importClause",
		"moduleSpecifier",
		"attributes"
	],
	[SyntaxKind.ExternalModuleReference]: ["expression"],
	[SyntaxKind.NamespaceImport]: ["name"],
	[SyntaxKind.NamedImports]: ["elements"],
	[SyntaxKind.ExportAssignment]: [
		"modifiers",
		"type",
		"expression"
	],
	[SyntaxKind.NamespaceExportDeclaration]: ["modifiers", "name"],
	[SyntaxKind.NamespaceExport]: ["name"],
	[SyntaxKind.NamedExports]: ["elements"],
	[SyntaxKind.ExportSpecifier]: ["propertyName", "name"],
	[SyntaxKind.CallSignature]: [
		"typeParameters",
		"parameters",
		"type"
	],
	[SyntaxKind.ConstructSignature]: [
		"typeParameters",
		"parameters",
		"type"
	],
	[SyntaxKind.Constructor]: [
		"modifiers",
		"typeParameters",
		"parameters",
		"type",
		"body"
	],
	[SyntaxKind.GetAccessor]: [
		"modifiers",
		"name",
		"typeParameters",
		"parameters",
		"type",
		"body"
	],
	[SyntaxKind.SetAccessor]: [
		"modifiers",
		"name",
		"typeParameters",
		"parameters",
		"type",
		"body"
	],
	[SyntaxKind.IndexSignature]: [
		"modifiers",
		"parameters",
		"type"
	],
	[SyntaxKind.MethodSignature]: [
		"modifiers",
		"name",
		"postfixToken",
		"typeParameters",
		"parameters",
		"type"
	],
	[SyntaxKind.MethodDeclaration]: [
		"modifiers",
		"asteriskToken",
		"name",
		"postfixToken",
		"typeParameters",
		"parameters",
		"type",
		"body"
	],
	[SyntaxKind.PropertySignature]: [
		"modifiers",
		"name",
		"postfixToken",
		"type",
		"initializer"
	],
	[SyntaxKind.PropertyDeclaration]: [
		"modifiers",
		"name",
		"postfixToken",
		"type",
		"initializer"
	],
	[SyntaxKind.ClassStaticBlockDeclaration]: ["modifiers", "body"],
	[SyntaxKind.BinaryExpression]: [
		"modifiers",
		"left",
		"type",
		"operatorToken",
		"right"
	],
	[SyntaxKind.PrefixUnaryExpression]: ["operand"],
	[SyntaxKind.PostfixUnaryExpression]: ["operand"],
	[SyntaxKind.YieldExpression]: ["asteriskToken", "expression"],
	[SyntaxKind.ArrowFunction]: [
		"modifiers",
		"typeParameters",
		"parameters",
		"type",
		"equalsGreaterThanToken",
		"body"
	],
	[SyntaxKind.FunctionExpression]: [
		"modifiers",
		"asteriskToken",
		"name",
		"typeParameters",
		"parameters",
		"type",
		"body"
	],
	[SyntaxKind.AsExpression]: ["expression", "type"],
	[SyntaxKind.SatisfiesExpression]: ["expression", "type"],
	[SyntaxKind.ConditionalExpression]: [
		"condition",
		"questionToken",
		"whenTrue",
		"colonToken",
		"whenFalse"
	],
	[SyntaxKind.PropertyAccessExpression]: [
		"expression",
		"questionDotToken",
		"name"
	],
	[SyntaxKind.ElementAccessExpression]: [
		"expression",
		"questionDotToken",
		"argumentExpression"
	],
	[SyntaxKind.CallExpression]: [
		"expression",
		"questionDotToken",
		"typeArguments",
		"arguments"
	],
	[SyntaxKind.NewExpression]: [
		"expression",
		"typeArguments",
		"arguments"
	],
	[SyntaxKind.MetaProperty]: ["name"],
	[SyntaxKind.NonNullExpression]: ["expression"],
	[SyntaxKind.SpreadElement]: ["expression"],
	[SyntaxKind.TemplateExpression]: ["head", "templateSpans"],
	[SyntaxKind.TemplateSpan]: ["expression", "literal"],
	[SyntaxKind.TaggedTemplateExpression]: [
		"tag",
		"questionDotToken",
		"typeArguments",
		"template"
	],
	[SyntaxKind.ParenthesizedExpression]: ["expression"],
	[SyntaxKind.ArrayLiteralExpression]: ["elements"],
	[SyntaxKind.ObjectLiteralExpression]: ["properties"],
	[SyntaxKind.SpreadAssignment]: ["expression"],
	[SyntaxKind.PropertyAssignment]: [
		"modifiers",
		"name",
		"postfixToken",
		"type",
		"initializer"
	],
	[SyntaxKind.ShorthandPropertyAssignment]: [
		"modifiers",
		"name",
		"postfixToken",
		"type",
		"equalsToken",
		"objectAssignmentInitializer"
	],
	[SyntaxKind.DeleteExpression]: ["expression"],
	[SyntaxKind.TypeOfExpression]: ["expression"],
	[SyntaxKind.VoidExpression]: ["expression"],
	[SyntaxKind.AwaitExpression]: ["expression"],
	[SyntaxKind.TypeAssertionExpression]: ["type", "expression"],
	[SyntaxKind.UnionType]: ["types"],
	[SyntaxKind.IntersectionType]: ["types"],
	[SyntaxKind.ConditionalType]: [
		"checkType",
		"extendsType",
		"trueType",
		"falseType"
	],
	[SyntaxKind.TypeOperator]: ["type"],
	[SyntaxKind.InferType]: ["typeParameter"],
	[SyntaxKind.ArrayType]: ["elementType"],
	[SyntaxKind.IndexedAccessType]: ["objectType", "indexType"],
	[SyntaxKind.TypeReference]: ["typeName", "typeArguments"],
	[SyntaxKind.ExpressionWithTypeArguments]: ["expression", "typeArguments"],
	[SyntaxKind.LiteralType]: ["literal"],
	[SyntaxKind.TypePredicate]: [
		"assertsModifier",
		"parameterName",
		"type"
	],
	[SyntaxKind.ImportAttribute]: ["name", "value"],
	[SyntaxKind.ImportAttributes]: ["attributes"],
	[SyntaxKind.TypeQuery]: ["exprName", "typeArguments"],
	[SyntaxKind.MappedType]: [
		"readonlyToken",
		"typeParameter",
		"nameType",
		"questionToken",
		"type",
		"members"
	],
	[SyntaxKind.TypeLiteral]: ["members"],
	[SyntaxKind.TupleType]: ["elements"],
	[SyntaxKind.NamedTupleMember]: [
		"dotDotDotToken",
		"name",
		"questionToken",
		"type"
	],
	[SyntaxKind.OptionalType]: ["type"],
	[SyntaxKind.RestType]: ["type"],
	[SyntaxKind.ParenthesizedType]: ["type"],
	[SyntaxKind.FunctionType]: [
		"typeParameters",
		"parameters",
		"type"
	],
	[SyntaxKind.ConstructorType]: [
		"modifiers",
		"typeParameters",
		"parameters",
		"type"
	],
	[SyntaxKind.TemplateLiteralType]: ["head", "templateSpans"],
	[SyntaxKind.TemplateLiteralTypeSpan]: ["type", "literal"],
	[SyntaxKind.SyntheticExpression]: ["tupleNameSource"],
	[SyntaxKind.PartiallyEmittedExpression]: ["expression"],
	[SyntaxKind.JsxElement]: [
		"openingElement",
		"children",
		"closingElement"
	],
	[SyntaxKind.JsxAttributes]: ["properties"],
	[SyntaxKind.JsxNamespacedName]: ["namespace", "name"],
	[SyntaxKind.JsxOpeningElement]: [
		"tagName",
		"typeArguments",
		"attributes"
	],
	[SyntaxKind.JsxSelfClosingElement]: [
		"tagName",
		"typeArguments",
		"attributes"
	],
	[SyntaxKind.JsxFragment]: [
		"openingFragment",
		"children",
		"closingFragment"
	],
	[SyntaxKind.JsxAttribute]: ["name", "initializer"],
	[SyntaxKind.JsxSpreadAttribute]: ["expression"],
	[SyntaxKind.JsxClosingElement]: ["tagName"],
	[SyntaxKind.JsxExpression]: ["dotDotDotToken", "expression"],
	[SyntaxKind.SyntaxList]: ["children"],
	[SyntaxKind.JSDoc]: ["comment", "tags"],
	[SyntaxKind.JSDocTypeExpression]: ["type"],
	[SyntaxKind.JSDocNonNullableType]: ["type"],
	[SyntaxKind.JSDocNullableType]: ["type"],
	[SyntaxKind.JSDocVariadicType]: ["type"],
	[SyntaxKind.JSDocOptionalType]: ["type"],
	[SyntaxKind.JSDocTypeTag]: [
		"tagName",
		"typeExpression",
		"comment"
	],
	[SyntaxKind.JSDocUnknownTag]: ["tagName", "comment"],
	[SyntaxKind.JSDocTemplateTag]: [
		"tagName",
		"constraint",
		"typeParameters",
		"comment"
	],
	[SyntaxKind.JSDocReturnTag]: [
		"tagName",
		"typeExpression",
		"comment"
	],
	[SyntaxKind.JSDocPublicTag]: ["tagName", "comment"],
	[SyntaxKind.JSDocPrivateTag]: ["tagName", "comment"],
	[SyntaxKind.JSDocProtectedTag]: ["tagName", "comment"],
	[SyntaxKind.JSDocReadonlyTag]: ["tagName", "comment"],
	[SyntaxKind.JSDocOverrideTag]: ["tagName", "comment"],
	[SyntaxKind.JSDocDeprecatedTag]: ["tagName", "comment"],
	[SyntaxKind.JSDocSeeTag]: [
		"tagName",
		"nameExpression",
		"comment"
	],
	[SyntaxKind.JSDocImplementsTag]: [
		"tagName",
		"className",
		"comment"
	],
	[SyntaxKind.JSDocAugmentsTag]: [
		"tagName",
		"className",
		"comment"
	],
	[SyntaxKind.JSDocSatisfiesTag]: [
		"tagName",
		"typeExpression",
		"comment"
	],
	[SyntaxKind.JSDocThrowsTag]: [
		"tagName",
		"typeExpression",
		"comment"
	],
	[SyntaxKind.JSDocThisTag]: [
		"tagName",
		"typeExpression",
		"comment"
	],
	[SyntaxKind.JSDocImportTag]: [
		"tagName",
		"importClause",
		"moduleSpecifier",
		"attributes",
		"comment"
	],
	[SyntaxKind.JSDocCallbackTag]: [
		"tagName",
		"typeExpression",
		"name",
		"comment"
	],
	[SyntaxKind.JSDocOverloadTag]: [
		"tagName",
		"typeExpression",
		"comment"
	],
	[SyntaxKind.JSDocTypedefTag]: [
		"tagName",
		"typeExpression",
		"name",
		"comment"
	],
	[SyntaxKind.JSDocSignature]: [
		"typeParameters",
		"parameters",
		"type"
	],
	[SyntaxKind.JSDocNameReference]: ["name"],
	[SyntaxKind.SourceFile]: ["statements", "endOfFileToken"],
	[SyntaxKind.ModuleDeclaration]: [
		"modifiers",
		"name",
		"body"
	],
	[SyntaxKind.ImportEqualsDeclaration]: [
		"modifiers",
		"name",
		"moduleReference"
	],
	[SyntaxKind.ExportDeclaration]: [
		"modifiers",
		"exportClause",
		"moduleSpecifier",
		"attributes"
	],
	[SyntaxKind.ImportType]: [
		"argument",
		"attributes",
		"qualifier",
		"typeArguments"
	],
	[SyntaxKind.ImportClause]: ["name", "namedBindings"],
	[SyntaxKind.ImportSpecifier]: ["propertyName", "name"],
	[SyntaxKind.JSDocLink]: ["name"],
	[SyntaxKind.JSDocLinkPlain]: ["name"],
	[SyntaxKind.JSDocLinkCode]: ["name"],
	[SyntaxKind.TypeParameter]: [
		"modifiers",
		"name",
		"constraint",
		"expression",
		"defaultType"
	],
	[SyntaxKind.SyntheticReferenceExpression]: ["expression", "thisArg"],
	[SyntaxKind.JSDocTypeLiteral]: ["jsdocPropertyTags"],
	[SyntaxKind.JSDocParameterTag]: [
		"tagName",
		"name",
		"typeExpression",
		"comment"
	],
	[SyntaxKind.JSDocPropertyTag]: [
		"tagName",
		"name",
		"typeExpression",
		"comment"
	]
};
SyntaxKind.ComputedPropertyName, SyntaxKind.Decorator, SyntaxKind.BreakStatement, SyntaxKind.ContinueStatement, SyntaxKind.ReturnStatement, SyntaxKind.CaseBlock, SyntaxKind.ThrowStatement, SyntaxKind.ExpressionStatement, SyntaxKind.Block, SyntaxKind.VariableDeclarationList, SyntaxKind.ObjectBindingPattern, SyntaxKind.ArrayBindingPattern, SyntaxKind.MissingDeclaration, SyntaxKind.HeritageClause, SyntaxKind.ModuleBlock, SyntaxKind.ExternalModuleReference, SyntaxKind.NamespaceImport, SyntaxKind.NamedImports, SyntaxKind.NamespaceExport, SyntaxKind.NamedExports, SyntaxKind.PrefixUnaryExpression, SyntaxKind.PostfixUnaryExpression, SyntaxKind.MetaProperty, SyntaxKind.NonNullExpression, SyntaxKind.SpreadElement, SyntaxKind.ParenthesizedExpression, SyntaxKind.ArrayLiteralExpression, SyntaxKind.ObjectLiteralExpression, SyntaxKind.SpreadAssignment, SyntaxKind.DeleteExpression, SyntaxKind.TypeOfExpression, SyntaxKind.VoidExpression, SyntaxKind.AwaitExpression, SyntaxKind.UnionType, SyntaxKind.IntersectionType, SyntaxKind.TypeOperator, SyntaxKind.InferType, SyntaxKind.ArrayType, SyntaxKind.LiteralType, SyntaxKind.ImportAttributes, SyntaxKind.TypeLiteral, SyntaxKind.TupleType, SyntaxKind.OptionalType, SyntaxKind.RestType, SyntaxKind.ParenthesizedType, SyntaxKind.SyntheticExpression, SyntaxKind.PartiallyEmittedExpression, SyntaxKind.JsxAttributes, SyntaxKind.JsxSpreadAttribute, SyntaxKind.JsxClosingElement, SyntaxKind.SyntaxList, SyntaxKind.JSDocTypeExpression, SyntaxKind.JSDocNonNullableType, SyntaxKind.JSDocNullableType, SyntaxKind.JSDocVariadicType, SyntaxKind.JSDocOptionalType, SyntaxKind.JSDocNameReference, SyntaxKind.JSDocLink, SyntaxKind.JSDocLinkPlain, SyntaxKind.JSDocLinkCode, SyntaxKind.JSDocTypeLiteral;
//#endregion
//#region ../../node_modules/typescript/dist/api/node/protocol.js
const KIND_NODE_LIST = 4294967295;
const NODE_DATA_TYPE_STRING = 1073741824;
const NODE_DATA_TYPE_EXTENDED = 2147483648;
//#endregion
//#region ../../node_modules/typescript/dist/api/node/encoder.generated.js
function getNodeDataType(kind) {
	switch (kind) {
		case SyntaxKind.Identifier:
		case SyntaxKind.PrivateIdentifier:
		case SyntaxKind.JsxText:
		case SyntaxKind.JSDocText:
		case SyntaxKind.JSDocLink:
		case SyntaxKind.JSDocLinkPlain:
		case SyntaxKind.JSDocLinkCode: return NODE_DATA_TYPE_STRING;
		case SyntaxKind.StringLiteral:
		case SyntaxKind.NumericLiteral:
		case SyntaxKind.BigIntLiteral:
		case SyntaxKind.RegularExpressionLiteral:
		case SyntaxKind.NoSubstitutionTemplateLiteral:
		case SyntaxKind.TemplateHead:
		case SyntaxKind.TemplateMiddle:
		case SyntaxKind.TemplateTail:
		case SyntaxKind.SourceFile: return NODE_DATA_TYPE_EXTENDED;
		default: return 0;
	}
}
function getNodeCommonData(node) {
	switch (node.kind) {
		case SyntaxKind.Block: return (node.multiLine ? 1 : 0) << 24;
		case SyntaxKind.HeritageClause: return (node.token === SyntaxKind.ImplementsKeyword ? 1 : 0) << 24;
		case SyntaxKind.ExportAssignment: return (node.isExportEquals ? 1 : 0) << 24;
		case SyntaxKind.ExportSpecifier: return (node.isTypeOnly ? 1 : 0) << 24;
		case SyntaxKind.PrefixUnaryExpression: return (node.operator === SyntaxKind.MinusToken ? 1 : node.operator === SyntaxKind.TildeToken ? 2 : node.operator === SyntaxKind.ExclamationToken ? 3 : node.operator === SyntaxKind.PlusPlusToken ? 4 : node.operator === SyntaxKind.MinusMinusToken ? 5 : 0) << 24;
		case SyntaxKind.PostfixUnaryExpression: return (node.operator === SyntaxKind.MinusMinusToken ? 1 : 0) << 24;
		case SyntaxKind.MetaProperty: return (node.keywordToken === SyntaxKind.NewKeyword ? 1 : 0) << 24;
		case SyntaxKind.ArrayLiteralExpression: return (node.multiLine ? 1 : 0) << 24;
		case SyntaxKind.ObjectLiteralExpression: return (node.multiLine ? 1 : 0) << 24;
		case SyntaxKind.TypeOperator: return (node.operator === SyntaxKind.ReadonlyKeyword ? 1 : node.operator === SyntaxKind.UniqueKeyword ? 2 : 0) << 24;
		case SyntaxKind.ImportAttributes: return (node.multiLine ? 1 : 0) << 24 | (node.token === SyntaxKind.AssertKeyword ? 1 : 0) << 25;
		case SyntaxKind.JsxText: return (node.containsOnlyTriviaWhiteSpaces ? 1 : 0) << 24;
		case SyntaxKind.ModuleDeclaration: return (node.keyword === SyntaxKind.NamespaceKeyword ? 1 : 0) << 24;
		case SyntaxKind.ImportEqualsDeclaration: return (node.isTypeOnly ? 1 : 0) << 24;
		case SyntaxKind.ExportDeclaration: return (node.isTypeOnly ? 1 : 0) << 24;
		case SyntaxKind.ImportType: return (node.isTypeOf ? 1 : 0) << 24;
		case SyntaxKind.ImportClause: return (node.phaseModifier === SyntaxKind.TypeKeyword ? 1 : node.phaseModifier === SyntaxKind.DeferKeyword ? 2 : 0) << 24;
		case SyntaxKind.ImportSpecifier: return (node.isTypeOnly ? 1 : 0) << 24;
		case SyntaxKind.JSDocTypeLiteral: return (node.isArrayType ? 1 : 0) << 24;
		case SyntaxKind.JSDocParameterTag:
		case SyntaxKind.JSDocPropertyTag: return (node.isBracketed ? 1 : 0) << 24 | (node.isNameFirst ? 1 : 0) << 25;
	}
	return 0;
}
//#endregion
//#region ../../node_modules/typescript/dist/api/node/wtf8.js
const surrogateLeadByte = 237;
const surrogateSecondByteMin = 160;
const surrogateSecondByteMax = 191;
const continuationByteMin = 128;
const continuationByteMax = 191;
function isWtf8Surrogate(bytes, index) {
	return index + 2 < bytes.length && bytes[index] === surrogateLeadByte && bytes[index + 1] >= surrogateSecondByteMin && bytes[index + 1] <= surrogateSecondByteMax && bytes[index + 2] >= continuationByteMin && bytes[index + 2] <= continuationByteMax;
}
function getSurrogateCodeUnit(bytes, index) {
	return 53248 | (bytes[index + 1] & 63) << 6 | bytes[index + 2] & 63;
}
function hasSurrogateLeadByte(bytes) {
	return Buffer$1.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).indexOf(surrogateLeadByte) >= 0;
}
function toUint8Array(input) {
	if (input instanceof Uint8Array) return input;
	if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
	return new Uint8Array(input);
}
var Wtf8Decoder = class extends TextDecoder {
	decode(input, options) {
		if (input === void 0) return super.decode(input, options);
		const bytes = toUint8Array(input);
		if (!hasSurrogateLeadByte(bytes)) return super.decode(bytes, options);
		const parts = [];
		let segmentStart = 0;
		for (let i = 0; i < bytes.length; i++) {
			if (!isWtf8Surrogate(bytes, i)) continue;
			if (segmentStart < i) parts.push(super.decode(bytes.subarray(segmentStart, i), options));
			parts.push(String.fromCharCode(getSurrogateCodeUnit(bytes, i)));
			i += 2;
			segmentStart = i + 1;
		}
		if (segmentStart === 0) return super.decode(bytes, options);
		if (segmentStart < bytes.length) parts.push(super.decode(bytes.subarray(segmentStart), options));
		return parts.join("");
	}
};
/** Compute the MessagePack bin header size for a given data length. */
function binHeaderSize(len) {
	if (len < 256) return 2;
	if (len < 65536) return 3;
	return 5;
}
/** Write a MessagePack bin header into `buf` at `off`, return new offset. */
function writeBinHeader(buf, off, len) {
	if (len < 256) {
		buf[off++] = 196;
		buf[off++] = len;
	} else if (len < 65536) {
		buf[off++] = 197;
		buf[off++] = len >>> 8 & 255;
		buf[off++] = len & 255;
	} else {
		buf[off++] = 198;
		buf[off++] = len >>> 24 & 255;
		buf[off++] = len >>> 16 & 255;
		buf[off++] = len >>> 8 & 255;
		buf[off++] = len & 255;
	}
	return off;
}
const encoder = new TextEncoder();
const decoder = new Wtf8Decoder();
var MsgpackWriter = class {
	buf;
	view;
	pos;
	constructor(initialSize = 256) {
		this.buf = new Uint8Array(initialSize);
		this.view = new DataView(this.buf.buffer);
		this.pos = 0;
	}
	ensure(n) {
		if (this.pos + n > this.buf.length) {
			let newSize = this.buf.length * 2;
			while (newSize < this.pos + n) newSize *= 2;
			const next = new Uint8Array(newSize);
			next.set(this.buf);
			this.buf = next;
			this.view = new DataView(this.buf.buffer);
		}
	}
	writeArrayHeader(length) {
		if (length <= 15) {
			this.ensure(1);
			this.buf[this.pos++] = 144 | length;
		} else if (length <= 65535) {
			this.ensure(3);
			this.buf[this.pos++] = 220;
			this.view.setUint16(this.pos, length, false);
			this.pos += 2;
		} else {
			this.ensure(5);
			this.buf[this.pos++] = 221;
			this.view.setUint32(this.pos, length, false);
			this.pos += 4;
		}
	}
	writeUint(value) {
		if (value <= 127) {
			this.ensure(1);
			this.buf[this.pos++] = value;
		} else if (value <= 255) {
			this.ensure(2);
			this.buf[this.pos++] = 204;
			this.buf[this.pos++] = value;
		} else if (value <= 65535) {
			this.ensure(3);
			this.buf[this.pos++] = 205;
			this.view.setUint16(this.pos, value, false);
			this.pos += 2;
		} else {
			this.ensure(5);
			this.buf[this.pos++] = 206;
			this.view.setUint32(this.pos, value, false);
			this.pos += 4;
		}
	}
	writeString(str) {
		const encoded = encoder.encode(str);
		const len = encoded.length;
		if (len <= 31) {
			this.ensure(1 + len);
			this.buf[this.pos++] = 160 | len;
		} else if (len <= 255) {
			this.ensure(2 + len);
			this.buf[this.pos++] = 217;
			this.buf[this.pos++] = len;
		} else if (len <= 65535) {
			this.ensure(3 + len);
			this.buf[this.pos++] = 218;
			this.view.setUint16(this.pos, len, false);
			this.pos += 2;
		} else {
			this.ensure(5 + len);
			this.buf[this.pos++] = 219;
			this.view.setUint32(this.pos, len, false);
			this.pos += 4;
		}
		this.buf.set(encoded, this.pos);
		this.pos += len;
	}
	writeBool(value) {
		this.ensure(1);
		this.buf[this.pos++] = value ? 195 : 194;
	}
	finish() {
		return this.buf.subarray(0, this.pos);
	}
};
var MsgpackReader = class {
	buf;
	view;
	pos;
	constructor(data, offset = 0) {
		this.buf = data;
		this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
		this.pos = offset;
	}
	readArrayHeader() {
		const byte = this.buf[this.pos++];
		if ((byte & 240) === 144) return byte & 15;
		if (byte === 220) {
			const len = this.view.getUint16(this.pos, false);
			this.pos += 2;
			return len;
		}
		if (byte === 221) {
			const len = this.view.getUint32(this.pos, false);
			this.pos += 4;
			return len;
		}
		throw new Error(`Expected array header, got 0x${byte.toString(16)}`);
	}
	readUint() {
		const byte = this.buf[this.pos++];
		if (byte <= 127) return byte;
		if (byte === 204) return this.buf[this.pos++];
		if (byte === 205) {
			const val = this.view.getUint16(this.pos, false);
			this.pos += 2;
			return val;
		}
		if (byte === 206) {
			const val = this.view.getUint32(this.pos, false);
			this.pos += 4;
			return val;
		}
		throw new Error(`Expected uint, got 0x${byte.toString(16)}`);
	}
	readString() {
		const byte = this.buf[this.pos++];
		let len;
		if ((byte & 224) === 160) len = byte & 31;
		else if (byte === 217) len = this.buf[this.pos++];
		else if (byte === 218) {
			len = this.view.getUint16(this.pos, false);
			this.pos += 2;
		} else if (byte === 219) {
			len = this.view.getUint32(this.pos, false);
			this.pos += 4;
		} else throw new Error(`Expected string, got 0x${byte.toString(16)}`);
		const str = decoder.decode(this.buf.subarray(this.pos, this.pos + len));
		this.pos += len;
		return str;
	}
	readBool() {
		const byte = this.buf[this.pos++];
		if (byte === 195) return true;
		if (byte === 194) return false;
		throw new Error(`Expected bool, got 0x${byte.toString(16)}`);
	}
};
//#endregion
//#region ../../node_modules/typescript/dist/api/node/encoder.js
const NODE_FIELDS = 7;
const NODE_FIELD_NEXT = 3;
const NO_STRUCTURED_DATA$1 = 4294967295;
var StringTable = class {
	parts;
	byteLen;
	offsets;
	constructor() {
		this.parts = [];
		this.byteLen = 0;
		this.offsets = [];
	}
	add(text) {
		const index = this.offsets.length;
		const encodedLength = cachedEncoder().encode(text).length;
		const offset = this.byteLen;
		this.parts.push(text);
		this.byteLen += encodedLength;
		this.offsets.push(offset, offset + encodedLength);
		return index;
	}
	encode() {
		const dataBytes = cachedEncoder().encode(this.parts.join(""));
		const offsetBytes = new Uint8Array(this.offsets.length * 4);
		const view = new DataView(offsetBytes.buffer);
		for (let i = 0; i < this.offsets.length; i++) view.setUint32(i * 4, this.offsets[i], true);
		const result = new Uint8Array(offsetBytes.length + dataBytes.length);
		result.set(offsetBytes, 0);
		result.set(dataBytes, offsetBytes.length);
		return result;
	}
	stringByteLength() {
		return this.byteLen;
	}
	offsetsCount() {
		return this.offsets.length;
	}
};
let _encoder;
function cachedEncoder() {
	return _encoder ??= new TextEncoder();
}
function getChildrenPropertyMask(node) {
	const kind = node.kind;
	const props = childProperties[kind];
	if (!props) return 0;
	const n = node;
	let mask = 0;
	for (let i = 0; i < props.length; i++) {
		const prop = props[i];
		if (prop !== void 0 && isChildPresent(n[prop])) mask |= 1 << i;
	}
	return mask;
}
function isChildPresent(v) {
	if (v === void 0 || v === null) return false;
	return true;
}
function recordNodeStrings(node, strs) {
	return strs.add(node.text ?? "");
}
function encodeFileReferences(refs, writer) {
	if (!refs || refs.length === 0) return NO_STRUCTURED_DATA$1;
	const offset = writer.finish().length;
	writer.writeArrayHeader(refs.length);
	for (const ref of refs) {
		writer.writeArrayHeader(5);
		writer.writeUint(ref.pos);
		writer.writeUint(ref.end);
		writer.writeString(ref.fileName);
		writer.writeUint(ref.resolutionMode ?? 0);
		writer.writeBool(ref.preserve ?? false);
	}
	return offset;
}
function recordExtendedData(node, strs, extendedData, structuredWriter) {
	const offset = extendedData.length * 4;
	if (node.kind === SyntaxKind.SourceFile) {
		const sf = node;
		const textIndex = strs.add(sf.text);
		const fileNameIndex = strs.add(sf.fileName);
		const pathIndex = strs.add(sf.path);
		const referencedFilesOffset = encodeFileReferences(sf.referencedFiles, structuredWriter);
		const typeRefDirectivesOffset = encodeFileReferences(sf.typeReferenceDirectives, structuredWriter);
		const libRefDirectivesOffset = encodeFileReferences(sf.libReferenceDirectives, structuredWriter);
		extendedData.push(textIndex, fileNameIndex, pathIndex, sf.languageVariant, sf.scriptKind, referencedFilesOffset, typeRefDirectivesOffset, libRefDirectivesOffset, NO_STRUCTURED_DATA$1, NO_STRUCTURED_DATA$1, NO_STRUCTURED_DATA$1, 0);
	} else if (node.kind === SyntaxKind.TemplateHead || node.kind === SyntaxKind.TemplateMiddle || node.kind === SyntaxKind.TemplateTail) {
		const tmpl = node;
		const text = tmpl.text ?? "";
		const rawText = tmpl.rawText ?? "";
		const templateFlags = tmpl.templateFlags ?? 0;
		const textIndex = strs.add(text);
		const rawTextIndex = strs.add(rawText);
		extendedData.push(textIndex, rawTextIndex, templateFlags);
	} else {
		const n = node;
		const text = n.text ?? "";
		const tokenFlags = n.tokenFlags ?? 0;
		const textIndex = strs.add(text);
		extendedData.push(textIndex, tokenFlags);
	}
	return offset;
}
function getNodeData(node, strs, extendedData, structuredWriter) {
	const t = getNodeDataType(node.kind);
	const common = getNodeCommonData(node);
	switch (t) {
		case 0: return t | common | getChildrenPropertyMask(node);
		case NODE_DATA_TYPE_STRING: return t | common | recordNodeStrings(node, strs);
		case NODE_DATA_TYPE_EXTENDED: return t | common | recordExtendedData(node, strs, extendedData, structuredWriter);
		default: throw new Error("unreachable");
	}
}
function getChildPropertiesForNode(node) {
	return childProperties[node.kind];
}
function isNodeArray(value) {
	return Array.isArray(value) && typeof value.pos === "number" && typeof value.end === "number";
}
/**
* Encode an arbitrary AST node into the binary format.
* When encoding a non-SourceFile node, the header hash and parse options fields will be zero.
*/
function encodeNode(node) {
	const strs = new StringTable();
	const extendedDataValues = [];
	const structuredWriter = new MsgpackWriter();
	const nodeValues = [];
	nodeValues.push(0, 0, 0, 0, 0, 0, 0);
	let nodeCount = 0;
	let parentIndex = 0;
	let prevIndex = 0;
	function visitNode(node) {
		nodeCount++;
		const currentIndex = nodeCount;
		if (prevIndex !== 0) nodeValues[prevIndex * NODE_FIELDS + NODE_FIELD_NEXT] = currentIndex;
		const data = getNodeData(node, strs, extendedDataValues, structuredWriter);
		nodeValues.push(node.kind, node.pos >= 0 ? node.pos : 0, node.end >= 0 ? node.end : 0, 0, parentIndex, data, node.flags);
		const saveParentIndex = parentIndex;
		parentIndex = currentIndex;
		prevIndex = 0;
		visitChildren(node);
		prevIndex = currentIndex;
		parentIndex = saveParentIndex;
	}
	function visitNodeList(list) {
		if (!list) return;
		nodeCount++;
		const currentIndex = nodeCount;
		if (prevIndex !== 0) nodeValues[prevIndex * NODE_FIELDS + NODE_FIELD_NEXT] = currentIndex;
		nodeValues.push(KIND_NODE_LIST, list.pos >= 0 ? list.pos : 0, list.end >= 0 ? list.end : 0, 0, parentIndex, list.length, 0);
		const saveParentIndex = parentIndex;
		parentIndex = currentIndex;
		prevIndex = 0;
		for (const child of list) visitNode(child);
		prevIndex = currentIndex;
		parentIndex = saveParentIndex;
	}
	function visitChildren(node) {
		const props = getChildPropertiesForNode(node);
		const n = node;
		if (props) for (const propName of props) {
			if (propName === void 0) continue;
			const child = n[propName];
			if (child === void 0 || child === null) continue;
			if (isNodeArray(child)) visitNodeList(child);
			else visitNode(child);
		}
	}
	nodeCount++;
	parentIndex++;
	const rootData = getNodeData(node, strs, extendedDataValues, structuredWriter);
	nodeValues.push(node.kind, node.pos >= 0 ? node.pos : 0, node.end >= 0 ? node.end : 0, 0, 0, rootData, node.flags);
	const saveParent = parentIndex;
	prevIndex = 0;
	parentIndex = 1;
	visitChildren(node);
	parentIndex = saveParent;
	const extendedDataBytes = new Uint8Array(extendedDataValues.length * 4);
	const extView = new DataView(extendedDataBytes.buffer);
	for (let i = 0; i < extendedDataValues.length; i++) extView.setUint32(i * 4, extendedDataValues[i], true);
	const structuredDataBytes = structuredWriter.finish();
	const strsBytes = strs.encode();
	const nodesBytes = new Uint8Array(nodeValues.length * 4);
	const nodesView = new DataView(nodesBytes.buffer);
	for (let i = 0; i < nodeValues.length; i++) nodesView.setUint32(i * 4, nodeValues[i] >>> 0, true);
	const offsetStringTableOffsets = 44;
	const offsetStringTableData = 44 + strs.offsetsCount() * 4;
	const offsetExtendedData = offsetStringTableData + strs.stringByteLength();
	const offsetStructuredData = offsetExtendedData + extendedDataBytes.length;
	const offsetNodes = offsetStructuredData + structuredDataBytes.length;
	const header = /* @__PURE__ */ new Uint8Array(44);
	const headerView = new DataView(header.buffer);
	headerView.setUint32(0, 5 << 24, true);
	headerView.setUint32(24, offsetStringTableOffsets, true);
	headerView.setUint32(28, offsetStringTableData, true);
	headerView.setUint32(32, offsetExtendedData, true);
	headerView.setUint32(36, offsetStructuredData, true);
	headerView.setUint32(40, offsetNodes, true);
	const result = new Uint8Array(header.length + strsBytes.length + extendedDataBytes.length + structuredDataBytes.length + nodesBytes.length);
	result.set(header, 0);
	result.set(strsBytes, 44);
	result.set(extendedDataBytes, offsetExtendedData);
	result.set(structuredDataBytes, offsetStructuredData);
	result.set(nodesBytes, offsetNodes);
	return result;
}
/**
* Encode a Uint8Array to a base64 string.
*/
function uint8ArrayToBase64(data) {
	return Buffer.from(data).toString("base64");
}
//#endregion
//#region ../../node_modules/typescript/dist/api/node/node.infrastructure.js
const popcount8 = [
	0,
	1,
	1,
	2,
	1,
	2,
	2,
	3,
	1,
	2,
	2,
	3,
	2,
	3,
	3,
	4,
	1,
	2,
	2,
	3,
	2,
	3,
	3,
	4,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	1,
	2,
	2,
	3,
	2,
	3,
	3,
	4,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	1,
	2,
	2,
	3,
	2,
	3,
	3,
	4,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	4,
	5,
	5,
	6,
	5,
	6,
	6,
	7,
	1,
	2,
	2,
	3,
	2,
	3,
	3,
	4,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	4,
	5,
	5,
	6,
	5,
	6,
	6,
	7,
	2,
	3,
	3,
	4,
	3,
	4,
	4,
	5,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	4,
	5,
	5,
	6,
	5,
	6,
	6,
	7,
	3,
	4,
	4,
	5,
	4,
	5,
	5,
	6,
	4,
	5,
	5,
	6,
	5,
	6,
	6,
	7,
	4,
	5,
	5,
	6,
	5,
	6,
	6,
	7,
	5,
	6,
	6,
	7,
	6,
	7,
	7,
	8
];
const NODE_DATA_TYPE_MASK = 3221225472;
const NODE_STRING_INDEX_MASK = 16777215;
const NODE_EXTENDED_DATA_MASK = 16777215;
/**
* Read the 128-bit content hash from a source file binary response as a hex string.
*/
function readSourceFileHash(data) {
	const lo0 = data.getUint32(4, true);
	const lo1 = data.getUint32(8, true);
	const hi0 = data.getUint32(12, true);
	return hex8(data.getUint32(16, true)) + hex8(hi0) + hex8(lo1) + hex8(lo0);
}
/**
* Read the per-file parse options key from a source file binary response.
* This encodes the ExternalModuleIndicatorOptions bitmask as a string,
* allowing the client to distinguish files parsed with different options.
*/
function readParseOptionsKey(data) {
	return data.getUint32(20, true).toString();
}
function hex8(n) {
	return (n >>> 0).toString(16).padStart(8, "0");
}
function modifierToFlag(kind) {
	switch (kind) {
		case SyntaxKind.StaticKeyword: return ModifierFlags.Static;
		case SyntaxKind.PublicKeyword: return ModifierFlags.Public;
		case SyntaxKind.ProtectedKeyword: return ModifierFlags.Protected;
		case SyntaxKind.PrivateKeyword: return ModifierFlags.Private;
		case SyntaxKind.AbstractKeyword: return ModifierFlags.Abstract;
		case SyntaxKind.AccessorKeyword: return ModifierFlags.Accessor;
		case SyntaxKind.ExportKeyword: return ModifierFlags.Export;
		case SyntaxKind.DeclareKeyword: return ModifierFlags.Ambient;
		case SyntaxKind.ConstKeyword: return ModifierFlags.Const;
		case SyntaxKind.DefaultKeyword: return ModifierFlags.Default;
		case SyntaxKind.AsyncKeyword: return ModifierFlags.Async;
		case SyntaxKind.ReadonlyKeyword: return ModifierFlags.Readonly;
		case SyntaxKind.OverrideKeyword: return ModifierFlags.Override;
		case SyntaxKind.InKeyword: return ModifierFlags.In;
		case SyntaxKind.OutKeyword: return ModifierFlags.Out;
		case SyntaxKind.Decorator: return ModifierFlags.Decorator;
		default: return ModifierFlags.None;
	}
}
var RemoteNodeBase = class {
	parent;
	view;
	index;
	_byteIndex;
	constructor(view, index, parent, byteIndex) {
		this.view = view;
		this.index = index;
		this.parent = parent;
		this._byteIndex = byteIndex;
	}
	get kind() {
		return this.view.getUint32(this._byteIndex + 0, true);
	}
	get pos() {
		return this.view.getInt32(this._byteIndex + 4, true);
	}
	get end() {
		return this.view.getInt32(this._byteIndex + 8, true);
	}
	get next() {
		return this.view.getUint32(this._byteIndex + 12, true);
	}
	get parentIndex() {
		return this.view.getUint32(this._byteIndex + 16, true);
	}
	get data() {
		return this.view.getUint32(this._byteIndex + 20, true);
	}
	get dataType() {
		return this.data & NODE_DATA_TYPE_MASK;
	}
	get childMask() {
		if (this.dataType !== 0) return -1;
		return this.data & 255;
	}
	getFileText(start, end) {
		return this.sourceFile._decoder.decode(new Uint8Array(this.view.buffer, this.view.byteOffset + this.sourceFile._offsetStringTable + start, end - start));
	}
	get sourceFile() {
		throw new Error("sourceFile not available on base");
	}
};
//#endregion
//#region ../../node_modules/typescript/dist/api/node/node.generated.js
var RemoteNodeList = class extends Array {
	static get [Symbol.species]() {
		return Array;
	}
	parent;
	hasTrailingComma;
	transformFlags = 0;
	view;
	index;
	_byteIndex;
	_cursorIndex = 0;
	_cursorNodeIndex = 0;
	get pos() {
		return this.view.getUint32(this._byteIndex + 4, true);
	}
	get end() {
		return this.view.getUint32(this._byteIndex + 8, true);
	}
	get next() {
		return this.view.getUint32(this._byteIndex + 12, true);
	}
	get data() {
		return this.view.getUint32(this._byteIndex + 20, true);
	}
	sourceFile;
	constructor(view, index, parent, sourceFile, offsetNodes) {
		super();
		this.view = view;
		this.index = index;
		this.parent = parent;
		this.sourceFile = sourceFile;
		this._byteIndex = offsetNodes + index * 28;
		this.length = this.data;
		this._cursorNodeIndex = index + 1;
		const length = this.length;
		for (let i = 16; i < length; i++) Object.defineProperty(this, i, { get() {
			return this.at(i);
		} });
	}
	get 0() {
		return this.at(0);
	}
	get 1() {
		return this.at(1);
	}
	get 2() {
		return this.at(2);
	}
	get 3() {
		return this.at(3);
	}
	get 4() {
		return this.at(4);
	}
	get 5() {
		return this.at(5);
	}
	get 6() {
		return this.at(6);
	}
	get 7() {
		return this.at(7);
	}
	get 8() {
		return this.at(8);
	}
	get 9() {
		return this.at(9);
	}
	get 10() {
		return this.at(10);
	}
	get 11() {
		return this.at(11);
	}
	get 12() {
		return this.at(12);
	}
	get 13() {
		return this.at(13);
	}
	get 14() {
		return this.at(14);
	}
	get 15() {
		return this.at(15);
	}
	*[Symbol.iterator]() {
		if (!this.length) return;
		let next = this.index + 1;
		while (next) {
			const child = this.getOrCreateChildAtNodeIndex(next);
			next = child.next;
			yield child;
		}
	}
	forEachNode(visitNode) {
		if (!this.length) return;
		let next = this.index + 1;
		while (next) {
			const child = this.getOrCreateChildAtNodeIndex(next);
			next = child.next;
			const result = visitNode(child);
			if (result) return result;
		}
	}
	at(index) {
		if (!Number.isInteger(index)) return;
		if (index >= this.data || index < 0 && -index > this.data) return;
		if (index < 0) index = this.length + index;
		const offsetNodes = this.sourceFile._offsetNodes;
		let i;
		let next;
		if (index >= this._cursorIndex) {
			i = this._cursorIndex;
			next = this._cursorNodeIndex;
		} else {
			i = 0;
			next = this.index + 1;
		}
		for (; i < index; i++) next = this.view.getUint32(offsetNodes + next * 28 + 12, true);
		this._cursorIndex = index;
		this._cursorNodeIndex = next;
		return this.getOrCreateChildAtNodeIndex(next);
	}
	getOrCreateChildAtNodeIndex(index) {
		let child = this.sourceFile.nodes[index];
		if (!child) {
			if (this.view.getUint32(this.sourceFile._offsetNodes + index * 28 + 0, true) === 4294967295) throw new Error("NodeList cannot directly contain another NodeList");
			const sf = this.sourceFile;
			child = new RemoteNode(this.view, index, this.parent, sf, sf._offsetNodes);
			sf.nodes[index] = child;
			sf._timing?.recordMaterialization();
		}
		return child;
	}
	__print() {
		const result = [];
		result.push(`kind: NodeList`);
		result.push(`index: ${this.index}`);
		result.push(`byteIndex: ${this._byteIndex}`);
		result.push(`length: ${this.length}`);
		return result.join("\n");
	}
};
var RemoteNode = class RemoteNode extends RemoteNodeBase {
	static NODE_LEN = 28;
	get sourceFile() {
		return this._sourceFile;
	}
	_sourceFile;
	get id() {
		return `${this.index}.${this.kind}.${this.sourceFile.path}`;
	}
	constructor(view, index, parent, sourceFile, offsetNodes) {
		super(view, index, parent, offsetNodes + index * 28);
		this._sourceFile = sourceFile;
	}
	forEachChild(visitNode, visitList) {
		if (this.hasChildren()) {
			let next = this.index + 1;
			do {
				const child = this.getOrCreateChildAtNodeIndex(next);
				if (child instanceof RemoteNodeList) {
					if (visitList) {
						const result = visitList(child);
						if (result) return result;
					} else {
						const result = child.forEachNode(visitNode);
						if (result) return result;
					}
				} else if (child.kind !== SyntaxKind.JSDoc) {
					const result = visitNode(child);
					if (result) return result;
				}
				next = child.next;
			} while (next);
		}
	}
	get jsDoc() {
		if (!this.hasChildren()) return;
		let result;
		let next = this.index + 1;
		do {
			const child = this.getOrCreateChildAtNodeIndex(next);
			if (!(child instanceof RemoteNodeList) && child.kind === SyntaxKind.JSDoc) (result ??= []).push(child);
			next = child.next;
		} while (next);
		return result;
	}
	getSourceFile() {
		return this.sourceFile;
	}
	getStart(sourceFile, includeJsDocComment) {
		return getTokenPosOfNode(this, sourceFile ?? this.getSourceFile(), includeJsDocComment);
	}
	getFullStart() {
		return this.pos;
	}
	getEnd() {
		return this.end;
	}
	getWidth(sourceFile) {
		return this.getEnd() - this.getStart(sourceFile);
	}
	getFullWidth() {
		return this.end - this.pos;
	}
	getLeadingTriviaWidth(sourceFile) {
		return this.getStart(sourceFile) - this.pos;
	}
	getFullText(sourceFile) {
		return (sourceFile ?? this.getSourceFile()).text.substring(this.pos, this.end);
	}
	getText(sourceFile) {
		sourceFile ??= this.getSourceFile();
		return sourceFile.text.substring(this.getStart(sourceFile), this.end);
	}
	getString(index) {
		const offsetStringTableOffsets = this.sourceFile._offsetStringTableOffsets;
		const start = this.view.getUint32(offsetStringTableOffsets + index * 4, true);
		const end = this.view.getUint32(offsetStringTableOffsets + (index + 1) * 4, true);
		const offsetStringTable = this.sourceFile._offsetStringTable;
		const text = new Uint8Array(this.view.buffer, this.view.byteOffset + offsetStringTable + start, end - start);
		return this.sourceFile._decoder.decode(text);
	}
	getOrCreateChildAtNodeIndex(index) {
		let child = this.sourceFile.nodes[index];
		if (!child) {
			const sf = this.sourceFile;
			const offsetNodes = sf._offsetNodes;
			child = this.view.getUint32(offsetNodes + index * 28 + 0, true) === 4294967295 ? new RemoteNodeList(this.view, index, this, sf, offsetNodes) : new RemoteNode(this.view, index, this, sf, offsetNodes);
			sf.nodes[index] = child;
			sf._timing?.recordMaterialization();
		}
		return child;
	}
	hasChildren() {
		if (this._byteIndex >= this.view.byteLength - 28) return false;
		return this.view.getUint32(this.sourceFile._offsetNodes + (this.index + 1) * 28 + 16, true) === this.index;
	}
	getNamedChild(propertyName) {
		const kind = this.kind;
		const propertyNames = childProperties[kind];
		if (!propertyNames) return;
		const order = propertyNames.indexOf(propertyName);
		if (order === -1) return;
		return this.getChildAtOrder(order);
	}
	getChildAtOrder(order) {
		const mask = this.childMask;
		if (!(mask & 1 << order)) return;
		const propertyIndex = order - popcount8[~(mask | 255 << order & 255) & 255];
		let childIndex = this.index + 1;
		for (let i = 0; i < propertyIndex; i++) childIndex = this.view.getUint32(this.sourceFile._offsetNodes + childIndex * 28 + 12, true);
		return this.getOrCreateChildAtNodeIndex(childIndex);
	}
	__print() {
		const result = [];
		result.push(`index: ${this.index}`);
		result.push(`byteIndex: ${this._byteIndex}`);
		result.push(`kind: ${SyntaxKind[this.kind]}`);
		result.push(`pos: ${this.pos}`);
		result.push(`end: ${this.end}`);
		result.push(`next: ${this.next}`);
		result.push(`parent: ${this.parentIndex}`);
		result.push(`data: ${this.data.toString(2).padStart(32, "0")}`);
		const dataType = this.dataType === 0 ? "children" : this.dataType === 1073741824 ? "string" : "extended";
		result.push(`dataType: ${dataType}`);
		if (this.dataType === 0) {
			result.push(`childMask: ${this.childMask.toString(2).padStart(8, "0")}`);
			result.push(`childProperties: ${childProperties[this.kind]?.join(", ")}`);
		}
		return result.join("\n");
	}
	__printChildren() {
		const result = [];
		let next = this.index + 1;
		while (next) {
			const child = this.getOrCreateChildAtNodeIndex(next);
			next = child.next;
			result.push(child.__print());
		}
		return result.join("\n\n");
	}
	__printSubtree() {
		const result = [this.__print()];
		this.forEachChild(function visitNode(node) {
			result.push(node.__print());
			node.forEachChild(visitNode);
		}, (visitList) => {
			result.push(visitList.__print());
		});
		return result.join("\n\n");
	}
	get containsOnlyTriviaWhiteSpaces() {
		return (this.data & 1 << 24) !== 0;
	}
	get isArrayType() {
		return (this.data & 1 << 24) !== 0;
	}
	get isBracketed() {
		return (this.data & 1 << 24) !== 0;
	}
	get isExportEquals() {
		return (this.data & 1 << 24) !== 0;
	}
	get isNameFirst() {
		return (this.data & 1 << 25) !== 0;
	}
	get isTypeOf() {
		return (this.data & 1 << 24) !== 0;
	}
	get isTypeOnly() {
		return (this.data & 1 << 24) !== 0;
	}
	get multiLine() {
		return (this.data & 1 << 24) !== 0;
	}
	get keyword() {
		switch (this.kind) {
			case SyntaxKind.ModuleDeclaration: return this.data >> 24 & 1 ? SyntaxKind.NamespaceKeyword : SyntaxKind.ModuleKeyword;
		}
	}
	get keywordToken() {
		switch (this.kind) {
			case SyntaxKind.MetaProperty: return this.data >> 24 & 1 ? SyntaxKind.NewKeyword : SyntaxKind.ImportKeyword;
		}
	}
	get operator() {
		switch (this.kind) {
			case SyntaxKind.PrefixUnaryExpression: {
				const idx = this.data >> 24 & 7;
				if (idx === 1) return SyntaxKind.MinusToken;
				if (idx === 2) return SyntaxKind.TildeToken;
				if (idx === 3) return SyntaxKind.ExclamationToken;
				if (idx === 4) return SyntaxKind.PlusPlusToken;
				if (idx === 5) return SyntaxKind.MinusMinusToken;
				return SyntaxKind.PlusToken;
			}
			case SyntaxKind.PostfixUnaryExpression: return this.data >> 24 & 1 ? SyntaxKind.MinusMinusToken : SyntaxKind.PlusPlusToken;
			case SyntaxKind.TypeOperator: {
				const idx = this.data >> 24 & 3;
				if (idx === 1) return SyntaxKind.ReadonlyKeyword;
				if (idx === 2) return SyntaxKind.UniqueKeyword;
				return SyntaxKind.KeyOfKeyword;
			}
		}
	}
	get phaseModifier() {
		switch (this.kind) {
			case SyntaxKind.ImportClause: {
				const idx = this.data >> 24 & 3;
				if (idx === 0) return void 0;
				return idx === 1 ? SyntaxKind.TypeKeyword : idx === 2 ? SyntaxKind.DeferKeyword : void 0;
			}
		}
	}
	get token() {
		switch (this.kind) {
			case SyntaxKind.HeritageClause: return this.data >> 24 & 1 ? SyntaxKind.ImplementsKeyword : SyntaxKind.ExtendsKeyword;
			case SyntaxKind.ImportAttributes: return this.data >> 25 & 1 ? SyntaxKind.AssertKeyword : SyntaxKind.WithKeyword;
		}
	}
	get templateFlags() {
		switch (this.kind) {
			case SyntaxKind.TemplateHead:
			case SyntaxKind.TemplateMiddle:
			case SyntaxKind.TemplateTail:
				const extendedDataOffset = this.sourceFile._offsetExtendedData + (this.data & NODE_EXTENDED_DATA_MASK);
				return this.view.getUint32(extendedDataOffset + 8, true);
		}
	}
	get tokenFlags() {
		switch (this.kind) {
			case SyntaxKind.StringLiteral:
			case SyntaxKind.NumericLiteral:
			case SyntaxKind.BigIntLiteral:
			case SyntaxKind.RegularExpressionLiteral:
				const extendedDataOffset = this.sourceFile._offsetExtendedData + (this.data & NODE_EXTENDED_DATA_MASK);
				return this.view.getUint32(extendedDataOffset + 4, true);
			default: return 0;
		}
	}
	get argument() {
		return this.getNamedChild("argument");
	}
	get argumentExpression() {
		return this.getNamedChild("argumentExpression");
	}
	get arguments() {
		return this.getNamedChild("arguments");
	}
	get assertsModifier() {
		return this.getNamedChild("assertsModifier");
	}
	get asteriskToken() {
		return this.getNamedChild("asteriskToken");
	}
	get attributes() {
		return this.getNamedChild("attributes");
	}
	get awaitModifier() {
		return this.getNamedChild("awaitModifier");
	}
	get block() {
		return this.getNamedChild("block");
	}
	get body() {
		return this.getNamedChild("body");
	}
	get caseBlock() {
		return this.getNamedChild("caseBlock");
	}
	get catchClause() {
		return this.getNamedChild("catchClause");
	}
	get checkType() {
		return this.getNamedChild("checkType");
	}
	get children() {
		return this.getNamedChild("children");
	}
	get className() {
		return this.getNamedChild("className");
	}
	get clauses() {
		return this.getNamedChild("clauses");
	}
	get closingElement() {
		return this.getNamedChild("closingElement");
	}
	get closingFragment() {
		return this.getNamedChild("closingFragment");
	}
	get colonToken() {
		return this.getNamedChild("colonToken");
	}
	get comment() {
		return this.getNamedChild("comment");
	}
	get condition() {
		return this.getNamedChild("condition");
	}
	get constraint() {
		return this.getNamedChild("constraint");
	}
	get declarationList() {
		return this.getNamedChild("declarationList");
	}
	get declarations() {
		return this.getNamedChild("declarations");
	}
	get defaultType() {
		return this.getNamedChild("defaultType");
	}
	get dotDotDotToken() {
		return this.getNamedChild("dotDotDotToken");
	}
	get elements() {
		return this.getNamedChild("elements");
	}
	get elementType() {
		return this.getNamedChild("elementType");
	}
	get elseStatement() {
		return this.getNamedChild("elseStatement");
	}
	get endOfFileToken() {
		return this.getNamedChild("endOfFileToken");
	}
	get equalsGreaterThanToken() {
		return this.getNamedChild("equalsGreaterThanToken");
	}
	get equalsToken() {
		return this.getNamedChild("equalsToken");
	}
	get exclamationToken() {
		return this.getNamedChild("exclamationToken");
	}
	get exportClause() {
		return this.getNamedChild("exportClause");
	}
	get expression() {
		return this.getNamedChild("expression");
	}
	get exprName() {
		return this.getNamedChild("exprName");
	}
	get extendsType() {
		return this.getNamedChild("extendsType");
	}
	get falseType() {
		return this.getNamedChild("falseType");
	}
	get finallyBlock() {
		return this.getNamedChild("finallyBlock");
	}
	get head() {
		return this.getNamedChild("head");
	}
	get heritageClauses() {
		return this.getNamedChild("heritageClauses");
	}
	get importClause() {
		return this.getNamedChild("importClause");
	}
	get incrementor() {
		return this.getNamedChild("incrementor");
	}
	get indexType() {
		return this.getNamedChild("indexType");
	}
	get initializer() {
		return this.getNamedChild("initializer");
	}
	get jsdocPropertyTags() {
		return this.getNamedChild("jsdocPropertyTags");
	}
	get label() {
		return this.getNamedChild("label");
	}
	get left() {
		return this.getNamedChild("left");
	}
	get literal() {
		return this.getNamedChild("literal");
	}
	get members() {
		return this.getNamedChild("members");
	}
	get modifiers() {
		return this.getNamedChild("modifiers");
	}
	get moduleReference() {
		return this.getNamedChild("moduleReference");
	}
	get moduleSpecifier() {
		return this.getNamedChild("moduleSpecifier");
	}
	get name() {
		return this.getNamedChild("name");
	}
	get namedBindings() {
		return this.getNamedChild("namedBindings");
	}
	get nameExpression() {
		return this.getNamedChild("nameExpression");
	}
	get namespace() {
		return this.getNamedChild("namespace");
	}
	get nameType() {
		return this.getNamedChild("nameType");
	}
	get objectAssignmentInitializer() {
		return this.getNamedChild("objectAssignmentInitializer");
	}
	get objectType() {
		return this.getNamedChild("objectType");
	}
	get openingElement() {
		return this.getNamedChild("openingElement");
	}
	get openingFragment() {
		return this.getNamedChild("openingFragment");
	}
	get operand() {
		return this.getNamedChild("operand");
	}
	get operatorToken() {
		return this.getNamedChild("operatorToken");
	}
	get parameterName() {
		return this.getNamedChild("parameterName");
	}
	get parameters() {
		return this.getNamedChild("parameters");
	}
	get postfixToken() {
		return this.getNamedChild("postfixToken");
	}
	get properties() {
		return this.getNamedChild("properties");
	}
	get propertyName() {
		return this.getNamedChild("propertyName");
	}
	get qualifier() {
		return this.getNamedChild("qualifier");
	}
	get questionDotToken() {
		return this.getNamedChild("questionDotToken");
	}
	get questionToken() {
		return this.getNamedChild("questionToken");
	}
	get readonlyToken() {
		return this.getNamedChild("readonlyToken");
	}
	get right() {
		return this.getNamedChild("right");
	}
	get statement() {
		return this.getNamedChild("statement");
	}
	get statements() {
		return this.getNamedChild("statements");
	}
	get tag() {
		return this.getNamedChild("tag");
	}
	get tagName() {
		return this.getNamedChild("tagName");
	}
	get tags() {
		return this.getNamedChild("tags");
	}
	get template() {
		return this.getNamedChild("template");
	}
	get templateSpans() {
		return this.getNamedChild("templateSpans");
	}
	get thenStatement() {
		return this.getNamedChild("thenStatement");
	}
	get thisArg() {
		return this.getNamedChild("thisArg");
	}
	get trueType() {
		return this.getNamedChild("trueType");
	}
	get tryBlock() {
		return this.getNamedChild("tryBlock");
	}
	get tupleNameSource() {
		return this.getNamedChild("tupleNameSource");
	}
	get type() {
		return this.getNamedChild("type");
	}
	get typeArguments() {
		return this.getNamedChild("typeArguments");
	}
	get typeExpression() {
		return this.getNamedChild("typeExpression");
	}
	get typeName() {
		return this.getNamedChild("typeName");
	}
	get typeParameter() {
		return this.getNamedChild("typeParameter");
	}
	get typeParameters() {
		return this.getNamedChild("typeParameters");
	}
	get types() {
		return this.getNamedChild("types");
	}
	get value() {
		return this.getNamedChild("value");
	}
	get variableDeclaration() {
		return this.getNamedChild("variableDeclaration");
	}
	get whenFalse() {
		return this.getNamedChild("whenFalse");
	}
	get whenTrue() {
		return this.getNamedChild("whenTrue");
	}
	get text() {
		switch (this.kind) {
			case SyntaxKind.Identifier:
			case SyntaxKind.PrivateIdentifier:
			case SyntaxKind.JsxText:
			case SyntaxKind.JSDocText:
			case SyntaxKind.JSDocLink:
			case SyntaxKind.JSDocLinkPlain:
			case SyntaxKind.JSDocLinkCode: {
				const stringIndex = this.data & NODE_STRING_INDEX_MASK;
				return this.getString(stringIndex);
			}
			case SyntaxKind.StringLiteral:
			case SyntaxKind.NumericLiteral:
			case SyntaxKind.BigIntLiteral:
			case SyntaxKind.RegularExpressionLiteral:
			case SyntaxKind.NoSubstitutionTemplateLiteral:
			case SyntaxKind.TemplateHead:
			case SyntaxKind.TemplateMiddle:
			case SyntaxKind.TemplateTail:
			case SyntaxKind.SourceFile: {
				const extendedDataOffset = this.sourceFile._offsetExtendedData + (this.data & NODE_EXTENDED_DATA_MASK);
				const stringIndex = this.view.getUint32(extendedDataOffset, true);
				return this.getString(stringIndex);
			}
		}
	}
	get rawText() {
		switch (this.kind) {
			case SyntaxKind.TemplateHead:
			case SyntaxKind.TemplateMiddle:
			case SyntaxKind.TemplateTail:
				const extendedDataOffset = this.sourceFile._offsetExtendedData + (this.data & NODE_EXTENDED_DATA_MASK);
				const stringIndex = this.view.getUint32(extendedDataOffset + 4, true);
				return this.getString(stringIndex);
		}
	}
	get flags() {
		return this.view.getUint32(this._byteIndex + 24, true);
	}
	get modifierFlags() {
		const mods = this.modifiers;
		if (!mods) return ModifierFlags.None;
		let flags = ModifierFlags.None;
		for (const mod of mods) flags |= modifierToFlag(mod.kind);
		return flags;
	}
};
//#endregion
//#region ../../node_modules/typescript/dist/api/node/node.js
const NO_STRUCTURED_DATA = 4294967295;
var RemoteSourceFile = class extends RemoteNode {
	nodes;
	_offsetNodes;
	_offsetStringTableOffsets;
	_offsetStringTable;
	_offsetExtendedData;
	_offsetStructuredData;
	_decoder;
	_timing;
	_lineStarts;
	_cachedText;
	_cachedReferencedFiles;
	_cachedTypeReferenceDirectives;
	_cachedLibReferenceDirectives;
	_cachedImports;
	_cachedModuleAugmentations;
	_cachedAmbientModuleNames;
	constructor(data, decoder, timing) {
		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
		const offsetNodes = view.getUint32(40, true);
		super(view, 1, void 0, void 0, offsetNodes);
		this._sourceFile = this;
		this._offsetNodes = offsetNodes;
		this._offsetStringTableOffsets = view.getUint32(24, true);
		this._offsetStringTable = view.getUint32(28, true);
		this._offsetExtendedData = view.getUint32(32, true);
		this._offsetStructuredData = view.getUint32(36, true);
		this._decoder = decoder;
		this._timing = timing;
		this.nodes = Array((view.byteLength - offsetNodes) / 28);
		this.nodes[1] = this;
		timing?.recordSourceFileFetched(Math.max(0, this.nodes.length - 2));
	}
	readFileReferences(structuredDataOffset) {
		if (structuredDataOffset === NO_STRUCTURED_DATA) return [];
		const reader = new MsgpackReader(new Uint8Array(this.view.buffer, this.view.byteOffset, this.view.byteLength), this._offsetStructuredData + structuredDataOffset);
		const count = reader.readArrayHeader();
		const result = [];
		for (let i = 0; i < count; i++) {
			reader.readArrayHeader();
			const pos = reader.readUint();
			const end = reader.readUint();
			const fileName = reader.readString();
			const resolutionMode = reader.readUint();
			const preserve = reader.readBool();
			result.push({
				pos,
				end,
				fileName,
				resolutionMode,
				preserve
			});
		}
		return result;
	}
	readNodeIndexArray(structuredDataOffset) {
		if (structuredDataOffset === NO_STRUCTURED_DATA) return [];
		const reader = new MsgpackReader(new Uint8Array(this.view.buffer, this.view.byteOffset, this.view.byteLength), this._offsetStructuredData + structuredDataOffset);
		const count = reader.readArrayHeader();
		const result = [];
		for (let i = 0; i < count; i++) {
			const nodeIndex = reader.readUint();
			result.push(this.getOrCreateNodeAtIndex(nodeIndex));
		}
		return result;
	}
	readStringArray(structuredDataOffset) {
		if (structuredDataOffset === NO_STRUCTURED_DATA) return [];
		const reader = new MsgpackReader(new Uint8Array(this.view.buffer, this.view.byteOffset, this.view.byteLength), this._offsetStructuredData + structuredDataOffset);
		const count = reader.readArrayHeader();
		const result = [];
		for (let i = 0; i < count; i++) result.push(reader.readString());
		return result;
	}
	/** @internal */
	getOrCreateNodeAtIndex(index) {
		let node = this.nodes[index];
		if (!node) {
			let parentIndex = this.view.getUint32(this._offsetNodes + index * 28 + 16, true);
			while (parentIndex !== index && this.view.getUint32(this._offsetNodes + parentIndex * 28 + 0, true) === 4294967295) parentIndex = this.view.getUint32(this._offsetNodes + parentIndex * 28 + 16, true);
			const parent = parentIndex === index ? this : this.getOrCreateNodeAtIndex(parentIndex);
			node = new RemoteNode(this.view, index, parent, this, this._offsetNodes);
			this.nodes[index] = node;
			this._timing?.recordMaterialization();
		}
		return node;
	}
	get extendedDataOffset() {
		return this._offsetExtendedData + (this.data & NODE_EXTENDED_DATA_MASK);
	}
	get fileName() {
		const stringIndex = this.view.getUint32(this.extendedDataOffset + 4, true);
		return this.getString(stringIndex);
	}
	get path() {
		const stringIndex = this.view.getUint32(this.extendedDataOffset + 8, true);
		return this.getString(stringIndex);
	}
	get languageVariant() {
		return this.view.getUint32(this.extendedDataOffset + 12, true);
	}
	get scriptKind() {
		return this.view.getUint32(this.extendedDataOffset + 16, true);
	}
	get referencedFiles() {
		if (this._cachedReferencedFiles !== void 0) return this._cachedReferencedFiles;
		const offset = this.view.getUint32(this.extendedDataOffset + 20, true);
		const files = this.readFileReferences(offset);
		this._cachedReferencedFiles = files;
		return files;
	}
	get typeReferenceDirectives() {
		if (this._cachedTypeReferenceDirectives !== void 0) return this._cachedTypeReferenceDirectives;
		const offset = this.view.getUint32(this.extendedDataOffset + 24, true);
		const directives = this.readFileReferences(offset);
		this._cachedTypeReferenceDirectives = directives;
		return directives;
	}
	get libReferenceDirectives() {
		if (this._cachedLibReferenceDirectives !== void 0) return this._cachedLibReferenceDirectives;
		const offset = this.view.getUint32(this.extendedDataOffset + 28, true);
		const directives = this.readFileReferences(offset);
		this._cachedLibReferenceDirectives = directives;
		return directives;
	}
	get imports() {
		if (this._cachedImports !== void 0) return this._cachedImports;
		const offset = this.view.getUint32(this.extendedDataOffset + 32, true);
		const imports = this.readNodeIndexArray(offset);
		this._cachedImports = imports;
		return imports;
	}
	get moduleAugmentations() {
		if (this._cachedModuleAugmentations !== void 0) return this._cachedModuleAugmentations;
		const offset = this.view.getUint32(this.extendedDataOffset + 36, true);
		const moduleAugmentations = this.readNodeIndexArray(offset);
		this._cachedModuleAugmentations = moduleAugmentations;
		return moduleAugmentations;
	}
	get ambientModuleNames() {
		if (this._cachedAmbientModuleNames !== void 0) return this._cachedAmbientModuleNames;
		const offset = this.view.getUint32(this.extendedDataOffset + 40, true);
		const names = this.readStringArray(offset);
		this._cachedAmbientModuleNames = names;
		return names;
	}
	get externalModuleIndicator() {
		const nodeIndex = this.view.getUint32(this.extendedDataOffset + 44, true);
		if (nodeIndex === 0) return void 0;
		if (nodeIndex === this.index) return true;
		return this.getOrCreateNodeAtIndex(nodeIndex);
	}
	get isDeclarationFile() {
		return (this.flags & NodeFlags.Ambient) !== 0;
	}
	get text() {
		if (this._cachedText !== void 0) return this._cachedText;
		const text = super.text;
		this._cachedText = text;
		return text;
	}
	getLineStarts() {
		return this._lineStarts ??= computeLineStarts(this.text ?? "");
	}
	getLineAndCharacterOfPosition(position) {
		const lineStarts = this.getLineStarts();
		const line = computeLineOfPosition(lineStarts, position);
		return {
			line,
			character: position - lineStarts[line]
		};
	}
	getPositionOfLineAndCharacter(line, character) {
		const lineStarts = this.getLineStarts();
		if (line < 0 || line >= lineStarts.length) throw new Error(`Bad line number. Line: ${line}, lineStarts.length: ${lineStarts.length}`);
		return lineStarts[line] + character;
	}
};
/**
* Find the 0-based line number containing the given position via binary search.
* Assumes the first line starts at position 0 and `position` is non-negative.
*/
function computeLineOfPosition(lineStarts, position) {
	let low = 0;
	let high = lineStarts.length - 1;
	while (low <= high) {
		const middle = low + (high - low >> 1);
		const value = lineStarts[middle];
		if (value < position) low = middle + 1;
		else if (value > position) high = middle - 1;
		else return middle;
	}
	return low - 1;
}
/**
* Parse a node handle string into its components.
* Handle format: "index.kind.path" where path may contain dots.
*/
function parseNodeHandle(handle) {
	const firstDot = handle.indexOf(".");
	if (firstDot === -1) throw new Error(`Invalid node handle: ${handle}`);
	const secondDot = handle.indexOf(".", firstDot + 1);
	if (secondDot === -1) throw new Error(`Invalid node handle: ${handle}`);
	return {
		index: parseInt(handle.slice(0, firstDot), 10),
		kind: parseInt(handle.slice(firstDot + 1, secondDot), 10),
		path: handle.slice(secondDot + 1)
	};
}
/**
* Decode binary-encoded AST data into a Node.
* Works for any binary-encoded node, including synthetic nodes
* (e.g. from typeToTypeNode) that don't have a source file.
*/
function decodeNode(data) {
	return new RemoteSourceFile(data, new Wtf8Decoder());
}
/**
* Get the unique ID string for a remote node.
* Throws if the node is not a RemoteNode (i.e. not decoded from binary data).
*/
function getNodeId(node) {
	if (!(node instanceof RemoteNode)) throw new Error("getNodeId requires a RemoteNode");
	return node.id;
}
//#endregion
//#region ../../node_modules/typescript/dist/api/path.js
const CharacterCodesSlash = "/".charCodeAt(0);
const CharacterCodesBackslash = "\\".charCodeAt(0);
const CharacterCodesColon = ":".charCodeAt(0);
const CharacterCodesPercent = "%".charCodeAt(0);
const CharacterCodes3 = "3".charCodeAt(0);
const CharacterCodesa = "a".charCodeAt(0);
const CharacterCodesz = "z".charCodeAt(0);
const CharacterCodesA = "A".charCodeAt(0);
const CharacterCodesZ = "Z".charCodeAt(0);
const CharacterCodesDot = ".".charCodeAt(0);
const directorySeparator = "/";
const altDirectorySeparator = "\\";
const urlSchemeSeparator = "://";
const backslashRegExp = /\\/g;
const relativePathSegmentRegExp = /\/\/|(?:^|\/)\.\.?(?:$|\/)/;
/**
* Determines whether a charCode corresponds to `/` or `\\`.
*/
function isAnyDirectorySeparator(charCode) {
	return charCode === CharacterCodesSlash || charCode === CharacterCodesBackslash;
}
function isVolumeCharacter(charCode) {
	return charCode >= CharacterCodesa && charCode <= CharacterCodesz || charCode >= CharacterCodesA && charCode <= CharacterCodesZ;
}
function getFileUrlVolumeSeparatorEnd(url, start) {
	const ch0 = url.charCodeAt(start);
	if (ch0 === CharacterCodesColon) return start + 1;
	if (ch0 === CharacterCodesPercent && url.charCodeAt(start + 1) === CharacterCodes3) {
		const ch2 = url.charCodeAt(start + 2);
		if (ch2 === CharacterCodesa || ch2 === CharacterCodesA) return start + 3;
	}
	return -1;
}
/**
* Returns length of the root part of a path or URL (i.e. length of "/", "x:/", "//server/share/, file:///user/files").
*
* For example:
* ```ts
* getRootLength("a") === 0                   // ""
* getRootLength("/") === 1                   // "/"
* getRootLength("c:") === 2                  // "c:"
* getRootLength("c:d") === 0                 // ""
* getRootLength("c:/") === 3                 // "c:/"
* getRootLength("c:\\") === 3                // "c:\\"
* getRootLength("//server") === 7            // "//server"
* getRootLength("//server/share") === 8      // "//server/"
* getRootLength("\\\\server") === 7          // "\\\\server"
* getRootLength("\\\\server\\share") === 8   // "\\\\server\\"
* getRootLength("file:///path") === 8        // "file:///"
* getRootLength("file:///c:") === 10         // "file:///c:"
* getRootLength("file:///c:d") === 8         // "file:///"
* getRootLength("file:///c:/path") === 11    // "file:///c:/"
* getRootLength("file://server") === 13      // "file://server"
* getRootLength("file://server/path") === 14 // "file://server/"
* getRootLength("http://server") === 13      // "http://server"
* getRootLength("http://server/path") === 14 // "http://server/"
* ```
*
* @internal
*/
function getRootLength(path) {
	const rootLength = getEncodedRootLength(path);
	return rootLength < 0 ? ~rootLength : rootLength;
}
/**
* Returns length of the root part of a path or URL (i.e. length of "/", "x:/", "//server/share/, file:///user/files").
* If the root is part of a URL, the twos-complement of the root length is returned.
*/
function getEncodedRootLength(path) {
	if (!path) return 0;
	const ch0 = path.charCodeAt(0);
	if (ch0 === CharacterCodesSlash || ch0 === CharacterCodesBackslash) {
		if (path.charCodeAt(1) !== ch0) return 1;
		const p1 = path.indexOf(ch0 === CharacterCodesSlash ? directorySeparator : altDirectorySeparator, 2);
		if (p1 < 0) return path.length;
		return p1 + 1;
	}
	if (isVolumeCharacter(ch0) && path.charCodeAt(1) === CharacterCodesColon) {
		const ch2 = path.charCodeAt(2);
		if (ch2 === CharacterCodesSlash || ch2 === CharacterCodesBackslash) return 3;
		if (path.length === 2) return 2;
	}
	const schemeEnd = path.indexOf(urlSchemeSeparator);
	if (schemeEnd !== -1) {
		const authorityStart = schemeEnd + 3;
		const authorityEnd = path.indexOf(directorySeparator, authorityStart);
		if (authorityEnd !== -1) {
			const scheme = path.slice(0, schemeEnd);
			const authority = path.slice(authorityStart, authorityEnd);
			if (scheme === "file" && (authority === "" || authority === "localhost") && isVolumeCharacter(path.charCodeAt(authorityEnd + 1))) {
				const volumeSeparatorEnd = getFileUrlVolumeSeparatorEnd(path, authorityEnd + 2);
				if (volumeSeparatorEnd !== -1) {
					if (path.charCodeAt(volumeSeparatorEnd) === CharacterCodesSlash) return ~(volumeSeparatorEnd + 1);
					if (volumeSeparatorEnd === path.length) return ~volumeSeparatorEnd;
				}
			}
			return ~(authorityEnd + 1);
		}
		return ~path.length;
	}
	return 0;
}
/**
* Determines whether a path has a trailing separator (`/` or `\\`).
*/
function hasTrailingDirectorySeparator(path) {
	return path.length > 0 && isAnyDirectorySeparator(path.charCodeAt(path.length - 1));
}
/**
* Removes a trailing directory separator from a path, if it does not already have one.
*/
function removeTrailingDirectorySeparator(path) {
	if (hasTrailingDirectorySeparator(path)) return path.substr(0, path.length - 1);
	return path;
}
/**
* Adds a trailing directory separator to a path, if it does not already have one.
*/
function ensureTrailingDirectorySeparator(path) {
	if (!hasTrailingDirectorySeparator(path)) return path + directorySeparator;
	return path;
}
/**
* Normalize path separators, converting `\\` into `/`.
*/
function normalizeSlashes(path) {
	return path.includes("\\") ? path.replace(backslashRegExp, directorySeparator) : path;
}
/**
* Combines paths. If a path is absolute, it replaces any previous path. Relative paths are not simplified.
*/
function combinePaths(path, ...paths) {
	if (path) path = normalizeSlashes(path);
	for (let relativePath of paths) {
		if (!relativePath) continue;
		relativePath = normalizeSlashes(relativePath);
		if (!path || getRootLength(relativePath) !== 0) path = relativePath;
		else path = ensureTrailingDirectorySeparator(path) + relativePath;
	}
	return path;
}
function simpleNormalizePath(path) {
	if (!relativePathSegmentRegExp.test(path)) return path;
	let simplified = path.replace(/\/\.\//g, "/");
	if (simplified.startsWith("./")) simplified = simplified.slice(2);
	if (simplified !== path) {
		path = simplified;
		if (!relativePathSegmentRegExp.test(path)) return path;
	}
}
/**
* Returns the normalized absolute path, resolving `.` and `..` segments.
*/
function getNormalizedAbsolutePath(path, currentDirectory) {
	let rootLength = getRootLength(path);
	if (rootLength === 0 && currentDirectory) {
		path = combinePaths(currentDirectory, path);
		rootLength = getRootLength(path);
	} else path = normalizeSlashes(path);
	const simpleNormalized = simpleNormalizePath(path);
	if (simpleNormalized !== void 0) return simpleNormalized.length > rootLength ? removeTrailingDirectorySeparator(simpleNormalized) : simpleNormalized;
	const length = path.length;
	const root = path.substring(0, rootLength);
	let normalized;
	let index = rootLength;
	let segmentStart = index;
	let normalizedUpTo = index;
	let seenNonDotDotSegment = rootLength !== 0;
	while (index < length) {
		segmentStart = index;
		let ch = path.charCodeAt(index);
		while (ch === CharacterCodesSlash && index + 1 < length) {
			index++;
			ch = path.charCodeAt(index);
		}
		if (index > segmentStart) {
			normalized ??= path.substring(0, segmentStart - 1);
			segmentStart = index;
		}
		let segmentEnd = path.indexOf(directorySeparator, index + 1);
		if (segmentEnd === -1) segmentEnd = length;
		const segmentLength = segmentEnd - segmentStart;
		if (segmentLength === 1 && path.charCodeAt(index) === CharacterCodesDot) normalized ??= path.substring(0, normalizedUpTo);
		else if (segmentLength === 2 && path.charCodeAt(index) === CharacterCodesDot && path.charCodeAt(index + 1) === CharacterCodesDot) {
			if (!seenNonDotDotSegment) {
				if (normalized !== void 0) normalized += normalized.length === rootLength ? ".." : "/..";
				else normalizedUpTo = index + 2;
			} else if (normalized === void 0) {
				if (normalizedUpTo - 2 >= 0) normalized = path.substring(0, Math.max(rootLength, path.lastIndexOf(directorySeparator, normalizedUpTo - 2)));
				else normalized = path.substring(0, normalizedUpTo);
			} else {
				const lastSlash = normalized.lastIndexOf(directorySeparator);
				if (lastSlash !== -1) normalized = normalized.substring(0, Math.max(rootLength, lastSlash));
				else normalized = root;
				if (normalized.length === rootLength) seenNonDotDotSegment = rootLength !== 0;
			}
		} else if (normalized !== void 0) {
			if (normalized.length !== rootLength) normalized += directorySeparator;
			seenNonDotDotSegment = true;
			normalized += path.substring(segmentStart, segmentEnd);
		} else {
			seenNonDotDotSegment = true;
			normalizedUpTo = segmentEnd;
		}
		index = segmentEnd + 1;
	}
	return normalized ?? (length > rootLength ? removeTrailingDirectorySeparator(path) : path);
}
/**
* Normalizes a path, resolving `.` and `..` segments and converting backslashes to forward slashes.
*/
function normalizePath(path) {
	path = normalizeSlashes(path);
	let normalized = simpleNormalizePath(path);
	if (normalized !== void 0) return normalized;
	normalized = getNormalizedAbsolutePath(path, "");
	return normalized && hasTrailingDirectorySeparator(path) ? ensureTrailingDirectorySeparator(normalized) : normalized;
}
/**
* Determines whether a path is an absolute disk path (e.g. starts with `/`, or a DOS path
* like `c:`, `c:\\` or `c:/`).
*/
function isRootedDiskPath(path) {
	return getEncodedRootLength(path) > 0;
}
/**
* Converts a file name to a normalized path.
*
* @param fileName The file name to convert
* @param basePath The base path to use for relative file names
* @param getCanonicalFileName A function to get the canonical file name (e.g., toLowerCase for case-insensitive systems)
* @returns The normalized path
*/
function toPath(fileName, basePath, getCanonicalFileName) {
	return getCanonicalFileName(isRootedDiskPath(fileName) ? normalizePath(fileName) : getNormalizedAbsolutePath(fileName, basePath));
}
/**
* Creates a getCanonicalFileName function based on case sensitivity.
*/
function createGetCanonicalFileName(useCaseSensitiveFileNames) {
	return useCaseSensitiveFileNames ? identity : toLowerCase;
}
function identity(x) {
	return x;
}
function toLowerCase(s) {
	return s.toLowerCase();
}
const bundledScheme = "bundled:///";
/**
* Returns true if the path refers to a bundled library file.
*/
function isBundled(path) {
	return path.startsWith(bundledScheme);
}
/**
* Splits a Windows volume (e.g., "c:") from the rest of the path.
* Returns [volume, rest, ok] where ok is true if a volume was found.
*/
function splitVolumePath(path) {
	if (path.length >= 2 && isVolumeCharacter(path.charCodeAt(0)) && path.charCodeAt(1) === CharacterCodesColon) return [
		path.substring(0, 2).toLowerCase(),
		path.substring(2),
		true
	];
	return [
		"",
		path,
		false
	];
}
/**
* Converts a document URI to a file name.
*
* @example
* documentURIToFileName("file:///path/to/file.ts") === "/path/to/file.ts"
* documentURIToFileName("file:///c%3A/path/to/file.ts") === "c:/path/to/file.ts"
* documentURIToFileName("untitled:Untitled-1") === "^/untitled/ts-nul-authority/Untitled-1"
* documentURIToFileName("vscode-vfs://github/microsoft/typescript-go/file.ts") === "^/vscode-vfs/github/microsoft/typescript-go/file.ts"
*/
function documentURIToFileName(uri) {
	if (isBundled(uri)) return uri;
	if (uri.startsWith("file://")) {
		let parsed;
		try {
			parsed = new URL(uri);
		} catch {
			throw new Error("invalid file URI: " + uri);
		}
		if (parsed.host !== "") return "//" + parsed.host + parsed.pathname;
		const path = decodeURIComponent(parsed.pathname);
		if (path.length >= 3 && path.charCodeAt(0) === CharacterCodesSlash) {
			const [volume, rest, ok] = splitVolumePath(path.substring(1));
			if (ok) return volume + rest;
		}
		return path;
	}
	const colonIndex = uri.indexOf(":");
	if (colonIndex === -1) throw new Error("invalid URI: " + uri);
	const scheme = uri.substring(0, colonIndex);
	let path = uri.substring(colonIndex + 1);
	let authority = "ts-nul-authority";
	if (path.startsWith("//")) {
		const rest = path.substring(2);
		const slashIndex = rest.indexOf("/");
		if (slashIndex === -1) throw new Error("invalid URI: " + uri);
		authority = rest.substring(0, slashIndex);
		path = rest.substring(slashIndex + 1);
	}
	return "^/" + scheme + "/" + authority + "/" + path;
}
//#endregion
//#region ../../node_modules/typescript/dist/api/proto.js
/**
* Resolves a DocumentIdentifier to a file name.
* If the identifier contains a URI, it is converted to a file name.
*/
function resolveFileName(identifier) {
	if (typeof identifier === "string") return identifier;
	return documentURIToFileName(identifier.uri);
}
/**
* Builds the wire request for updateSnapshot, applying the deprecated `openProject`
* compatibility shim: a single `openProject` is folded into `openProjects` and is
* never sent on the wire.
*/
function toUpdateSnapshotRequest(params) {
	const { openProject, openProjects, ...rest } = params ?? {};
	const mergedOpenProjects = openProject !== void 0 ? [resolveFileName(openProject), ...openProjects ?? []] : openProjects;
	return {
		...rest,
		...mergedOpenProjects !== void 0 ? { openProjects: mergedOpenProjects } : {}
	};
}
//#endregion
//#region ../../node_modules/typescript/dist/api/sourceFileCache.js
/**
* Builds a composite ref key from a snapshot ID and project ID.
*/
function refKey(snapshotId, projectId) {
	return `${snapshotId}:${projectId}`;
}
/**
* Client-side cache for source files keyed by (path, parseOptionsKey, contentHash).
*
* Supports multiple versions of the same file at the same path (e.g., from
* different snapshots with different file contents). Each version is identified
* by its content hash and parse options key.
*
* Entries are ref-counted by (snapshot, project) pairs. When a snapshot is
* disposed, all refs for that snapshot across all projects are released,
* and entries with no remaining references are evicted.
*
* When a new snapshot is created, unchanged cache entries from the previous
* snapshot are retained per-project. Only files within changed or removed
* projects are invalidated.
*/
var SourceFileCache = class {
	/** Map from path to all cached versions of that file */
	cache = /* @__PURE__ */ new Map();
	/** Map from snapshotId to (projectId → Set of paths fetched through that project) */
	snapshotProjectPaths = /* @__PURE__ */ new Map();
	/**
	* Get a cached source file already retained for the given (snapshot, project) pair.
	* This does not require a content hash or parse options key — it returns the entry
	* if one exists with a matching ref. Used to skip the server request entirely when
	* retainForSnapshot has already carried over the ref.
	*
	* A given (snapshot, project) pair always parses a file the same way, so there is
	* at most one matching entry per ref.
	*/
	getRetained(path, snapshotId, projectId) {
		const entries = this.cache.get(path);
		if (!entries) return void 0;
		const key = refKey(snapshotId, projectId);
		return entries.find((e) => e.refs.has(key))?.file;
	}
	/**
	* Store a source file in the cache and retain it for the given (snapshot, project) pair.
	* Returns the cached file — which may be an existing entry if the hash matches.
	*/
	set(path, file, parseOptionsKey, contentHash, snapshotId, projectId) {
		let entries = this.cache.get(path);
		if (!entries) {
			entries = [];
			this.cache.set(path, entries);
		}
		const ref = refKey(snapshotId, projectId);
		const existing = entries.find((e) => e.parseOptionsKey === parseOptionsKey && e.contentHash === contentHash);
		if (existing) {
			existing.refs.add(ref);
			this.trackPath(snapshotId, projectId, path);
			return existing.file;
		}
		entries.push({
			file,
			contentHash,
			parseOptionsKey,
			refs: /* @__PURE__ */ new Set([ref])
		});
		this.trackPath(snapshotId, projectId, path);
		return file;
	}
	/**
	* Retain cache entries from a previous snapshot for a new snapshot.
	* For each project in the previous snapshot:
	*   - Removed projects: skip (don't retain any refs).
	*   - Changed projects: retain refs for files not listed in changedFiles/deletedFiles.
	*   - Unchanged projects: retain all refs.
	*/
	retainForSnapshot(newSnapshotId, previousSnapshotId, changes) {
		const prevProjectMap = this.snapshotProjectPaths.get(previousSnapshotId);
		if (!prevProjectMap) return;
		const removedProjects = new Set(changes?.removedProjects ?? []);
		const changedProjects = changes?.changedProjects ?? {};
		for (const [projectId, paths] of prevProjectMap) {
			if (removedProjects.has(projectId)) continue;
			const projectChanges = changedProjects[projectId];
			let invalidPaths;
			if (projectChanges) {
				invalidPaths = /* @__PURE__ */ new Set();
				for (const p of projectChanges.changedFiles ?? []) invalidPaths.add(p);
				for (const p of projectChanges.deletedFiles ?? []) invalidPaths.add(p);
			}
			const prevRef = refKey(previousSnapshotId, projectId);
			const newRef = refKey(newSnapshotId, projectId);
			for (const path of paths) {
				if (invalidPaths?.has(path)) continue;
				const entries = this.cache.get(path);
				if (!entries) continue;
				for (const entry of entries) if (entry.refs.has(prevRef)) {
					entry.refs.add(newRef);
					this.trackPath(newSnapshotId, projectId, path);
				}
			}
		}
	}
	/**
	* Release all entries retained by the given snapshot across all projects.
	* Only visits paths that the snapshot actually referenced.
	* Entries with no remaining refs are evicted.
	*/
	releaseSnapshot(snapshotId) {
		const projectMap = this.snapshotProjectPaths.get(snapshotId);
		if (!projectMap) return;
		for (const [projectId, paths] of projectMap) {
			const key = refKey(snapshotId, projectId);
			for (const path of paths) {
				const entries = this.cache.get(path);
				if (!entries) continue;
				for (let i = entries.length - 1; i >= 0; i--) {
					entries[i].refs.delete(key);
					if (entries[i].refs.size === 0) entries.splice(i, 1);
				}
				if (entries.length === 0) this.cache.delete(path);
			}
		}
		this.snapshotProjectPaths.delete(snapshotId);
	}
	trackPath(snapshotId, projectId, path) {
		let projectMap = this.snapshotProjectPaths.get(snapshotId);
		if (!projectMap) {
			projectMap = /* @__PURE__ */ new Map();
			this.snapshotProjectPaths.set(snapshotId, projectMap);
		}
		let paths = projectMap.get(projectId);
		if (!paths) {
			paths = /* @__PURE__ */ new Set();
			projectMap.set(projectId, paths);
		}
		paths.add(path);
	}
	/**
	* Clear all entries from the cache.
	*/
	clear() {
		this.cache.clear();
		this.snapshotProjectPaths.clear();
	}
	/**
	* Get the number of unique paths in the cache.
	*/
	get size() {
		return this.cache.size;
	}
	/**
	* Check if a path is in the cache.
	*/
	has(path) {
		return this.cache.has(path);
	}
};
//#endregion
//#region ../../node_modules/typescript/dist/api/fs.js
/** The callback names supported by the Go server for virtual FS delegation. */
const fsCallbackNames = [
	"readFile",
	"fileExists",
	"directoryExists",
	"getAccessibleEntries",
	"realpath"
];
//#endregion
//#region ../../node_modules/typescript/lib/getExePath.js
function getExePath() {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const normalizedDirname = __dirname.replace(/\\/g, "/");
	const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
	const pkgName = pkg.name;
	const baseName = pkgName.startsWith("@") ? pkgName.split("/")[1] : pkgName;
	const expectedBinName = baseName === "typescript" ? "tsc" : "tsgo";
	const binNames = pkg.bin && typeof pkg.bin === "object" ? Object.keys(pkg.bin) : [];
	if (binNames.length !== 1 || binNames[0] !== expectedBinName) throw new Error(`Expected ${pkgName} to declare exactly one bin entry named ${expectedBinName}.`);
	let binName = expectedBinName;
	let exeDir;
	const expectedPackage = baseName + "-" + process.platform + "-" + process.arch;
	if (normalizedDirname.endsWith("/_packages/" + baseName + "/lib")) {
		exeDir = path.resolve(__dirname, "..", "..", "..", "built", "local");
		binName = "tsgo";
	} else if (normalizedDirname.endsWith("/built/npm/" + baseName + "/lib")) exeDir = path.resolve(__dirname, "..", "..", expectedPackage, "lib");
	else {
		const platformPackageName = "@typescript/" + expectedPackage;
		try {
			if (typeof import.meta.resolve === "undefined") {
				const packageJson = module.createRequire(import.meta.url).resolve(platformPackageName + "/package.json");
				exeDir = path.join(path.dirname(packageJson), "lib");
			} else {
				const packageJson = import.meta.resolve(platformPackageName + "/package.json");
				const packageJsonPath = fileURLToPath(packageJson);
				exeDir = path.join(path.dirname(packageJsonPath), "lib");
			}
		} catch (e) {
			throw new Error("Unable to resolve " + platformPackageName + ". Either your platform is unsupported, or you are missing the package on disk.");
		}
	}
	let exe = path.join(exeDir, binName);
	if (process.platform === "win32") {
		exe += ".exe";
		if (exe.length >= 248) exe = "\\\\?\\" + exe;
	}
	if (!fs.existsSync(exe)) throw new Error("Executable not found: " + exe);
	return exe;
}
//#endregion
//#region ../../node_modules/typescript/dist/api/options.js
/**
* Shared utilities for the TypeScript API client.
*/
function isSpawnOptions(options) {
	return !("pipe" in options);
}
function resolveExePath(options) {
	return options.tsserverPath ?? getExePath();
}
//#endregion
//#region ../../node_modules/typescript/dist/api/syncChannel.js
/**
* Pure JS replacement for @typescript/libsyncrpc.
*
* Spawns a child process and communicates with it synchronously over
* stdin/stdout pipes using the same MessagePack-based tuple protocol:
*   [MessageType (u8), method (bin), payload (bin)]
*
* Synchronous I/O is achieved by calling fs.readSync / fs.writeSync
* directly on the pipe file descriptors obtained from the spawned
* ChildProcess.
*/
const MSG_REQUEST = 1;
const MSG_CALL_RESPONSE = 2;
const MSG_CALL_ERROR = 3;
const MSG_RESPONSE = 4;
const MSG_ERROR = 5;
const MSG_CALL = 6;
const sleepBuf = new Int32Array(new SharedArrayBuffer(4));
const EMPTY_BUF = Buffer.alloc(0);
const liveChildren = /* @__PURE__ */ new Set();
process.on("exit", () => {
	for (const child of liveChildren) try {
		child.kill();
	} catch {}
	liveChildren.clear();
});
/**
* SyncRpcChannel – drop-in replacement for the native libsyncrpc class.
*
* API surface intentionally matches the original:
*   - constructor(exe, args)
*   - requestSync(method, payload): string
*   - requestBinarySync(method, payload): Uint8Array
*   - registerCallback(name, cb)
*   - close()
*
* The protocol is unversioned; both sides (this JS channel and the Go
* child process) must be built from the same tree.
*
* This class is **not** thread-safe. All calls must originate from a
* single thread — do not share an instance across worker threads.
*/
var SyncRpcChannel = class {
	child;
	readFd;
	writeFd;
	pipeFd;
	callbacks = /* @__PURE__ */ new Map();
	methodBufCache = /* @__PURE__ */ new Map();
	collectTiming;
	lastBytesSent = 0;
	lastBytesReceived = 0;
	_msgType = 0;
	_msgName = EMPTY_BUF;
	_msgPayload = EMPTY_BUF;
	headerBuf = Buffer.allocUnsafe(4);
	readBuf = Buffer.allocUnsafe(65536);
	readBufPos = 0;
	readBufLen = 0;
	writeBuf = Buffer.allocUnsafe(65536);
	constructor(exe, args, collectTiming = false) {
		this.collectTiming = collectTiming;
		if (process.platform === "win32") {
			const pipePath = `\\\\.\\pipe\\tsgo-sync-${process.pid}-${Date.now()}`;
			this.child = spawn(exe, [
				...args,
				"--pipe",
				pipePath
			], { stdio: [
				"ignore",
				"ignore",
				"inherit"
			] });
			let fd;
			for (let i = 0; i < 500; i++) try {
				fd = openSync(pipePath, "r+");
				break;
			} catch {
				if (this.child.exitCode !== null) throw new Error(`Child process exited with code ${this.child.exitCode} before pipe was ready`);
				Atomics.wait(sleepBuf, 0, 0, 10);
			}
			if (fd === void 0) {
				this.child.kill();
				throw new Error("SyncRpcChannel: timed out connecting to named pipe");
			}
			this.readFd = fd;
			this.writeFd = fd;
			this.pipeFd = fd;
		} else {
			this.child = spawn(exe, args, { stdio: [
				"pipe",
				"pipe",
				"inherit"
			] });
			const stdout = this.child.stdout;
			const stdin = this.child.stdin;
			this.readFd = stdout._handle.fd;
			this.writeFd = stdin._handle.fd;
			if (typeof this.readFd !== "number" || this.readFd < 0 || typeof this.writeFd !== "number" || this.writeFd < 0) {
				stdout.destroy();
				stdin.destroy();
				this.child.kill();
				throw new Error("SyncRpcChannel: could not obtain pipe file descriptors.");
			}
			stdout._handle.setBlocking?.(true);
			stdin._handle.setBlocking?.(true);
			stdout.pause();
			stdout.unref();
			stdin.unref();
		}
		liveChildren.add(this.child);
		this.child.unref();
	}
	/**
	* Send a request and synchronously wait for the response (string).
	* Handles Call (callback) messages from the child inline.
	*/
	requestSync(method, payload) {
		this.ensureOpen();
		return this.requestBytesSync(method, payload).toString("utf-8");
	}
	/**
	* Send a request and synchronously wait for the response (binary).
	* Handles Call (callback) messages from the child inline.
	*/
	requestBinarySync(method, payload) {
		this.ensureOpen();
		return this.requestBytesSync(method, payload);
	}
	/** Register a string→string callback that the child may invoke. */
	registerCallback(name, callback) {
		this.callbacks.set(name, callback);
	}
	/** Kill the child process and release resources. */
	close() {
		try {
			liveChildren.delete(this.child);
			if (this.pipeFd !== void 0) {
				closeSync(this.pipeFd);
				this.pipeFd = void 0;
			}
			this.child.stdout?.destroy();
			this.child.stdin?.destroy();
			this.child.kill();
			this.readFd = -1;
			this.writeFd = -1;
		} catch {}
	}
	ensureOpen() {
		if (this.readFd < 0) throw new Error("SyncRpcChannel is closed");
	}
	getMethodBuf(method) {
		let buf = this.methodBufCache.get(method);
		if (buf === void 0) {
			buf = Buffer.from(method, "utf-8");
			this.methodBufCache.set(method, buf);
		}
		return buf;
	}
	requestBytesSync(method, payload) {
		const methodBuf = this.getMethodBuf(method);
		if (this.collectTiming) {
			this.lastBytesSent = typeof payload === "string" ? Buffer.byteLength(payload, "utf-8") : payload.length;
			this.lastBytesReceived = 0;
		}
		this.writeTuple(MSG_REQUEST, methodBuf, payload);
		for (;;) {
			this.readTuple();
			switch (this._msgType) {
				case MSG_RESPONSE:
					if (!methodBuf.equals(this._msgName)) throw new Error(`name mismatch for response: expected \`${method}\`, got \`${this._msgName.toString("utf-8")}\``);
					if (this.collectTiming) this.lastBytesReceived = this._msgPayload.length;
					return this._msgPayload;
				case MSG_ERROR:
					if (methodBuf.equals(this._msgName)) throw new Error(this._msgPayload.toString("utf-8"));
					throw new Error(`name mismatch for response: expected \`${method}\`, got \`${this._msgName.toString("utf-8")}\``);
				case MSG_CALL:
					this.handleCall(this._msgName.toString("utf-8"), this._msgPayload);
					break;
				default: throw new Error(`Invalid message type from child: ${this._msgType}`);
			}
		}
	}
	/**
	* Handle an incoming MSG_CALL from the child process.
	*
	* After sending the error response back to the child, this method
	* intentionally re-throws to abort the caller's request loop.
	* A failed callback is treated as unrecoverable to match the
	* behavior of the native libsyncrpc addon.
	*/
	handleCall(name, payload) {
		const cb = this.callbacks.get(name);
		if (!cb) {
			const errMsg = `unknown callback: \`${name}\`. Please make sure to register it on the JavaScript side before invoking it.`;
			this.writeTuple(MSG_CALL_ERROR, Buffer.from(name, "utf-8"), Buffer.from(errMsg, "utf-8"));
			throw new Error(`no callback named \`${name}\` found`);
		}
		try {
			const result = cb(name, payload.toString("utf-8"));
			this.writeTuple(MSG_CALL_RESPONSE, Buffer.from(name, "utf-8"), Buffer.from(result, "utf-8"));
		} catch (e) {
			const errMsg = String(e instanceof Error ? e.message : e).trim();
			this.writeTuple(MSG_CALL_ERROR, Buffer.from(name, "utf-8"), Buffer.from(errMsg, "utf-8"));
			throw new Error(`Error calling callback \`${name}\`: ${errMsg}`);
		}
	}
	/**
	* Write a complete [type, name, payload] tuple in as few writeSync
	* calls as possible.  For messages that fit in the pre-allocated
	* write buffer (64 KB), everything is assembled and sent in a single
	* syscall.  Larger messages use two syscalls: one for the header
	* portion and one for the payload data.
	*/
	writeTuple(type, name, payload) {
		const nameLen = name.length;
		const payloadIsString = typeof payload === "string";
		const payloadLen = payloadIsString ? Buffer.byteLength(payload, "utf-8") : payload.length;
		const nameHdrSize = binHeaderSize(nameLen);
		const payloadHdrSize = binHeaderSize(payloadLen);
		const totalSize = 2 + nameHdrSize + nameLen + payloadHdrSize + payloadLen;
		if (totalSize <= this.writeBuf.length) {
			let off = 0;
			this.writeBuf[off++] = 147;
			this.writeBuf[off++] = type;
			off = writeBinHeader(this.writeBuf, off, nameLen);
			name.copy(this.writeBuf, off);
			off += nameLen;
			off = writeBinHeader(this.writeBuf, off, payloadLen);
			if (payloadLen > 0) {
				if (payloadIsString) this.writeBuf.write(payload, off, payloadLen, "utf-8");
				else if (payload instanceof Buffer) payload.copy(this.writeBuf, off);
				else this.writeBuf.set(payload, off);
			}
			this.writeAllBuf(this.writeBuf, totalSize);
		} else {
			let off = 0;
			this.writeBuf[off++] = 147;
			this.writeBuf[off++] = type;
			off = writeBinHeader(this.writeBuf, off, nameLen);
			name.copy(this.writeBuf, off);
			off += nameLen;
			off = writeBinHeader(this.writeBuf, off, payloadLen);
			this.writeAllBuf(this.writeBuf, off);
			if (payloadLen > 0) {
				if (payloadIsString) this.writeAllBuf(Buffer.from(payload, "utf-8"));
				else this.writeAllBuf(payload);
			}
		}
	}
	/**
	* Read a [type, name, payload] tuple into instance fields
	* (_msgType, _msgName, _msgPayload) to avoid allocating a
	* short-lived 3-element array on every call.
	*/
	readTuple() {
		const marker = this.readByte();
		if (marker !== 147) throw new Error(`Expected fixed 3-element array (0x93), received: 0x${marker.toString(16)}`);
		const tb = this.readByte();
		if (tb <= 127) this._msgType = tb;
		else if (tb === 204) this._msgType = this.readByte();
		else throw new Error(`Expected positive fixint or uint8 marker, received: 0x${tb.toString(16)}`);
		this._msgName = this.readBin();
		this._msgPayload = this.readBin();
	}
	/**
	* Read a MessagePack bin field.
	*/
	readBin() {
		const marker = this.readByte();
		let size;
		switch (marker) {
			case 196:
				size = this.readByte();
				break;
			case 197:
				this.readExactInto(this.headerBuf, 2);
				size = this.headerBuf[0] << 8 | this.headerBuf[1];
				break;
			case 198:
				this.readExactInto(this.headerBuf, 4);
				size = this.headerBuf.readUInt32BE(0);
				break;
			default: throw new Error(`Expected binary data (0xc4-0xc6), received: 0x${marker.toString(16)}`);
		}
		if (size === 0) return EMPTY_BUF;
		return this.readExact(size);
	}
	/** Build an EOF error with the child's exit code/signal if available. */
	eofError() {
		const code = this.child.exitCode;
		const signal = this.child.signalCode;
		const detail = signal ? `killed by signal ${signal}` : code !== null ? `exited with code ${code}` : "unknown reason";
		return /* @__PURE__ */ new Error(`Unexpected EOF while reading from child process (${detail})`);
	}
	/** Read a single byte from the buffered read-ahead. */
	readByte() {
		if (this.readBufPos >= this.readBufLen) this.fillReadBuffer();
		return this.readBuf[this.readBufPos++];
	}
	readExact(length) {
		const buf = Buffer.allocUnsafeSlow(length);
		this.readExactInto(buf, length);
		return buf;
	}
	/**
	* Fill the internal read-ahead buffer from the pipe fd.
	* Retries on EAGAIN for non-blocking mode compatibility.
	*/
	fillReadBuffer() {
		this.readBufPos = 0;
		this.readBufLen = 0;
		for (;;) try {
			const n = readSync(this.readFd, this.readBuf, 0, this.readBuf.length, null);
			if (n === 0) throw this.eofError();
			this.readBufLen = n;
			return;
		} catch (e) {
			if (e instanceof Error && "code" in e && (e.code === "EAGAIN" || e.code === "EWOULDBLOCK")) {
				Atomics.wait(sleepBuf, 0, 0, 1);
				continue;
			}
			throw e;
		}
	}
	/**
	* Synchronously read exactly `length` bytes into `buffer`.
	* Serves from the internal read-ahead buffer first; for large reads
	* that exceed the buffer size, reads directly from the fd to avoid
	* an extra copy.
	*/
	readExactInto(buffer, length) {
		let pos = 0;
		while (pos < length) {
			const avail = this.readBufLen - this.readBufPos;
			if (avail > 0) {
				const toCopy = Math.min(avail, length - pos);
				this.readBuf.copy(buffer, pos, this.readBufPos, this.readBufPos + toCopy);
				this.readBufPos += toCopy;
				pos += toCopy;
			} else if (length - pos >= this.readBuf.length) try {
				const n = readSync(this.readFd, buffer, pos, length - pos, null);
				if (n === 0) throw this.eofError();
				pos += n;
			} catch (e) {
				if (e instanceof Error && "code" in e && (e.code === "EAGAIN" || e.code === "EWOULDBLOCK")) {
					Atomics.wait(sleepBuf, 0, 0, 1);
					continue;
				}
				throw e;
			}
			else this.fillReadBuffer();
		}
	}
	/**
	* Synchronously write all bytes from `data` (up to `length`).
	* Retries on EAGAIN.
	*/
	writeAllBuf(data, length) {
		const total = length ?? data.length;
		let pos = 0;
		while (pos < total) try {
			const n = writeSync(this.writeFd, data, pos, total - pos);
			pos += n;
		} catch (e) {
			if (e instanceof Error && "code" in e && (e.code === "EAGAIN" || e.code === "EWOULDBLOCK")) {
				Atomics.wait(sleepBuf, 0, 0, 1);
				continue;
			}
			throw e;
		}
	}
};
function emptyAccumulators() {
	return {
		requestCount: 0,
		roundTripMs: 0,
		bytesSent: 0,
		bytesReceived: 0,
		serverTimeMs: 0,
		transportOverheadMs: 0,
		nodesMaterialized: 0,
		sourceFilesFetched: 0,
		nodesFetched: 0
	};
}
/** Returns a snapshot representing a disabled (never-collecting) timing state. */
function disabledTimingInfo() {
	return {
		enabled: false,
		totals: emptyAccumulators(),
		recentRequests: []
	};
}
/**
* Folds a server-side timing snapshot into a client-side snapshot, producing a
* combined {@link TimingInfo} with per-request and total server processing time
* plus estimated transport overhead.
*
* Recent requests are paired newest-to-newest and only matched when the method
* names agree, so that requests recorded by only one side (e.g. the meta
* requests used to fetch timing) do not misalign the two ring buffers.
*/
function combineTimingInfo(client, server) {
	if (!client.enabled) return client;
	const serverTimeMs = server.totals.totalProcessingTimeMs;
	const totals = {
		...client.totals,
		serverTimeMs,
		transportOverheadMs: Math.max(0, client.totals.roundTripMs - serverTimeMs)
	};
	const recentRequests = client.recentRequests.map((r) => ({ ...r }));
	const serverRecent = server.recentRequests;
	const pairs = Math.min(recentRequests.length, serverRecent.length);
	for (let i = 1; i <= pairs; i++) {
		const c = recentRequests[recentRequests.length - i];
		const s = serverRecent[serverRecent.length - i];
		if (c.method === s.method) {
			c.serverTimeMs = s.processingTimeMs;
			c.transportOverheadMs = Math.max(0, c.roundTripMs - s.processingTimeMs);
		}
	}
	return {
		enabled: true,
		totals,
		recentRequests
	};
}
/**
* Accumulates request timing samples into running totals and a fixed-size ring
* buffer of the most recent requests.
*/
var TimingCollector = class {
	totals = emptyAccumulators();
	ring = [];
	head = 0;
	/** Records a single request's measurements. */
	record(sample) {
		this.totals.requestCount++;
		this.totals.roundTripMs += sample.roundTripMs;
		this.totals.bytesSent += sample.bytesSent;
		this.totals.bytesReceived += sample.bytesReceived;
		const entry = {
			method: sample.method,
			roundTripMs: sample.roundTripMs,
			bytesSent: sample.bytesSent,
			bytesReceived: sample.bytesReceived,
			timestamp: Date.now()
		};
		if (this.ring.length < 5) this.ring.push(entry);
		else {
			this.ring[this.head] = entry;
			this.head = (this.head + 1) % 5;
		}
	}
	/**
	* Records a single AST node materialization. Called on demand as the consumer
	* walks a binary source-file response's tree, so it is not tied to any one
	* request.
	*/
	recordMaterialization() {
		this.totals.nodesMaterialized++;
	}
	/**
	* Records a fetched source file: increments the fetched-file counter and adds
	* the file's materializable node count to the fetched-node total, which serves
	* as the denominator for the share of fetched nodes that end up materialized.
	*/
	recordSourceFileFetched(materializableNodeCount) {
		this.totals.sourceFilesFetched++;
		this.totals.nodesFetched += materializableNodeCount;
	}
	/** Returns a snapshot of the collected timing information. */
	getInfo() {
		const recentRequests = [];
		for (let i = 0; i < this.ring.length; i++) recentRequests.push(this.ring[(this.head + i) % this.ring.length]);
		return {
			enabled: true,
			totals: { ...this.totals },
			recentRequests
		};
	}
	/** Clears all accumulated totals and recent-request history. */
	reset() {
		this.totals = emptyAccumulators();
		this.ring = [];
		this.head = 0;
	}
};
//#endregion
//#region ../../node_modules/typescript/dist/api/sync/client.js
var Client = class {
	channel;
	encoder = new TextEncoder();
	timing;
	constructor(options) {
		if (!isSpawnOptions(options)) throw new Error("Socket connections are not yet supported in the sync client");
		const args = [
			"--api",
			"--cwd",
			options.cwd ?? process.cwd()
		];
		const enabledCallbacks = [];
		if (options.fs) {
			for (const name of fsCallbackNames) if (options.fs[name]) enabledCallbacks.push(name);
		}
		if (enabledCallbacks.length > 0) args.push(`--callbacks=${enabledCallbacks.join(",")}`);
		const collectTiming = options.collectTiming ?? false;
		if (collectTiming) {
			args.push("--timing");
			this.timing = new TimingCollector();
		}
		const channel = new SyncRpcChannel(resolveExePath(options), args, collectTiming);
		this.channel = channel;
		if (options.fs) for (const name of enabledCallbacks) {
			const callback = options.fs[name];
			channel.registerCallback(name, (_, arg) => {
				const result = callback(JSON.parse(arg));
				if (name === "readFile") {
					if (result === void 0) return "";
					return JSON.stringify({ content: result });
				}
				return JSON.stringify(result) ?? "";
			});
		}
	}
	apiRequest(method, params) {
		const encodedPayload = JSON.stringify(params);
		const start = performance.now();
		const result = this.channel.requestSync(method, encodedPayload);
		this.recordTiming(method, start);
		if (result.length) return JSON.parse(result);
	}
	apiRequestBinary(method, params) {
		const start = performance.now();
		const result = this.channel.requestBinarySync(method, this.encoder.encode(JSON.stringify(params)));
		this.recordTiming(method, start);
		if (result.length === 0) return void 0;
		return result;
	}
	echo(payload) {
		return this.channel.requestSync("echo", payload);
	}
	echoBinary(payload) {
		return this.channel.requestBinarySync("echo", payload);
	}
	/**
	* Returns a combined timing snapshot: client-measured round-trip and byte
	* counts folded together with the server's own per-request processing time
	* (fetched via a getServerTiming request) and estimated transport overhead.
	*/
	getTimingInfo() {
		if (!this.timing) return disabledTimingInfo();
		const local = this.timing.getInfo();
		const result = this.channel.requestSync("getServerTiming", "");
		return combineTimingInfo(local, JSON.parse(result));
	}
	resetTimingInfo() {
		if (!this.timing) return;
		this.timing.reset();
		this.channel.requestSync("resetServerTiming", "");
	}
	/**
	* Returns the timing collector that per-node materialization is reported
	* into, or undefined when timing collection is disabled. The returned
	* collector is the same one folded into {@link getTimingInfo}, so
	* materialization totals surface alongside request timings.
	*/
	getTimingCollector() {
		return this.timing;
	}
	recordTiming(method, start) {
		if (!this.timing) return;
		this.timing.record({
			method,
			roundTripMs: performance.now() - start,
			bytesSent: this.channel.lastBytesSent,
			bytesReceived: this.channel.lastBytesReceived
		});
	}
	close() {
		this.channel.close();
	}
};
//#endregion
//#region ../../node_modules/typescript/dist/api/sync/api.js
var API = class API {
	client;
	sourceFileCache;
	toPath;
	initialized = false;
	activeSnapshots = /* @__PURE__ */ new Set();
	latestSnapshot;
	internal;
	constructor(options = {}) {
		this.client = new Client(options);
		this.sourceFileCache = new SourceFileCache();
		this.internal = new InternalAPI(this.client, () => this.ensureInitialized());
	}
	/**
	* Create an API instance from an existing LSP connection's API session.
	* Use this when connecting to an API pipe provided by an LSP server via custom/initializeAPISession.
	*/
	static fromLSPConnection(options) {
		const api = new API(options);
		api.ensureInitialized();
		return api;
	}
	ensureInitialized() {
		if (!this.initialized) {
			const response = this.client.apiRequest("initialize", null);
			const getCanonicalFileName = createGetCanonicalFileName(response.useCaseSensitiveFileNames);
			const currentDirectory = response.currentDirectory;
			this.toPath = (fileName) => toPath(fileName, currentDirectory, getCanonicalFileName);
			this.initialized = true;
		}
	}
	parseConfigFile(file) {
		this.ensureInitialized();
		return this.client.apiRequest("parseConfigFile", { file });
	}
	updateSnapshot(params) {
		this.ensureInitialized();
		const requestParams = toUpdateSnapshotRequest(params);
		const data = this.client.apiRequest("updateSnapshot", requestParams);
		if (this.latestSnapshot) {
			this.sourceFileCache.retainForSnapshot(data.snapshot, this.latestSnapshot.id, data.changes);
			if (this.latestSnapshot.isDisposed()) this.sourceFileCache.releaseSnapshot(this.latestSnapshot.id);
		}
		const snapshot = new Snapshot(data, this.client, this.sourceFileCache, this.toPath, () => {
			this.activeSnapshots.delete(snapshot);
			if (snapshot !== this.latestSnapshot) this.sourceFileCache.releaseSnapshot(snapshot.id);
		});
		this.latestSnapshot = snapshot;
		this.activeSnapshots.add(snapshot);
		return snapshot;
	}
	close() {
		for (const snapshot of [...this.activeSnapshots]) snapshot.dispose();
		if (this.latestSnapshot) {
			this.sourceFileCache.releaseSnapshot(this.latestSnapshot.id);
			this.latestSnapshot = void 0;
		}
		this.client.close();
		this.sourceFileCache.clear();
	}
	clearSourceFileCache() {
		this.sourceFileCache.clear();
	}
	/**
	* Returns a snapshot of collected timing information for requests made
	* through this API instance: client-measured round-trip latency and bytes
	* transferred, folded together with the server's own per-request processing
	* time and an estimated transport overhead (round-trip minus server time).
	*
	* Fetching the snapshot issues a lightweight request to the server to
	* retrieve its timing collection. Collection must be enabled via the
	* `collectTiming` option; when it is not, the returned snapshot has
	* `enabled: false` and zeroed totals.
	*/
	getTimingInfo() {
		return this.client.getTimingInfo();
	}
	/** Clears all accumulated timing totals and recent-request history, on both the client and the server. */
	resetTimingInfo() {
		return this.client.resetTimingInfo();
	}
};
var InternalAPI = class {
	client;
	ensureInitialized;
	/** @internal */
	constructor(client, ensureInitialized) {
		this.client = client;
		this.ensureInitialized = ensureInitialized;
	}
	startCPUProfile(dir) {
		this.ensureInitialized();
		this.client.apiRequest("startCPUProfile", { dir });
	}
	stopCPUProfile() {
		this.ensureInitialized();
		return this.client.apiRequest("stopCPUProfile", null).file;
	}
	saveHeapProfile(dir) {
		this.ensureInitialized();
		return this.client.apiRequest("saveHeapProfile", { dir }).file;
	}
};
var Snapshot = class {
	id;
	projectMap;
	toPath;
	client;
	disposed = false;
	onDispose;
	snapshotRegistry;
	constructor(data, client, sourceFileCache, toPath, onDispose) {
		this.id = data.snapshot;
		this.client = client;
		this.toPath = toPath;
		this.onDispose = onDispose;
		this.projectMap = /* @__PURE__ */ new Map();
		this.snapshotRegistry = new SnapshotObjectRegistry(client, this.id, (projectId) => this.projectMap.get(projectId));
		for (const projData of data.projects) {
			const project = new Project(projData, this.id, client, sourceFileCache, toPath, this.snapshotRegistry);
			this.projectMap.set(toPath(projData.configFileName), project);
		}
	}
	getProjects() {
		this.ensureNotDisposed();
		return [...this.projectMap.values()];
	}
	getProject(configFileName) {
		this.ensureNotDisposed();
		return this.projectMap.get(this.toPath(configFileName));
	}
	getDefaultProjectForFile(file) {
		this.ensureNotDisposed();
		const data = this.client.apiRequest("getDefaultProjectForFile", {
			snapshot: this.id,
			file
		});
		if (!data) return void 0;
		return this.projectMap.get(this.toPath(data.configFileName));
	}
	[globalThis.Symbol.dispose]() {
		this.dispose();
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		for (const project of this.projectMap.values()) project.dispose();
		this.projectMap.clear();
		this.snapshotRegistry.clear();
		this.onDispose();
		this.client.apiRequest("release", { snapshot: this.id });
	}
	isDisposed() {
		return this.disposed;
	}
	ensureNotDisposed() {
		if (this.disposed) throw new Error("Snapshot is disposed");
	}
};
var SnapshotObjectRegistry = class {
	symbols = /* @__PURE__ */ new Map();
	client;
	snapshotId;
	resolveProject;
	constructor(client, snapshotId, resolveProject) {
		this.client = client;
		this.snapshotId = snapshotId;
		this.resolveProject = resolveProject;
	}
	/** Resolve a project id (a config file path) to its Project within this snapshot. */
	getProject(projectId) {
		return this.resolveProject(projectId);
	}
	getOrCreateSymbol(data) {
		let symbol = this.symbols.get(data.id);
		if (!symbol) {
			symbol = new Symbol$1(data, this);
			this.symbols.set(data.id, symbol);
		}
		return symbol;
	}
	getSymbol(id) {
		return this.symbols.get(id);
	}
	clear() {
		this.symbols.clear();
	}
	fetchSymbol(source, method, handle, projectId) {
		if (!handle) return void 0;
		const cached = this.getSymbol(handle);
		if (cached) return cached;
		const data = this.client.apiRequest(method, {
			snapshot: this.snapshotId,
			project: projectId,
			objectId: source.id
		});
		if (!data) throw new Error(`${method} returned null symbol for ${source.constructor.name} ${source.id}`);
		return this.getOrCreateSymbol(data);
	}
	fetchSymbols(source, method, handles, projectId) {
		if (handles) {
			const result = new Array(handles.length);
			let allCached = true;
			for (let i = 0; i < handles.length; i++) {
				const cached = this.getSymbol(handles[i]);
				if (!cached) {
					allCached = false;
					break;
				}
				result[i] = cached;
			}
			if (allCached) return result;
		}
		const symbolData = this.client.apiRequest(method, {
			snapshot: this.snapshotId,
			project: projectId,
			objectId: source.id
		});
		if (symbolData == null) return [];
		else return symbolData.map((data) => this.getOrCreateSymbol(data));
	}
};
var ProjectObjectRegistry = class {
	client;
	snapshotId;
	project;
	snapshotRegistry;
	types = /* @__PURE__ */ new Map();
	signatures = /* @__PURE__ */ new Map();
	constructor(client, snapshotId, project, snapshotRegistry) {
		this.client = client;
		this.snapshotId = snapshotId;
		this.project = project;
		this.snapshotRegistry = snapshotRegistry;
	}
	getOrCreateSymbol(data) {
		return this.snapshotRegistry.getOrCreateSymbol(data);
	}
	getSymbol(id) {
		return this.snapshotRegistry.getSymbol(id);
	}
	getOrCreateType(data) {
		let type = this.types.get(data.id);
		if (!type) {
			type = new TypeObject(data, this);
			this.types.set(data.id, type);
		}
		return type;
	}
	getType(id) {
		return this.types.get(id);
	}
	getOrCreateSignature(data) {
		let sig = this.signatures.get(data.id);
		if (!sig) {
			sig = new Signature(data, this.project, this);
			this.signatures.set(data.id, sig);
		}
		return sig;
	}
	getSignature(id) {
		return this.signatures.get(id);
	}
	clear() {
		this.types.clear();
		this.signatures.clear();
	}
	fetchType(source, method, handle) {
		if (handle !== false) {
			if (!handle) return void 0;
			const cached = this.getType(handle);
			if (cached) return cached;
		}
		const data = this.client.apiRequest(method, {
			snapshot: this.snapshotId,
			project: this.project.id,
			objectId: source.id
		});
		if (!data) throw new Error(`${method} returned null type for ${source.constructor.name} ${source.id}`);
		return this.getOrCreateType(data);
	}
	fetchSymbol(source, method, handle) {
		return this.snapshotRegistry.fetchSymbol(source, method, handle, this.project.id);
	}
	fetchSignature(source, method, handle) {
		if (!handle) return void 0;
		const cached = this.getSignature(handle);
		if (cached) return cached;
		const data = this.client.apiRequest(method, {
			snapshot: this.snapshotId,
			project: this.project.id,
			objectId: source.id
		});
		if (!data) throw new Error(`${method} returned null signature for ${source.constructor.name} ${source.id}`);
		return this.getOrCreateSignature(data);
	}
	fetchTypes(source, method, handles) {
		if (handles) {
			const result = new Array(handles.length);
			let allCached = true;
			for (let i = 0; i < handles.length; i++) {
				const cached = this.getType(handles[i]);
				if (!cached) {
					allCached = false;
					break;
				}
				result[i] = cached;
			}
			if (allCached) return result;
		}
		const typesData = this.client.apiRequest(method, {
			snapshot: this.snapshotId,
			project: this.project.id,
			objectId: source.id
		});
		if (typesData == null) return [];
		else return typesData.map((data) => this.getOrCreateType(data));
	}
	fetchSymbols(source, method, handles) {
		return this.snapshotRegistry.fetchSymbols(source, method, handles, this.project.id);
	}
	fetchBaseTypes(source) {
		const typesData = this.client.apiRequest("getBaseTypes", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: source.id
		});
		if (typesData == null) return [];
		return typesData.map((data) => this.getOrCreateType(data));
	}
};
var Project = class {
	id;
	configFileName;
	compilerOptions;
	rootFiles;
	program;
	checker;
	emitter;
	client;
	constructor(data, snapshotId, client, sourceFileCache, toPath, snapshotRegistry) {
		this.id = data.id;
		this.configFileName = data.configFileName;
		this.compilerOptions = data.compilerOptions;
		this.rootFiles = data.rootFiles;
		this.client = client;
		this.program = new Program(snapshotId, this, client, sourceFileCache, toPath);
		const objectRegistry = new ProjectObjectRegistry(client, snapshotId, this, snapshotRegistry);
		this.checker = new Checker(snapshotId, this, client, objectRegistry);
		this.emitter = new Emitter(client);
	}
	dispose() {
		this.checker.dispose();
	}
};
var Program = class {
	snapshotId;
	project;
	client;
	sourceFileCache;
	toPath;
	decoder = new Wtf8Decoder();
	sourceFileMetadataCache = /* @__PURE__ */ new Map();
	constructor(snapshotId, project, client, sourceFileCache, toPath) {
		this.snapshotId = snapshotId;
		this.project = project;
		this.client = client;
		this.sourceFileCache = sourceFileCache;
		this.toPath = toPath;
	}
	getCompilerOptions() {
		return this.project.compilerOptions;
	}
	getSourceFile(file) {
		const fileName = resolveFileName(file);
		const path = this.toPath(fileName);
		const retained = this.sourceFileCache.getRetained(path, this.snapshotId, this.project.id);
		if (retained) return retained;
		const binaryData = this.client.apiRequestBinary("getSourceFile", {
			snapshot: this.snapshotId,
			project: this.project.id,
			file
		});
		if (!binaryData) return;
		const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
		const contentHash = readSourceFileHash(view);
		const parseOptionsKey = readParseOptionsKey(view);
		const sourceFile = new RemoteSourceFile(binaryData, this.decoder, this.client.getTimingCollector());
		return this.sourceFileCache.set(path, sourceFile, parseOptionsKey, contentHash, this.snapshotId, this.project.id);
	}
	getSourceFileNames() {
		return this.client.apiRequest("getSourceFileNames", {
			snapshot: this.snapshotId,
			project: this.project.id
		}) ?? [];
	}
	/**
	* Returns program-stored metadata for the given source file, or `undefined` if the file
	* is not part of the program. Metadata is fetched lazily per file and cached on this
	* `Program` instance.
	*/
	getSourceFileMetadata(fileName) {
		return this.getSourceFileMetadataByPath(this.toPath(fileName));
	}
	/**
	* Returns program-stored metadata for the source file at the given path, or `undefined`
	* if the file is not part of the program. Like {@link getSourceFileMetadata}, but skips
	* the file name to path conversion. Metadata is fetched lazily per file and cached on
	* this `Program` instance.
	*/
	getSourceFileMetadataByPath(path) {
		let metadata = this.sourceFileMetadataCache.get(path);
		if (metadata === void 0) {
			metadata = this.fetchSourceFileMetadata(path);
			this.sourceFileMetadataCache.set(path, metadata);
		}
		return metadata;
	}
	fetchSourceFileMetadata(path) {
		return this.client.apiRequest("getSourceFileMetadata", {
			snapshot: this.snapshotId,
			project: this.project.id,
			file: path
		}) ?? void 0;
	}
	/**
	* Returns whether the given source file was loaded as part of an external library
	* (e.g. a dependency resolved from `node_modules`). The underlying program metadata is
	* fetched lazily per file and cached on this `Program` instance.
	*/
	isSourceFileFromExternalLibrary(file) {
		return this.getSourceFileMetadataByPath(file.path)?.isFromExternalLibrary ?? false;
	}
	/**
	* Returns whether the given source file is a default library file (e.g. `lib.d.ts`).
	* The underlying program metadata is fetched lazily per file and cached on this
	* `Program` instance.
	*/
	isSourceFileDefaultLibrary(file) {
		return this.getSourceFileMetadataByPath(file.path)?.isDefaultLibrary ?? false;
	}
	/**
	* Get syntactic (parse) diagnostics for a specific file or all files.
	* @param file - Optional file to get diagnostics for. If omitted, returns diagnostics for all files.
	*/
	getSyntacticDiagnostics(file) {
		return this.client.apiRequest("getSyntacticDiagnostics", {
			snapshot: this.snapshotId,
			project: this.project.id,
			...file !== void 0 ? { file } : {}
		}) ?? [];
	}
	/**
	* Get binder diagnostics for a specific file or all files.
	* @param file - Optional file to get diagnostics for. If omitted, returns diagnostics for all files.
	*/
	getBindDiagnostics(file) {
		return this.client.apiRequest("getBindDiagnostics", {
			snapshot: this.snapshotId,
			project: this.project.id,
			...file !== void 0 ? { file } : {}
		}) ?? [];
	}
	/**
	* Get semantic (type-check) diagnostics for a specific file or all files.
	* @param file - Optional file to get diagnostics for. If omitted, returns diagnostics for all files.
	*/
	getSemanticDiagnostics(file) {
		return this.client.apiRequest("getSemanticDiagnostics", {
			snapshot: this.snapshotId,
			project: this.project.id,
			...file !== void 0 ? { file } : {}
		}) ?? [];
	}
	/**
	* Get suggestion diagnostics for a specific file or all files.
	* @param file - Optional file to get diagnostics for. If omitted, returns diagnostics for all files.
	*/
	getSuggestionDiagnostics(file) {
		return this.client.apiRequest("getSuggestionDiagnostics", {
			snapshot: this.snapshotId,
			project: this.project.id,
			...file !== void 0 ? { file } : {}
		}) ?? [];
	}
	/**
	* Get declaration emit diagnostics for a specific file or all files.
	* @param file - Optional file to get diagnostics for. If omitted, returns diagnostics for all files.
	*/
	getDeclarationDiagnostics(file) {
		return this.client.apiRequest("getDeclarationDiagnostics", {
			snapshot: this.snapshotId,
			project: this.project.id,
			...file !== void 0 ? { file } : {}
		}) ?? [];
	}
	/**
	* Get program-wide diagnostics for the project, including compiler options diagnostics.
	*/
	getProgramDiagnostics() {
		return this.client.apiRequest("getProgramDiagnostics", {
			snapshot: this.snapshotId,
			project: this.project.id
		}) ?? [];
	}
	/**
	* Get global (non-file-specific) semantic diagnostics for the project.
	*/
	getGlobalDiagnostics() {
		return this.client.apiRequest("getGlobalDiagnostics", {
			snapshot: this.snapshotId,
			project: this.project.id
		}) ?? [];
	}
	/**
	* Get config file parsing diagnostics for the project.
	*/
	getConfigFileParsingDiagnostics() {
		return this.client.apiRequest("getConfigFileParsingDiagnostics", {
			snapshot: this.snapshotId,
			project: this.project.id
		}) ?? [];
	}
};
var Checker = class {
	snapshotId;
	project;
	client;
	objectRegistry;
	wellKnownSymbols;
	constructor(snapshotId, project, client, objectRegistry) {
		this.snapshotId = snapshotId;
		this.project = project;
		this.client = client;
		this.objectRegistry = objectRegistry;
	}
	dispose() {
		this.objectRegistry.clear();
	}
	getSymbolAtLocation(nodeOrNodes) {
		if (Array.isArray(nodeOrNodes)) return this.client.apiRequest("getSymbolsAtLocations", {
			snapshot: this.snapshotId,
			project: this.project.id,
			locations: nodeOrNodes.map((node) => getNodeId(node))
		}).map((d) => d ? this.objectRegistry.getOrCreateSymbol(d) : void 0);
		const data = this.client.apiRequest("getSymbolAtLocation", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(nodeOrNodes)
		});
		return data ? this.objectRegistry.getOrCreateSymbol(data) : void 0;
	}
	getSymbolAtPosition(file, positionOrPositions) {
		if (typeof positionOrPositions === "number") {
			const data = this.client.apiRequest("getSymbolAtPosition", {
				snapshot: this.snapshotId,
				project: this.project.id,
				file,
				position: positionOrPositions
			});
			return data ? this.objectRegistry.getOrCreateSymbol(data) : void 0;
		}
		return this.client.apiRequest("getSymbolsAtPositions", {
			snapshot: this.snapshotId,
			project: this.project.id,
			file,
			positions: positionOrPositions
		}).map((d) => d ? this.objectRegistry.getOrCreateSymbol(d) : void 0);
	}
	getTypeOfSymbol(symbolOrSymbols) {
		if (Array.isArray(symbolOrSymbols)) return this.client.apiRequest("getTypesOfSymbols", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbols: symbolOrSymbols.map((s) => s.id)
		}).map((d) => d ? this.objectRegistry.getOrCreateType(d) : void 0);
		const data = this.client.apiRequest("getTypeOfSymbol", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbolOrSymbols.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	/**
	* Get the declared type of a symbol. Always returns a type; for symbols whose
	* declared type cannot be determined the checker yields the error type (use
	* {@link Type.isErrorType} to detect it).
	*/
	getDeclaredTypeOfSymbol(symbol) {
		const data = this.client.apiRequest("getDeclaredTypeOfSymbol", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbol.id
		});
		if (!data) throw new Error(`getDeclaredTypeOfSymbol returned no type for symbol ${symbol.id}`);
		return this.objectRegistry.getOrCreateType(data);
	}
	getReferencesToSymbolInFile(file, symbol) {
		return (this.client.apiRequest("getReferencesToSymbolInFile", {
			snapshot: this.snapshotId,
			project: this.project.id,
			file,
			symbol: symbol.id
		}) ?? []).map((h) => new NodeHandle(h, this.project));
	}
	getReferencedSymbolsForNode(node, position) {
		return (this.client.apiRequest("getReferencedSymbolsForNode", {
			snapshot: this.snapshotId,
			project: this.project.id,
			node: getNodeId(node),
			position
		}) ?? []).map((entry) => ({
			definition: new NodeHandle(entry.definition, this.project),
			symbol: entry.symbol ? this.objectRegistry.getOrCreateSymbol(entry.symbol) : void 0,
			references: (entry.references ?? []).map((h) => new NodeHandle(h, this.project))
		}));
	}
	getSignatureUsage(signatureDecl) {
		return (this.client.apiRequest("getSignatureUsages", {
			snapshot: this.snapshotId,
			project: this.project.id,
			signatureDecl: getNodeId(signatureDecl)
		}) ?? []).map((entry) => ({
			name: new NodeHandle(entry.name, this.project),
			call: entry.call ? new NodeHandle(entry.call, this.project) : void 0
		}));
	}
	getCompletionsAtPosition(document, position, options) {
		const data = this.client.apiRequest("getCompletionsAtPosition", {
			snapshot: this.snapshotId,
			project: this.project.id,
			file: document,
			position,
			triggerCharacter: options?.triggerCharacter,
			includeSymbol: options?.includeSymbol
		});
		if (!data) return void 0;
		return {
			isIncomplete: data.isIncomplete,
			entries: data.entries.map((e) => ({
				...e,
				symbol: e.symbol ? this.objectRegistry.getOrCreateSymbol(e.symbol) : void 0
			}))
		};
	}
	getTypeAtLocation(nodeOrNodes) {
		if (Array.isArray(nodeOrNodes)) return this.client.apiRequest("getTypeAtLocations", {
			snapshot: this.snapshotId,
			project: this.project.id,
			locations: nodeOrNodes.map((node) => getNodeId(node))
		}).map((d) => d ? this.objectRegistry.getOrCreateType(d) : void 0);
		const data = this.client.apiRequest("getTypeAtLocation", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(nodeOrNodes)
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getSignaturesOfType(type, kind) {
		return this.client.apiRequest("getSignaturesOfType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id,
			kind
		}).map((d) => this.objectRegistry.getOrCreateSignature(d));
	}
	getResolvedSignature(node) {
		const data = this.client.apiRequest("getResolvedSignature", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(node)
		});
		return data ? this.objectRegistry.getOrCreateSignature(data) : void 0;
	}
	getTypeAtPosition(file, positionOrPositions) {
		if (typeof positionOrPositions === "number") {
			const data = this.client.apiRequest("getTypeAtPosition", {
				snapshot: this.snapshotId,
				project: this.project.id,
				file,
				position: positionOrPositions
			});
			return data ? this.objectRegistry.getOrCreateType(data) : void 0;
		}
		return this.client.apiRequest("getTypesAtPositions", {
			snapshot: this.snapshotId,
			project: this.project.id,
			file,
			positions: positionOrPositions
		}).map((d) => d ? this.objectRegistry.getOrCreateType(d) : void 0);
	}
	resolveName(name, meaning, location, excludeGlobals) {
		const isNode = location && "kind" in location;
		const data = this.client.apiRequest("resolveName", {
			snapshot: this.snapshotId,
			project: this.project.id,
			name,
			meaning,
			location: isNode ? getNodeId(location) : void 0,
			file: !isNode && location ? location.document : void 0,
			position: !isNode && location ? location.position : void 0,
			excludeGlobals
		});
		return data ? this.objectRegistry.getOrCreateSymbol(data) : void 0;
	}
	getResolvedSymbol(node) {
		const text = node.text;
		if (!text) return void 0;
		return this.resolveName(text, SymbolFlags.Value | SymbolFlags.ExportValue, node);
	}
	getContextualType(node) {
		const data = this.client.apiRequest("getContextualType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(node)
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getBaseTypeOfLiteralType(type) {
		const data = this.client.apiRequest("getBaseTypeOfLiteralType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getNonNullableType(type) {
		const data = this.client.apiRequest("getNonNullableType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getTypeFromTypeNode(node) {
		const data = this.client.apiRequest("getTypeFromTypeNode", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(node)
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getWidenedType(type) {
		const data = this.client.apiRequest("getWidenedType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getParameterType(signature, index) {
		const data = this.client.apiRequest("getParameterType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			signature: signature.id,
			index
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	isArrayLikeType(type) {
		return this.client.apiRequest("isArrayLikeType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
	}
	isTypeAssignableTo(source, target) {
		return this.client.apiRequest("isTypeAssignableTo", {
			snapshot: this.snapshotId,
			project: this.project.id,
			source: source.id,
			target: target.id
		});
	}
	getShorthandAssignmentValueSymbol(node) {
		const data = this.client.apiRequest("getShorthandAssignmentValueSymbol", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(node)
		});
		return data ? this.objectRegistry.getOrCreateSymbol(data) : void 0;
	}
	/**
	* Get the type of a symbol as narrowed at a specific location. Always returns
	* a type; for symbols whose type cannot be determined the checker yields the
	* error type (use {@link Type.isErrorType} to detect it).
	*/
	getTypeOfSymbolAtLocation(symbol, location) {
		const data = this.client.apiRequest("getTypeOfSymbolAtLocation", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbol.id,
			location: getNodeId(location)
		});
		if (!data) throw new Error(`getTypeOfSymbolAtLocation returned no type for symbol ${symbol.id}`);
		return this.objectRegistry.getOrCreateType(data);
	}
	getIntrinsicType(method) {
		const data = this.client.apiRequest(method, {
			snapshot: this.snapshotId,
			project: this.project.id
		});
		return this.objectRegistry.getOrCreateType(data);
	}
	getAnyType() {
		return this.getIntrinsicType("getAnyType");
	}
	getStringType() {
		return this.getIntrinsicType("getStringType");
	}
	getNumberType() {
		return this.getIntrinsicType("getNumberType");
	}
	getBooleanType() {
		return this.getIntrinsicType("getBooleanType");
	}
	getVoidType() {
		return this.getIntrinsicType("getVoidType");
	}
	getUndefinedType() {
		return this.getIntrinsicType("getUndefinedType");
	}
	getNullType() {
		return this.getIntrinsicType("getNullType");
	}
	getNeverType() {
		return this.getIntrinsicType("getNeverType");
	}
	getUnknownType() {
		return this.getIntrinsicType("getUnknownType");
	}
	getBigIntType() {
		return this.getIntrinsicType("getBigIntType");
	}
	getESSymbolType() {
		return this.getIntrinsicType("getESSymbolType");
	}
	typeToTypeNode(type, enclosingDeclaration, flags) {
		const binaryData = this.client.apiRequestBinary("typeToTypeNode", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id,
			location: enclosingDeclaration ? getNodeId(enclosingDeclaration) : void 0,
			flags
		});
		if (!binaryData) return void 0;
		return decodeNode(binaryData);
	}
	signatureToSignatureDeclaration(signature, kind, enclosingDeclaration, flags) {
		const binaryData = this.client.apiRequestBinary("signatureToSignatureDeclaration", {
			snapshot: this.snapshotId,
			project: this.project.id,
			signature: signature.id,
			kind,
			location: enclosingDeclaration ? getNodeId(enclosingDeclaration) : void 0,
			flags
		});
		if (!binaryData) return void 0;
		return decodeNode(binaryData);
	}
	typeToString(type, enclosingDeclaration, flags) {
		return this.client.apiRequest("typeToString", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id,
			location: enclosingDeclaration ? getNodeId(enclosingDeclaration) : void 0,
			flags
		});
	}
	isContextSensitive(node) {
		return this.client.apiRequest("isContextSensitive", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(node)
		});
	}
	isArrayType(type) {
		return this.client.apiRequest("isArrayType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
	}
	isTupleType(type) {
		return this.client.apiRequest("isTupleType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
	}
	getReturnTypeOfSignature(signature) {
		const data = this.client.apiRequest("getReturnTypeOfSignature", {
			snapshot: this.snapshotId,
			project: this.project.id,
			signature: signature.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getRestTypeOfSignature(signature) {
		const data = this.client.apiRequest("getRestTypeOfSignature", {
			snapshot: this.snapshotId,
			project: this.project.id,
			signature: signature.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getTypePredicateOfSignature(signature) {
		const data = this.client.apiRequest("getTypePredicateOfSignature", {
			snapshot: this.snapshotId,
			project: this.project.id,
			signature: signature.id
		});
		if (!data) return void 0;
		return {
			kind: data.kind,
			parameterIndex: data.parameterIndex,
			parameterName: data.parameterName,
			type: data.type ? this.objectRegistry.getOrCreateType(data.type) : void 0
		};
	}
	/**
	* Get the base types of a class or interface type. A type with no base types
	* yields an empty array.
	*/
	getBaseTypes(type) {
		const data = this.client.apiRequest("getBaseTypes", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? data.map((d) => this.objectRegistry.getOrCreateType(d)) : [];
	}
	getApparentType(type) {
		const data = this.client.apiRequest("getApparentType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getPropertiesOfType(type) {
		const data = this.client.apiRequest("getPropertiesOfType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? data.map((d) => this.objectRegistry.getOrCreateSymbol(d)) : [];
	}
	getIndexInfosOfType(type) {
		const data = this.client.apiRequest("getIndexInfosOfType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		if (!data) return [];
		return data.map((d) => ({
			keyType: this.objectRegistry.getOrCreateType(d.keyType),
			valueType: this.objectRegistry.getOrCreateType(d.valueType),
			isReadonly: d.isReadonly ?? false,
			declaration: d.declaration ? new NodeHandle(d.declaration, this.project) : void 0
		}));
	}
	/**
	* Get the constraint of a type parameter (the `T` in `<U extends T>`), or
	* undefined if it has none.
	*/
	getConstraintOfTypeParameter(type) {
		const data = this.client.apiRequest("getConstraintOfTypeParameter", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getBaseConstraintOfType(type) {
		const data = this.client.apiRequest("getBaseConstraintOfType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? this.objectRegistry.getOrCreateType(data) : void 0;
	}
	getPropertyOfType(type, name) {
		const data = this.client.apiRequest("getPropertyOfType", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id,
			name
		});
		return data ? this.objectRegistry.getOrCreateSymbol(data) : void 0;
	}
	getConstantValue(node) {
		return this.client.apiRequest("getConstantValue", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(node)
		}) ?? void 0;
	}
	getSignatureFromDeclaration(node) {
		const data = this.client.apiRequest("getSignatureFromDeclaration", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(node)
		});
		return data ? this.objectRegistry.getOrCreateSignature(data) : void 0;
	}
	getExportSpecifierLocalTargetSymbol(node) {
		const data = this.client.apiRequest("getExportSpecifierLocalTargetSymbol", {
			snapshot: this.snapshotId,
			project: this.project.id,
			location: getNodeId(node)
		});
		return data ? this.objectRegistry.getOrCreateSymbol(data) : void 0;
	}
	/**
	* Follow all aliases to get the original symbol. Always returns a symbol; for
	* an unresolved alias the checker yields the unknown symbol (use
	* {@link Checker.isUnknownSymbol} to detect it).
	*/
	getAliasedSymbol(symbol) {
		const data = this.client.apiRequest("getAliasedSymbol", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbol.id
		});
		if (!data) throw new Error(`getAliasedSymbol returned no symbol for symbol ${symbol.id}`);
		return this.objectRegistry.getOrCreateSymbol(data);
	}
	getImmediateAliasedSymbol(symbol) {
		const data = this.client.apiRequest("getImmediateAliasedSymbol", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbol.id
		});
		return data ? this.objectRegistry.getOrCreateSymbol(data) : void 0;
	}
	/**
	* Fetch (once, then cache) the handle ids of the per-checker singleton
	* symbols (unknown, undefined, arguments). These ids are stable for the life
	* of the project's checker, so identity checks against them are local after
	* the first call.
	*/
	getWellKnownSymbols() {
		return this.wellKnownSymbols ??= this.client.apiRequest("getWellKnownSymbols", {
			snapshot: this.snapshotId,
			project: this.project.id
		});
	}
	/**
	* Returns `true` if the symbol is the checker's "unknown" symbol (e.g. the
	* result of {@link Checker.getAliasedSymbol} on an unresolved alias).
	*/
	isUnknownSymbol(symbol) {
		return symbol.id === this.getWellKnownSymbols().unknown;
	}
	/**
	* Returns `true` if the symbol is the checker's "undefined" symbol.
	*/
	isUndefinedSymbol(symbol) {
		return symbol.id === this.getWellKnownSymbols().undefined;
	}
	/**
	* Returns `true` if the symbol is the checker's "arguments" symbol.
	*/
	isArgumentsSymbol(symbol) {
		return symbol.id === this.getWellKnownSymbols().arguments;
	}
	getExportsOfModule(symbol) {
		const data = this.client.apiRequest("getExportsOfModule", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbol.id
		});
		return data ? data.map((d) => this.objectRegistry.getOrCreateSymbol(d)) : [];
	}
	getMemberInModuleExports(symbol, name) {
		const data = this.client.apiRequest("getMemberInModuleExports", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbol.id,
			name
		});
		return data ? this.objectRegistry.getOrCreateSymbol(data) : void 0;
	}
	getJsDocTagsOfSymbol(symbol) {
		return this.client.apiRequest("getJsDocTags", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbol.id
		}) ?? [];
	}
	getDocumentationCommentOfSymbol(symbol) {
		return this.client.apiRequest("getDocumentationComment", {
			snapshot: this.snapshotId,
			project: this.project.id,
			symbol: symbol.id
		});
	}
	/**
	* Get the type arguments of a type reference (e.g. the `string` in `Array<string>`).
	*/
	getTypeArguments(type) {
		const data = this.client.apiRequest("getTypeArguments", {
			snapshot: this.snapshotId,
			project: this.project.id,
			type: type.id
		});
		return data ? data.map((d) => this.objectRegistry.getOrCreateType(d)) : [];
	}
};
var Emitter = class {
	client;
	constructor(client) {
		this.client = client;
	}
	printNode(node, options = {}) {
		const base64 = uint8ArrayToBase64(encodeNode(node));
		return this.client.apiRequest("printNode", {
			data: base64,
			...options
		});
	}
};
var NodeHandle = class {
	/**
	* The project this handle was produced in, used as the default for {@link resolve}.
	* Node handles are only meaningful within a project's program, so the producing project
	* is remembered so callers don't have to pass it explicitly.
	*/
	canonicalProject;
	index;
	kind;
	path;
	constructor(handle, canonicalProject) {
		const parsed = parseNodeHandle(handle);
		this.index = parsed.index;
		this.kind = parsed.kind;
		this.path = parsed.path;
		this.canonicalProject = canonicalProject;
	}
	/**
	* Resolve this handle to the actual AST node by fetching the source file from a project
	* and looking up the node by index. If no project is passed, the project that produced
	* the handle is used.
	*/
	resolve(project = this.canonicalProject) {
		const sourceFile = project.program.getSourceFile(this.path);
		if (!sourceFile) return;
		return sourceFile.getOrCreateNodeAtIndex(this.index);
	}
};
var Symbol$1 = class {
	objectRegistry;
	/**
	* The project this symbol was first observed in, used as the default project for
	* lookups that need a project context (members/exports/parent). Symbols are shared
	* snapshot-wide, so these lookups can otherwise be ambiguous about which project to use.
	*/
	canonicalProject;
	id;
	/** The escaped (`__String`) name, used as the key in member/export tables. */
	escapedName;
	/** The display name (escaped underscores removed). */
	name;
	flags;
	checkFlags;
	declarations;
	valueDeclaration;
	parent;
	exportSymbol;
	membersCache;
	exportsCache;
	constructor(data, objectRegistry) {
		this.objectRegistry = objectRegistry;
		this.id = data.id;
		this.escapedName = data.name;
		this.name = unescapeLeadingUnderscores(data.name);
		this.flags = data.flags;
		this.checkFlags = data.checkFlags;
		const canonicalProject = objectRegistry.getProject(data.project);
		if (!canonicalProject) throw new Error(`Symbol ${data.id} references unknown canonical project '${data.project}'`);
		this.canonicalProject = canonicalProject;
		this.declarations = (data.declarations ?? []).map((d) => new NodeHandle(d, canonicalProject));
		this.valueDeclaration = data.valueDeclaration ? new NodeHandle(data.valueDeclaration, canonicalProject) : void 0;
		if (data.parent !== void 0) this.parent = data.parent;
		if (data.exportSymbol !== void 0) this.exportSymbol = data.exportSymbol;
	}
	getParent() {
		return this.objectRegistry.fetchSymbol(this, "getParentOfSymbol", this.parent, this.canonicalProject.id);
	}
	/**
	* Get this symbol's members keyed by escaped name. The result is cached on
	* the symbol, so repeated calls do not round-trip to the server.
	*/
	getMembers() {
		return this.membersCache ??= this.fetchSymbolTable("getMembersOfSymbol");
	}
	/**
	* Get this symbol's exports keyed by escaped name. The result is cached on
	* the symbol, so repeated calls do not round-trip to the server.
	*/
	getExports() {
		return this.exportsCache ??= this.fetchSymbolTable("getExportsOfSymbol");
	}
	fetchSymbolTable(method) {
		const symbols = this.objectRegistry.fetchSymbols(this, method, void 0, this.canonicalProject.id);
		const table = /* @__PURE__ */ new Map();
		for (const symbol of symbols) table.set(symbol.escapedName, symbol);
		return table;
	}
	getExportSymbol() {
		if (!this.exportSymbol) return this;
		return this.objectRegistry.fetchSymbol(this, "getExportSymbolOfSymbol", this.exportSymbol, this.canonicalProject.id);
	}
	getJsDocTags(checker) {
		return checker.getJsDocTagsOfSymbol(this);
	}
	getDocumentationComment(checker) {
		return checker.getDocumentationCommentOfSymbol(this);
	}
};
var TypeObject = class {
	objectRegistry;
	id;
	flags;
	objectFlags;
	symbol;
	value;
	intrinsicName;
	isThisType;
	freshType;
	regularType;
	target;
	typeParameters;
	outerTypeParameters;
	localTypeParameters;
	aliasTypeArguments;
	aliasSymbol;
	elementFlags;
	fixedLength;
	readonly;
	texts;
	objectType;
	indexType;
	checkType;
	extendsType;
	baseType;
	substConstraint;
	trueType;
	falseType;
	constructor(data, objectRegistry) {
		this.objectRegistry = objectRegistry;
		this.id = data.id;
		this.flags = data.flags;
		if (data.objectFlags !== void 0) this.objectFlags = data.objectFlags;
		if (data.symbol !== void 0) this.symbol = data.symbol;
		if (data.value != null) this.value = data.flags & TypeFlags.BigIntLiteral ? BigInt(data.value) : data.value;
		if (data.intrinsicName !== void 0) this.intrinsicName = data.intrinsicName;
		if (data.isThisType !== void 0) this.isThisType = data.isThisType;
		if (data.freshType !== void 0) this.freshType = data.freshType;
		if (data.regularType !== void 0) this.regularType = data.regularType;
		if (data.target !== void 0) this.target = data.target;
		this.typeParameters = data.typeParameters ?? [];
		this.outerTypeParameters = data.outerTypeParameters ?? [];
		this.localTypeParameters = data.localTypeParameters ?? [];
		this.aliasTypeArguments = data.aliasTypeArguments ?? [];
		if (data.aliasSymbol !== void 0) this.aliasSymbol = data.aliasSymbol;
		if (data.elementFlags !== void 0) this.elementFlags = data.elementFlags;
		if (data.fixedLength !== void 0) this.fixedLength = data.fixedLength;
		if (data.readonly !== void 0) this.readonly = data.readonly;
		if (data.texts !== void 0) this.texts = data.texts;
		if (data.objectType !== void 0) this.objectType = data.objectType;
		if (data.indexType !== void 0) this.indexType = data.indexType;
		if (data.checkType !== void 0) this.checkType = data.checkType;
		if (data.extendsType !== void 0) this.extendsType = data.extendsType;
		if (data.baseType !== void 0) this.baseType = data.baseType;
		if (data.substConstraint !== void 0) this.substConstraint = data.substConstraint;
		this.trueType = false;
		this.falseType = false;
	}
	getSymbol() {
		return this.objectRegistry.fetchSymbol(this, "getSymbolOfType", this.symbol);
	}
	getAliasSymbol() {
		return this.objectRegistry.fetchSymbol(this, "getAliasSymbolOfType", this.aliasSymbol);
	}
	getTarget() {
		return this.objectRegistry.fetchType(this, "getTargetOfType", this.target);
	}
	getFreshType() {
		return this.objectRegistry.fetchType(this, "getFreshTypeOfType", this.freshType);
	}
	getRegularType() {
		return this.objectRegistry.fetchType(this, "getRegularTypeOfType", this.regularType);
	}
	getTypes() {
		if (!(this.flags & (TypeFlags.UnionOrIntersection | TypeFlags.TemplateLiteral))) return;
		return this.objectRegistry.fetchTypes(this, "getTypesOfType");
	}
	getTypeParameters() {
		return this.objectRegistry.fetchTypes(this, "getTypeParametersOfType", this.typeParameters);
	}
	getOuterTypeParameters() {
		return this.objectRegistry.fetchTypes(this, "getOuterTypeParametersOfType", this.outerTypeParameters);
	}
	getLocalTypeParameters() {
		return this.objectRegistry.fetchTypes(this, "getLocalTypeParametersOfType", this.localTypeParameters);
	}
	getAliasTypeArguments() {
		return this.objectRegistry.fetchTypes(this, "getAliasTypeArgumentsOfType", this.aliasTypeArguments);
	}
	getObjectType() {
		return this.objectRegistry.fetchType(this, "getObjectTypeOfType", this.objectType);
	}
	getIndexType() {
		return this.objectRegistry.fetchType(this, "getIndexTypeOfType", this.indexType);
	}
	getCheckType() {
		return this.objectRegistry.fetchType(this, "getCheckTypeOfType", this.checkType);
	}
	getExtendsType() {
		return this.objectRegistry.fetchType(this, "getExtendsTypeOfType", this.extendsType);
	}
	getBaseType() {
		return this.objectRegistry.fetchType(this, "getBaseTypeOfType", this.baseType);
	}
	getConstraint() {
		return this.objectRegistry.fetchType(this, "getConstraintOfType", this.substConstraint);
	}
	getTrueType() {
		const result = this.objectRegistry.fetchType(this, "getTrueTypeOfConditionalType", this.trueType);
		this.trueType = result.id;
		return result;
	}
	getFalseType() {
		const result = this.objectRegistry.fetchType(this, "getFalseTypeOfConditionalType", this.falseType);
		this.falseType = result.id;
		return result;
	}
	/**
	* Get the base types of this type. Returns `undefined` for any type that is
	* not a class or interface.
	*/
	getBaseTypes() {
		if (!this.isClassOrInterface()) return;
		return this.objectRegistry.fetchBaseTypes(this);
	}
	isClassOrInterface() {
		return isClassOrInterfaceType(this);
	}
	isUnionType() {
		return isUnionType(this);
	}
	isIntersectionType() {
		return isIntersectionType(this);
	}
	isObjectType() {
		return isObjectType(this);
	}
	isIntrinsicType() {
		return isIntrinsicType(this);
	}
	isErrorType() {
		return isErrorType(this);
	}
	isLiteralType() {
		return isLiteralType(this);
	}
	isStringLiteralType() {
		return isStringLiteralType(this);
	}
	isNumberLiteralType() {
		return isNumberLiteralType(this);
	}
	isBigIntLiteralType() {
		return isBigIntLiteralType(this);
	}
	isBooleanLiteralType() {
		return isBooleanLiteralType(this);
	}
	isTypeReference() {
		return isTypeReference(this);
	}
	isTupleType() {
		return isTupleType(this);
	}
	isIndexType() {
		return isIndexType(this);
	}
	isIndexedAccessType() {
		return isIndexedAccessType(this);
	}
	isConditionalType() {
		return isConditionalType(this);
	}
	isSubstitutionType() {
		return isSubstitutionType(this);
	}
	isTemplateLiteralType() {
		return isTemplateLiteralType(this);
	}
	isStringMappingType() {
		return isStringMappingType(this);
	}
	isTypeParameter() {
		return isTypeParameter(this);
	}
};
function isUnionType(type) {
	return (type.flags & TypeFlags.Union) !== 0;
}
function isIntersectionType(type) {
	return (type.flags & TypeFlags.Intersection) !== 0;
}
function isObjectType(type) {
	return (type.flags & TypeFlags.Object) !== 0;
}
function isClassOrInterfaceType(type) {
	return isObjectType(type) && (type.objectFlags & ObjectFlags.ClassOrInterface) !== 0;
}
function isIntrinsicType(type) {
	return (type.flags & TypeFlags.Intrinsic) !== 0;
}
/**
* Whether this is the error type — the placeholder the checker produces when a
* type cannot be determined (e.g. an unresolved reference). It is an intrinsic
* type named `"error"` (this covers both the singleton error type and the
* per-alias error types manufactured for unresolved type alias references).
*/
function isErrorType(type) {
	return isIntrinsicType(type) && type.intrinsicName === "error";
}
function isLiteralType(type) {
	return (type.flags & TypeFlags.Literal) !== 0;
}
function isStringLiteralType(type) {
	return (type.flags & TypeFlags.StringLiteral) !== 0;
}
function isNumberLiteralType(type) {
	return (type.flags & TypeFlags.NumberLiteral) !== 0;
}
function isBigIntLiteralType(type) {
	return (type.flags & TypeFlags.BigIntLiteral) !== 0;
}
function isBooleanLiteralType(type) {
	return (type.flags & TypeFlags.BooleanLiteral) !== 0;
}
function isTypeReference(type) {
	return isObjectType(type) && (type.objectFlags & ObjectFlags.Reference) !== 0;
}
function isTupleType(type) {
	return isObjectType(type) && (type.objectFlags & ObjectFlags.Tuple) !== 0;
}
function isIndexType(type) {
	return (type.flags & TypeFlags.Index) !== 0;
}
function isIndexedAccessType(type) {
	return (type.flags & TypeFlags.IndexedAccess) !== 0;
}
function isConditionalType(type) {
	return (type.flags & TypeFlags.Conditional) !== 0;
}
function isSubstitutionType(type) {
	return (type.flags & TypeFlags.Substitution) !== 0;
}
function isTemplateLiteralType(type) {
	return (type.flags & TypeFlags.TemplateLiteral) !== 0;
}
function isStringMappingType(type) {
	return (type.flags & TypeFlags.StringMapping) !== 0;
}
function isTypeParameter(type) {
	return (type.flags & TypeFlags.TypeParameter) !== 0;
}
var Signature = class {
	flags;
	objectRegistry;
	id;
	declaration;
	typeParameters;
	parameters;
	thisParameter;
	target;
	constructor(data, project, objectRegistry) {
		this.id = data.id;
		this.flags = data.flags;
		this.objectRegistry = objectRegistry;
		this.declaration = data.declaration ? new NodeHandle(data.declaration, project) : void 0;
		this.typeParameters = data.typeParameters ?? [];
		this.parameters = data.parameters ?? [];
		this.thisParameter = data.thisParameter;
		this.target = data.target;
	}
	getTypeParameters() {
		return this.objectRegistry.fetchTypes(this, "getTypeParametersOfSignature", this.typeParameters);
	}
	getParameters() {
		return this.objectRegistry.fetchSymbols(this, "getParametersOfSignature", this.parameters);
	}
	getThisParameter() {
		return this.objectRegistry.fetchSymbol(this, "getThisParameterOfSignature", this.thisParameter);
	}
	getTarget() {
		return this.objectRegistry.fetchSignature(this, "getTargetOfSignature", this.target);
	}
	get hasRestParameter() {
		return (this.flags & SignatureFlags.HasRestParameter) !== 0;
	}
	get isConstruct() {
		return (this.flags & SignatureFlags.Construct) !== 0;
	}
	get isAbstract() {
		return (this.flags & SignatureFlags.Abstract) !== 0;
	}
};
//#endregion
//#region src/tsgo.ts
let api;
let snapshot;
const openProjects = /* @__PURE__ */ new Set();
const warned = /* @__PURE__ */ new Set();
/**
* `mustUseNameAtSpan` runs for every expression statement, so the filesystem walk that
* resolves the tsconfig is memoized per directory (`null`: resolved, none found) and the
* program lookup, with its buffer comparison, per file.
*/
const tsconfigsByDir = /* @__PURE__ */ new Map();
const validatedFiles = /* @__PURE__ */ new Map();
/**
* The tsgo client spawns the compiler over Node pipe internals (`stdout._handle.fd`).
* Under Bun that throws and leaves the compiler child keeping the process alive, so
* never spawn anything there.
*/
const BUN = process.versions.bun !== void 0;
/**
* `Option::inspect` carries no `#[must_use]` in Rust (std documents the bare statement form)
* and returns its receiver, so dropping the call loses nothing. `inspectErr` is not listed:
* `Result` is `#[must_use]` as a type, so a dropped `Result` warns in every position.
*/
const PASS_THROUGH_METHOD_NAMES = { inspect: true };
/** Test-only introspection of the module-level caches. */
function __stateForTests() {
	return {
		hasApi: api !== void 0,
		openProjects: [...openProjects]
	};
}
/**
* Type name at the exact span `[start, end)` of `filePath`, or `null`. Never throws.
*
* Returns `null` for every call when the compiler is unavailable; `startApi` has already
* warned in that case.
*/
function mustUseNameAtSpan(filePath, fileText, start, end) {
	try {
		if (api === void 0) return null;
		const tsconfig = findTsconfig(filePath);
		if (tsconfig === void 0) {
			warnOnce(`no-tsconfig:${filePath}`, `no tsconfig.json found for ${filePath}; skipped`);
			return null;
		}
		const project = getProject(tsconfig);
		if (project === void 0) {
			warnOnce(`no-project:${tsconfig}`, `could not open project ${tsconfig}; skipped`);
			return null;
		}
		const sourceFile = sourceFileIn(project, filePath, fileText, tsconfig);
		if (sourceFile === void 0) return null;
		const node = nodeAtSpan(sourceFile, start, end);
		if (node === void 0) {
			warnOnce(`no-node:${filePath}`, `could not map an expression in ${filePath}; skipped`);
			return null;
		}
		const type = project.checker.getTypeAtLocation(node);
		const name = type === void 0 ? null : mustUseNameOfType(type);
		return name === "Option" && !buildsOrTransformsMustUse(node, sourceFile, project.checker) ? null : name;
	} catch (error) {
		warnOnce(`error:${filePath}`, `could not resolve the type of a statement in ${filePath} (${error instanceof Error ? error.message : String(error)}); skipped`);
		return null;
	}
}
/** `console.warn` once per key per process, prefixed `[ts-result-option] `. */
function warnOnce(key, message) {
	if (warned.has(key)) return;
	warned.add(key);
	console.warn(`[ts-result-option] ${message}`);
}
/**
* The compiler child is spawned by the first request, and `spawn` fails with ENOMEM once
* oxlint has started its worker-thread pool (the parent's committed memory is large by
* then). Warm the compiler up while the plugin module loads, before linting starts.
*/
function startApi() {
	if (BUN) {
		warnApiUnavailable("Bun is not supported");
		return;
	}
	try {
		const instance = new API({ cwd: process.cwd() });
		process.once("beforeExit", () => instance.close());
		snapshot = instance.updateSnapshot();
		api = instance;
	} catch (error) {
		warnApiUnavailable(error);
	}
}
/** Warns once that no type information is available for this run. */
function warnApiUnavailable(error) {
	warnOnce("api", `cannot start the TypeScript native API (${error instanceof Error ? error.message : String(error)}); rule disabled for this run (run oxlint with Node)`);
}
startApi();
function buildsOrTransformsMustUse(node, sourceFile, checker) {
	if (!isCallExpression(node) || !isPropertyAccessExpression(node.expression)) return false;
	const callee = node.expression;
	const method = sourceFile.text.slice(callee.name.getStart(sourceFile), callee.name.getEnd());
	if (PASS_THROUGH_METHOD_NAMES[method] === true) return false;
	const receiver = checker.getTypeAtLocation(callee.expression);
	return receiver !== void 0 && mustUseNameOfType(receiver) !== null;
}
function declaredInMustUsePackage(symbol) {
	if (MUST_USE_SYMBOL_NAMES[symbol.name] !== true) return false;
	const declaration = symbol.declarations?.[0] ?? symbol.valueDeclaration;
	return declaration !== void 0 && isInPackageFile(declaration.path);
}
/** Nearest `tsconfig.json` at or above `filePath`, memoized per directory. */
function findTsconfig(filePath) {
	const start = dirname(filePath);
	const cached = tsconfigsByDir.get(start);
	if (cached !== void 0) return cached ?? void 0;
	const visited = [];
	let dir = start;
	let found = null;
	for (;;) {
		const hit = tsconfigsByDir.get(dir);
		if (hit !== void 0) {
			found = hit;
			break;
		}
		visited.push(dir);
		const candidate = join(dir, "tsconfig.json");
		if (existsSync(candidate)) {
			found = candidate;
			break;
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	for (const visitedDir of visited) tsconfigsByDir.set(visitedDir, found);
	return found ?? void 0;
}
function getProject(tsconfig) {
	if (api === void 0) return;
	if (!openProjects.has(tsconfig)) {
		snapshot = api.updateSnapshot({ openProjects: [tsconfig] });
		openProjects.add(tsconfig);
	}
	return snapshot?.getProject(tsconfig);
}
function mustUseNameOfType(type) {
	const symbol = type.getSymbol();
	if (symbol !== void 0 && declaredInMustUsePackage(symbol)) return symbol.name;
	const alias = type.getAliasSymbol();
	if (alias !== void 0 && declaredInMustUsePackage(alias)) return alias.name;
	if (type.isUnionType() || type.isIntersectionType()) for (const member of type.getTypes()) {
		const name = mustUseNameOfType(member);
		if (name !== null) return name;
	}
	return null;
}
/**
* Node whose span is exactly `[start, end)`, preferring the innermost match and
* falling back to the largest node starting at `start` that stays inside `end`
* (hosts whose ranges include parentheses).
*/
function nodeAtSpan(sourceFile, start, end) {
	let node = getTokenAtPosition(sourceFile, start);
	let fallback;
	for (;;) {
		if (node.getStart(sourceFile) !== start) return fallback;
		if (node.getEnd() === end) return node;
		if (node.getEnd() <= end) fallback = node;
		const parent = node.parent;
		if (parent === void 0 || parent === node) return fallback;
		node = parent;
	}
}
/**
* `filePath`'s source file in `project`, or `undefined` when the project does not include it
* or the buffer differs from the file on disk (both warned once).
*/
function sourceFileIn(project, filePath, fileText, tsconfig) {
	const cached = validatedFiles.get(filePath);
	let sourceFile;
	if (cached !== void 0 && cached.fileText === fileText) sourceFile = cached.sourceFile;
	else {
		sourceFile = project.program.getSourceFile(filePath);
		if (sourceFile !== void 0 && sourceFile.text === fileText) validatedFiles.set(filePath, {
			fileText,
			sourceFile
		});
	}
	if (sourceFile === void 0) {
		warnOnce(`no-file:${filePath}`, `no project includes ${filePath} (tsconfig: ${tsconfig})`);
		return;
	}
	if (sourceFile.text !== fileText) {
		warnOnce(`stale:${filePath}`, `${filePath} on disk differs from the linted buffer; skipped (save and re-run)`);
		return;
	}
	return sourceFile;
}
//#endregion
export { mustUseNameAtSpan as n, warnOnce as r, __stateForTests as t };

//# sourceMappingURL=tsgo-DvQVnWZx.mjs.map