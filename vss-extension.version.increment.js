const fs = require('fs');
const path = require('path');

function incrementPatchVersion(vssExtensionJsonPath, taskJsonPath) {
  const vssExtensionJson = JSON.parse(fs.readFileSync(vssExtensionJsonPath));
  const taskJson = JSON.parse(fs.readFileSync(taskJsonPath));
  const version = taskJson.version || { Major: 0, Minor: 0, Patch: 0 };

  // Increment patch version to a revision number based on the current date
  version.Patch = new Number(
    new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(3, 12), // YMMDDHHmm
  );

  // Update task.json
  if (taskJson) {
    taskJson.version = version;
    fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 2));
  }

  // Update vss-extension.json
  if (vssExtensionJson) {
    vssExtensionJson.version = taskJson.version.Major + '.' + taskJson.version.Minor + '.' + taskJson.version.Patch;
    fs.writeFileSync(vssExtensionJsonPath, JSON.stringify(vssExtensionJson, null, 2));
  }
}

incrementPatchVersion(path.join(__dirname, 'vss-extension.json'), path.join(__dirname, 'task', 'task.json'));
