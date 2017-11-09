import path = require("path");
import fs = require("fs");
import mkdirp = require("mkdirp");
import utils = require("./utils");
import testUtils = require("raml-1-parser-test-utils");
import parser = require("raml-1-parser");
var promiseTimeout = require("promise-timeout");
import parserMaster = require("raml-1-parser-master");
import devEnvInstaller = require("dev-env-installer");
var oldParser = require("raml-parser");
import retrieve = require("./retrieveContent");

export const CLI_ARG_NAME_ONLY_SUFFICIENT = "--onlySufficient";
export const CLI_ARG_NAME_COMMIT_CACHE = "--commitCache";
export const CLI_ARG_NAME_LIMIT_TIME = "--limitTime";
const DEFAULT_TIME_LIMIT = 20*60*1000;

function operate():Promise<any>{

    let onlySufficient = devEnvInstaller.utils.hasCliArgument(CLI_ARG_NAME_ONLY_SUFFICIENT);
    let doCommitCache = devEnvInstaller.utils.hasCliArgument(CLI_ARG_NAME_COMMIT_CACHE);
    let limitTime = devEnvInstaller.utils.hasCliArgument(CLI_ARG_NAME_LIMIT_TIME);
    if(onlySufficient) {
        let commitId = utils.getTargetCommitId();
        let branchId = utils.getTargetBranchId();
        if (!commitId && !branchId) {
            console.warn("No commit ID or branch name has been specified in the commit message or command line.");
            console.warn("The build has been cancelled.");
            return;
        }
    }
    
    let pd = utils.platformDir();
    let cacheDir = utils.cacheDir();
    let oldParserCacheDir = utils.oldParserCacheDir();
    let noDiff = true;
    let cacheDirty = false;
    let reportDirty = false;

    let ramlFiles = collectRamlFiles(pd);
    let startIndex = 0;
    let nextFile = utils.getNextFilePath();
    if(nextFile){
        let ind = ramlFiles.indexOf(nextFile);
        if(ind>=0){
            startIndex = ind;
        }
    }

    let timeLimit = DEFAULT_TIME_LIMIT;
    let timeLimitStr = process.env.TIME_LIMIT_MINUTES;
    if(timeLimitStr != null){
        try{
            timeLimit = parseFloat(timeLimitStr) * 60 * 1000;
        }
        catch(e){
            timeLimit = DEFAULT_TIME_LIMIT;
        }
    }

    let startTime = new Date().getTime();

    let reportObject = {};

    let processRamlFile = function (ind:number,limitTime=false):Promise<string> {

        let ramlFile = ramlFiles[ind];
        if(limitTime) {
            let time = new Date().getTime() - startTime;
            if (time > timeLimit) {
                return Promise.resolve<string>(path.relative(pd,ramlFile));
            }
        }
        let apiDirPath = path.dirname(ramlFile);

        let firstLine = ramlFirstLine(fs.readFileSync(ramlFile,"utf-8"));
        if(firstLine.length<2){
            return Promise.resolve<string>(null);
        }

        let isRAML08 = firstLine[1] == "0.8";
        let relDirPath = path.relative(pd, apiDirPath);
        let apiCacheDirPath = path.resolve(cacheDir, relDirPath);
        let apiOldParserCacheDirPath = path.resolve(oldParserCacheDir, relDirPath);

        console.log(`Processing '${path.relative(pd, ramlFile)}'`);

        let ext = path.extname(ramlFile);
        let baseName = path.basename(ramlFile);
        let name = baseName.substring(0,baseName.length-ext.length);
        let masterJsonCachePath = path.resolve(apiCacheDirPath, `${name}-master.json`);
        let masterJSON: any;
        let json:any;

        let masterPromise:any = Promise.resolve();

        let apiReportObject:any = {};

        if (fs.existsSync(masterJsonCachePath)) {
            masterJSON = JSON.parse(fs.readFileSync(masterJsonCachePath, "utf8"));
        }
        else {
            masterPromise = promiseTimeout.timeout(
                parserMaster.loadRAML(ramlFile, null),30*1000).then(api=>{

                masterJSON = api.toJSON({rootNodeDetails: true});
                console.log("Writing to cache");
                mkdirp.sync(path.dirname(masterJsonCachePath));
                fs.writeFileSync(masterJsonCachePath, JSON.stringify(masterJSON, null, 2));
                cacheDirty = true;
            },e => {
                console.warn("Parser (master) failure:");
                console.warn(utils.truncateMessage(e));
                apiReportObject.masterParserError = e.message ? e.message : e.toString();
            });
        }
        let commitPromise = masterPromise.then( x => {
            return promiseTimeout.timeout(parser.loadRAML(ramlFile, null), 30*1000).then(api => {
                json = api.toJSON({rootNodeDetails: true});
                let diff = testUtils.compare(masterJSON, json);
                if (diff.length > 0) {
                    console.warn("Diff detected");
                    noDiff = false;
                    apiReportObject.diff = diff.map(x=>{
                        return{
                            "path": x.path(),
                            "comment": x.comment(),
                            "master": x.values()[0],
                            "inspected": x.values()[1]
                        };
                    });
                }
            }, e => {
                console.warn("Parser (inspected version) failure:");
                console.warn(utils.truncateMessage(e));
                apiReportObject.inspectedParserError = e.message ? e.message : e.toString();
            });
        });
        let oldParserInspectionPromise = commitPromise.then(x=> {
            if (!isRAML08) {
                return Promise.resolve<any>(null);
            }
            let oldParserCachedResult = path.resolve(apiOldParserCacheDirPath, `${name}.txt`);
            let oldParserPromise: Promise<any>;
            if (fs.existsSync(oldParserCachedResult)) {
                let oldResult = fs.readFileSync(oldParserCachedResult, "utf-8");
                oldParserPromise = Promise.resolve(oldResult);
            }
            else {
                oldParserPromise = oldParser.loadFile(ramlFile).then(x=>{
                    console.log("Writing to cache (old parser result)");
                    mkdirp.sync(path.dirname(oldParserCachedResult));
                    fs.writeFileSync(oldParserCachedResult, "OK");
                    cacheDirty = true;
                    return Promise.resolve("OK");
                },err=>{
                    let msg = err.message ? err.message : err.toString();
                    console.log("Writing to cache (old parser result)");
                    mkdirp.sync(path.dirname(oldParserCachedResult));
                    fs.writeFileSync(oldParserCachedResult, msg);
                    cacheDirty = true;
                    return Promise.resolve(msg);
                });
            }
            return oldParserPromise.then(x=>{
                if(x=="OK") {
                    if (masterJSON && masterJSON.errors.filter(x=>!x.isWarning).length > 0) {
                        console.warn("The 'master' branch parser reports errors while the old parser does not");
                        apiReportObject.oldParserErrors = "none";
                        apiReportObject.mastrerParserErrors = masterJSON.errors;
                    }
                    if (json && json.errors.filter(x=>!x.isWarning).length > 0) {
                        console.warn("The inspected parser version reports errors while the old parser does not");
                        apiReportObject.oldParserErrors = "none";
                        apiReportObject.inspectedParserErrors = json.errors;
                    }
                }
                else{
                    if(masterJSON && masterJSON.errors.filter(x=>!x.isWarning).length==0){
                        console.warn("The 'master' branch parser does not report any errors while the old parser does so");
                        apiReportObject.oldParserErrors = x.message ? x.message : x.toString();
                        apiReportObject.mastrerParserErrors = "none";
                    }
                    if(json && json.errors.filter(x=>!x.isWarning).length==0){
                        console.warn("The inspected parser parser does not report any errors while the old parser does so");
                        apiReportObject.oldParserErrors = x.message ? x.message : x.toString();
                        apiReportObject.inspectedParserErrors = "none";
                    }
                }
            })
        },err=>{
            console.log(err);
        }).then(x=>{
            if(Object.keys(apiReportObject).length>0) {
                reportDirty = reportDirty
                    || utils.appendReportObject(reportObject, apiReportObject, ramlFile);
            }
        });

        return oldParserInspectionPromise.then(x=>{
            if(ind < ramlFiles.length-1){
                return processRamlFile(ind+1,limitTime);
            }
            else{
                return Promise.resolve();
            }
        });
    };

    return processRamlFile(startIndex,limitTime).then(nextFile=>{

        utils.saveReportObject(reportObject);
        if(nextFile || (doCommitCache && (cacheDirty||reportDirty))){
            let rootDir = testUtils.rootDir(__dirname);
            console.log("Script: set SSH URL");
            testUtils.setSSHUrl(rootDir);
            console.log("Script: set GIT user");
            testUtils.setGitUser(rootDir);
            let homeDir = path.resolve(rootDir, "../../../");
            console.log("Script: Configure security");
            testUtils.configureSecurity(homeDir);
            let commitMessage = "";
            if (cacheDirty) {
                commitMessage += utils.TRAVIS_COMMIT_CACHE_UPDATE + "\n";
            }
            if (nextFile) {
                let targetCommitId = utils.getTargetCommitId();
                let targetBranchId = utils.getTargetBranchId();
                if (targetCommitId) {
                    commitMessage = `${utils.TARGET_COMMIT}=${utils.getTargetCommitId()}` + "\n";
                }
                else if (targetBranchId) {
                    commitMessage = `${utils.TARGET_BRANCH}=${utils.getTargetBranchId()}` + "\n";
                }
                commitMessage += `${utils.NEXT_FILE}=${nextFile}`;
                let masterCommitId = utils.getMasterCommitId();
                if(masterCommitId){
                    commitMessage += `\n${utils.MASTER_COMMIT}=${masterCommitId}`;
                }
            }
            if(commitMessage.trim().length==0){
                commitMessage = utils.TRAVIS_COMMIT_COMPARISON_COMPLETE;
            }
            console.log("Script commit message: " + commitMessage);
            let commitMessageFileName = "__commitText.txt";
            let commitMessageFilePath = path.resolve(rootDir, commitMessageFileName);
            console.log("Script commit message file path: " + commitMessageFilePath);
            fs.writeFileSync(commitMessageFilePath, commitMessage);
            if (!cacheDirty) {
                testUtils.insertDummyChanges(rootDir);
            }
            testUtils.contributeTheStorage( rootDir,
                ["trigger.txt", "cache/*", "reports/*"], commitMessageFileName, true);
            fs.unlinkSync(commitMessageFilePath);
        }
    },err=>{
        console.warn(utils.truncateMessage(err));
    }).then(x=>{
        if(!noDiff){
            throw new Error("Diff detected");
        }
    });
}

function ramlFirstLine(content:string):RegExpMatchArray{
    return content.match(/^\s*#%RAML\s+(\d\.\d)\s*(\w*)\s*$/m);
}

function collectRamlFiles(dirPath:string,result:string[]=[]):string[]{

    if (!fs.lstatSync(dirPath).isDirectory()) {
        return;
    }
    let ramlFiles:string[] = [];
    let childDirectories:string[] = [];
    for( var chName of fs.readdirSync(dirPath)) {
        let chPath = path.resolve(dirPath,chName);
        if(path.extname(chName)==".raml"){
            ramlFiles.push(chPath);
        }
        else if(fs.lstatSync(chPath).isDirectory()){
            childDirectories.push(chPath);
        }
    }
    if(ramlFiles.length==0){
        for(var chDir of childDirectories){
            collectRamlFiles(chDir,result);
        }
    }
    else {
        for(var rf of ramlFiles){
            let firstLine = ramlFirstLine(fs.readFileSync(rf,"utf-8"));
            if(firstLine && firstLine.length>=2){
                result.push(rf);
            }
        }
    }
    return result;
}

retrieve.operate().then(x=>operate(),err=>{console.warn(err)});
