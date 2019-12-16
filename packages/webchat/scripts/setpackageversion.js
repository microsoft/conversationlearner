"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs-extra");
var path = require("path");
var execa = require("execa");
var packageJsonPath = path.join(__dirname, '..', 'package.json');
var packageLockJsonPath = path.join(__dirname, '..', 'package-lock.json');
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var gitTagsOutput, tagVersions, highestTag, breaking, feature, patch, nextVersion, packageJsonObj, packageLockJsonObj, version, newPackageJson, newPackageLockJson, e_1, error, e_2, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Get last release:");
                    return [4 /*yield*/, execa.stdout('git', ['tag', '-l', '--sort=v:refname'])];
                case 1:
                    gitTagsOutput = _a.sent();
                    tagVersions = gitTagsOutput.split('\n')
                        .filter(function (t) { return /v(\d+).(\d+).(\d+)/.test(t); })
                        .reduce(function (versions, t) {
                        var match = t.match(/v(\d+).(\d+).(\d+)/);
                        if (match === null) {
                            return versions;
                        }
                        var _a = match.slice(1, 4).map(function (x) { return parseInt(x); }), breaking = _a[0], feature = _a[1], patch = _a[2];
                        return versions.concat([{
                                breaking: breaking,
                                feature: feature,
                                patch: patch,
                                original: t
                            }]);
                    }, []);
                    highestTag = tagVersions[tagVersions.length - 1];
                    breaking = highestTag.breaking, feature = highestTag.feature, patch = highestTag.patch;
                    nextVersion = breaking + "." + (feature + 1) + "." + patch;
                    console.log("Last Release: ", highestTag.original);
                    console.log("Next Version: ", nextVersion);
                    console.log("Reading package.json from: " + packageJsonPath);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 7, , 8]);
                    return [4 /*yield*/, fs.readJson(packageJsonPath)];
                case 3:
                    packageJsonObj = _a.sent();
                    return [4 /*yield*/, fs.readJson(packageLockJsonPath)];
                case 4:
                    packageLockJsonObj = _a.sent();
                    version = packageJsonObj.version;
                    console.log("Found version: " + version);
                    newPackageJson = __assign({}, packageJsonObj, { version: nextVersion });
                    newPackageLockJson = __assign({}, packageLockJsonObj, { version: nextVersion });
                    console.log("Writing version: " + nextVersion + " to " + packageJsonPath);
                    return [4 /*yield*/, fs.writeJson(packageJsonPath, newPackageJson, { spaces: '  ' })];
                case 5:
                    _a.sent();
                    console.log("Writing version: " + nextVersion + " to " + packageLockJsonPath);
                    return [4 /*yield*/, fs.writeJson(packageLockJsonPath, newPackageLockJson, { spaces: '  ' })];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    e_1 = _a.sent();
                    error = e_1;
                    console.error(error.message);
                    process.exit(1);
                    return [3 /*break*/, 8];
                case 8:
                    console.log("Create tag on current commit using the next version: " + nextVersion);
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, execa('git', ['tag', '-a', '-m', "" + nextVersion, "v" + nextVersion])];
                case 10:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 11:
                    e_2 = _a.sent();
                    error = e_2;
                    console.error("Error when attempting to create tag: " + nextVersion, error.message);
                    process.exit(1);
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/];
            }
        });
    });
}
main();
//# sourceMappingURL=setpackageversion.js.map