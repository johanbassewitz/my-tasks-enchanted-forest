import type {DatabaseSync} from 'node:sqlite';
export const latestSchemaVersion=2;
export function migrate(db:DatabaseSync):void {
 db.exec('CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL)');
 const row=db.prepare('SELECT version FROM schema_version LIMIT 1').get();let version=Number(row?.version||0);
 if(version>latestSchemaVersion)throw Error('This database was created by a newer version of My Tasks. Update the app before opening it.');
 if(version<1){db.exec("CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,itemId TEXT NOT NULL UNIQUE,action TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '');");version=1;}
 if(version<2){db.exec('CREATE INDEX IF NOT EXISTS outbox_action_idx ON outbox(action)');version=2;}
 db.exec('DELETE FROM schema_version');db.prepare('INSERT INTO schema_version VALUES(?)').run(version);
}
