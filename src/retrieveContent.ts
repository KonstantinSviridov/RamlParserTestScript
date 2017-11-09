import path = require("path");
import fs = require("fs");

const nZip = require("node-zip");
import mkdirp = require("mkdirp");
import utils = require("./utils");

const requestPromise = require("request-promise-native");

let targetPath = __dirname;
mkdirp.sync(targetPath);

export function operate() {

    let exportUrl = utils.getContentURI();
    if(!exportUrl){
        console.warn("Content URI is not provided");
    }

    return requestPromise(exportUrl, {encoding: null}).then(download => {

        //fs.writeFileSync(path.resolve(apiFolder, "archive.zip"), download);
        let zip = new nZip(download, {base64: false, checkCRC32: true});
        for (let fileName of Object.keys(zip.files)) {
            let entry = zip.files[fileName];
            if (entry.dir) {
                continue;
            }
            let content = entry._data;
            let filePath = path.resolve(targetPath, fileName);
            mkdirp.sync(path.dirname(filePath));
            fs.writeFileSync(filePath, content);
        }
    }, err => {
        console.warn(`Failed to download '${exportUrl}`);
        console.warn(utils.truncateMessage(err));
    });
}
