const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'embedDB.json');

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({}));
      return {};
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('[embedDB] Erro ao carregar DB:', error);
    return {};
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[embedDB] Erro ao salvar DB:', error);
  }
}

function addEmbed(userId, embedData) {
  const db = loadDB();
  if (!db[userId]) db[userId] = [];
  db[userId].push(embedData);
  saveDB(db);
}

function getEmbeds(userId) {
  const db = loadDB();
  return db[userId] || [];
}

function removeEmbed(userId, index) {
  const db = loadDB();
  if (!db[userId] || index < 0 || index >= db[userId].length) return false;
  db[userId].splice(index, 1);
  saveDB(db);
  return true;
}

module.exports = {
  addEmbed,
  getEmbeds,
  removeEmbed,
};
