const fs = require('fs');
const path = require('path');

function incrementPatchVersion(vssExtensionJsonPath, taskJsonPath) {
  const vssExtensionJson = JSON.parse(fs.readFileSync(vssExtensionJsonPath));
  const taskJson = JSON.parse(fs.readFileSync(taskJsonPath));
  const version = taskJson.version || { Major: 1, Minor: 0, Patch: 0 };
  version.Patch += 1;
  if (taskJson) {
    taskJson.version = version;
    fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 2));
  }
  if (vssExtensionJson) {
    vssExtensionJson.version = taskJson.version.Major + '.' + taskJson.version.Minor + '.' + taskJson.version.Patch;
    fs.writeFileSync(vssExtensionJsonPath, JSON.stringify(vssExtensionJson, null, 2));
  }
}

incrementPatchVersion(path.join(__dirname, 'vss-extension.json'), path.join(__dirname, 'task', 'task.json'));
