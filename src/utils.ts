import path = require("path");
import fs = require("fs");
import mkdirp = require("mkdirp");
import devEnvInstaller = require("dev-env-installer");
import testUtils = require("raml-1-parser-test-utils");

export const TARGET_COMMIT = 'TARGET_COMMIT';
export const MASTER_COMMIT = 'MASTER_COMMIT';
export const TARGET_BRANCH = 'TARGET_BRANCH';
export const MASTER_BRANCH = 'MASTER_BRANCH';
export const NEXT_FILE = 'NEXT_FILE';
export const CONTENT_URI = 'CONTENT_URI';
export const targetBranchArgName = "--branch";
export const masterBranchArgName = "--masterBranch";
export const targetCommitArgName = "--targetCommit";
export const masterCommitArgName = "--masterCommit";
export const contentUriArgName = "--branch";
export const parserRepoUri = "https://github.com/raml-org/raml-js-parser-2";
export const parserRepoName = "raml-js-parser-2";
export const workspaceDescriptioName = "workspace.json";


export const TRAVIS_COMMIT_CACHE_UPDATE = "MASTER_CACHE_UPDATE";
export const TRAVIS_COMMIT_COMPARISON_COMPLETE = "Comparison complete";
export const TRAVIS_COMMIT_CACHE_UPDATE_NEXT_INDEX_MESSAGE = "TRAVIS_SNAPSHOT_UPDATE_NEXT_INDEX";



export function platformDir():string {
    var rootDirPath = testUtils.rootDir(__dirname);
    let platformDir = path.resolve(rootDirPath, "../content");
    if(!fs.existsSync(platformDir)){
        throw new Error("Platform content not found");
    }
    return platformDir;
}

export function cacheDir():string {
    let rd = testUtils.rootDir(__dirname);
    let masterParserDir = path.resolve(rd, './node_modules/raml-1-parser-master');
    let id = testUtils.getLastCommitId(masterParserDir);
    let result = path.resolve(rd, `cache/${id}`);
    return result;
}

export function oldParserCacheDir():string {
    let rd = testUtils.rootDir(__dirname);
    let result = path.resolve(rd, "cache/__oldParser");
    return result;
}

export function getTargetCommitId():string{

    let commitIdArg = devEnvInstaller.utils.getCliArgumentByName(targetCommitArgName);
    if(commitIdArg){
        return commitIdArg;
    }
    return testUtils.extractValueFromTravisCommitMessage(TARGET_COMMIT);
}

export function getMasterCommitId():string{

    let commitIdArg = devEnvInstaller.utils.getCliArgumentByName(masterCommitArgName);
    if(commitIdArg){
        return commitIdArg;
    }
    return testUtils.extractValueFromTravisCommitMessage(MASTER_COMMIT);
}

export function getNextFilePath():string{

    let nf = testUtils.extractValueFromTravisCommitMessage(NEXT_FILE);
    if(!nf){
        return null;
    }
    if(!path.isAbsolute(nf)){
        nf = path.resolve(platformDir(),nf);
    }
    return nf;
}

export function getTargetBranchId():string{

    let commitIdArg = devEnvInstaller.utils.getCliArgumentByName(targetBranchArgName);
    if(commitIdArg){
        return commitIdArg;
    }
    return testUtils.extractValueFromTravisCommitMessage(TARGET_BRANCH);
}

export function getContentURI():string{

    let contentUri = devEnvInstaller.utils.getCliArgumentByName(contentUriArgName);
    if(contentUri){
        return contentUri;
    }
    return testUtils.extractValueFromTravisCommitMessage(CONTENT_URI);
}


export function getMasterBranchId():string{

    let commitIdArg = devEnvInstaller.utils.getCliArgumentByName(masterBranchArgName);
    if(commitIdArg){
        return commitIdArg;
    }
    return testUtils.extractValueFromTravisCommitMessage(MASTER_BRANCH);
}

export function appendReportObject(mainObject:any,apiReportObject:any,absPath:string):boolean{

    let relPath = "/"+path.relative(platformDir(),absPath);
    let p1 = path.dirname(relPath);
    let apiName = path.basename(p1);
    let orgName = path.basename(path.dirname(p1));

    let orgReportObject = mainObject[orgName];
    if(!orgReportObject){
        orgReportObject = {};
        mainObject[orgName] = orgReportObject;
    }
    let dirty = false;
    let previousApiReportobject = orgReportObject[apiName];
    if(previousApiReportobject){
        dirty = testUtils.compare(previousApiReportobject,apiReportObject).length == 0;
    }
    orgReportObject[apiName] = apiReportObject;
    return dirty;
}

export function saveReportObject(obj:any){

    let rd = testUtils.rootDir(__dirname);
    let masterParserDir = path.resolve(rd, './node_modules/raml-1-parser-master');
    let lastMasterCommit = testUtils.getLastCommitId(masterParserDir);
    let parserDir = path.resolve(rd, './node_modules/raml-1-parser');
    let lastCommit = testUtils.getLastCommitId(parserDir);

    let reportDir = path.resolve(rd,"reports");
    let reportFileName = `master_${lastMasterCommit}_target_${lastCommit}.json`;

    let reportPath = path.resolve(reportDir,reportFileName);
    mkdirp.sync(path.dirname(reportPath));
    fs.writeFileSync(reportPath,JSON.stringify(obj,null,2));
}

export function truncateMessage(err: any): string {
    let eMessage = err.toString();
    if (!eMessage) {
        return eMessage;
    }
    let ind = eMessage.indexOf("\n");
    if (ind < 0) {
        return eMessage;
    }
    return eMessage.substring(0, ind);
}
