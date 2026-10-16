'use strict';

// Small JSON files in YO's user-data folder (%APPDATA%\YO).
// Writes go to a temp file first, then replace the old one, so a crash never leaves half a file.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function file(name) {
  return path.join(app.getPath('userData'), name + '.json');
}

function load(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function save(name, data) {
  const target = file(name);
  const temp = target + '.tmp';
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, target);
  } catch (err) {
    console.warn('Could not save ' + name + ':', err.message);
  }
}

module.exports = { load, save };
