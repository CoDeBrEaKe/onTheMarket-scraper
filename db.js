const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "properties.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT UNIQUE NOT NULL,
    address     TEXT,
    price       TEXT,
    type        TEXT,
    beds        INTEGER,
    description TEXT,
    agent       TEXT,
    images      TEXT,
    scraped_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const stmtInsert = db.prepare(`
  INSERT OR REPLACE INTO properties (url, address, price, type, beds, description, agent, images)
  VALUES (@url, @address, @price, @type, @beds, @description, @agent, @images)
`);

const stmtExists = db.prepare("SELECT 1 FROM properties WHERE url = ?");

function saveProperty(property) {
  return stmtInsert.run({
    ...property,
    images: JSON.stringify(property.images || []),
  });
}

function propertyExists(url) {
  return !!stmtExists.get(url);
}

module.exports = { db, saveProperty, propertyExists };
