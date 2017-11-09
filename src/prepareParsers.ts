import path = require("path");
import fs = require("fs");
import utils = require("./utils");
import testUtils = require("raml-1-parser-test-utils");
import mkdirp = require("mkdirp");
import devEnvInstaller = require("dev-env-installer");

export function oprate() {
    
    const rootDir = testUtils.rootDir(__dirname);
    let wsRoot = path.resolve(rootDir, '../');
    let parserWsDir = path.resolve(wsRoot,"parser");
    let parserDir = path.resolve(parserWsDir,utils.parserRepoName);
    let parserMasterWsDir = path.resolve(wsRoot,"parser-master");
    let parserMasterDir = path.resolve(parserMasterWsDir,utils.parserRepoName);

    mkdirp.sync(parserWsDir);
    mkdirp.sync(parserMasterWsDir);
    let masterCommitId = utils.getMasterCommitId();
    let masterBranchId = utils.getMasterBranchId();
    if(masterCommitId){
        testUtils.cloneRepository(parserMasterWsDir,utils.parserRepoUri);
        testUtils.checkoutCommit(parserMasterDir,masterCommitId);
    }
    else if(masterBranchId){
        testUtils.cloneRepository(parserMasterWsDir,utils.parserRepoUri,{
            "--branch" : masterBranchId,
            "--depth" : "=1"
        });
    }
    else {
        testUtils.cloneRepository(parserMasterWsDir, utils.parserRepoUri, {"--depth": "=1"});
    }
    let targetCommitId = utils.getTargetCommitId();
    let branchId = utils.getTargetBranchId();
    let isSufficient = true;
    if (!targetCommitId && !branchId) {
        isSufficient = false;
        console.warn("No commit ID or branch name has been specified in the commit message or command line.");
        console.warn("The comparison procedure is not going to be started.");
    }
    else if (targetCommitId) {
        testUtils.cloneRepository(parserWsDir,utils.parserRepoUri);
        testUtils.checkoutCommit(parserDir,targetCommitId);
    }
    else {
        testUtils.cloneRepository(parserWsDir,utils.parserRepoUri,{
            "--branch" : branchId,
            "--depth" : "=1"
        });
    }
    let masterParserModuleDir = path.resolve(rootDir,"node_modules/raml-1-parser-master");
    mkdirp.sync(path.dirname(masterParserModuleDir));
    let masterDescriptorPath = path.resolve(parserMasterDir,utils.workspaceDescriptioName);
    let masterInstallCommand = `dev-env-installer install --workspace "${parserMasterWsDir}" --descriptor "${masterDescriptorPath}" -directlinks`;
    devEnvInstaller.utils.execProcess(masterInstallCommand, parserMasterDir, true);
    devEnvInstaller.utils.execProcess("npm run buildall", parserMasterDir, true);
    devEnvInstaller.utils.createSymlink(parserMasterDir,masterParserModuleDir);

    let parserModuleDir = path.resolve(rootDir,"node_modules/raml-1-parser");
    mkdirp.sync(path.dirname(parserModuleDir));
    if(isSufficient){
        let descriptorPath = path.resolve(parserDir,utils.workspaceDescriptioName);
        let installCommand = `dev-env-installer install --workspace "${parserWsDir}" --descriptor "${descriptorPath}" -directlinks`;
        devEnvInstaller.utils.execProcess(installCommand, parserDir, true);
        devEnvInstaller.utils.execProcess("npm run buildall", parserDir, true);
        devEnvInstaller.utils.createSymlink(parserDir,parserModuleDir);
    }
    else {
        devEnvInstaller.utils.createSymlink(parserMasterDir, parserModuleDir);
    }
}

oprate();
