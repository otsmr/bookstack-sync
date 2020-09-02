// Copyright (c) Jamison Dance - https://github.com/jergason/recursive-readdir

import * as p from "path";
import config from "./config";
import { unlinkSync } from "fs";
import * as fs from "fs";
import { normalize } from "path";

export default function readdir( path: string, callback?: {
    (err: NodeJS.ErrnoException, filelist?: {filepath: string, size: number, modifiedAt: string}[])
}) {

    let list = [];

    fs.readdir(path, function (err, files) {
        if (err) return callback(err);
        
        let pending = files.length;
        if (!pending) {
            // we are done, woop woop
            return callback(null, list);
        }

        files.forEach(function (file) {

            const filePath = p.join(path, file);

            fs.stat(filePath, function (_err, stats) {
                if (_err) {
                    return callback(_err);
                }

                if (stats.isDirectory()) {
                    readdir(filePath, function (__err, res) {
                        if (__err) {
                            return callback(__err);
                        }

                        list = list.concat(res);
                        pending -= 1;
                        if (!pending) {
                            return callback(null, list);
                        }
                    });
                } else {
                    list.push({
                        filepath: filePath,
                        size: stats.size,
                        modifiedAt: stats.mtime
                    });
                    pending -= 1;
                    if (!pending) {
                        return callback(null, list);
                    }
                }
            });

        });

    });

}

export function removeOldFiles () {

    fs.mkdirSync(config.get("backupPath"), { recursive: true })

    readdir(config.get("backupPath"), (err, fileList) => {

        try {
            
            for (let i = 0;i<10;i++) {
    
                if (fileList.length > config.get("backupMaxSavedFiles")) {
                    fileList = fileList.slice(0, config.get("backupMaxSavedFiles") - fileList.length);
                    for (const file of fileList) {
                        unlinkSync(normalize(file.filepath));
                    }
    
                } else {
                    break;
                }
    
            }

        } catch (error) {
            
        }

    });

}