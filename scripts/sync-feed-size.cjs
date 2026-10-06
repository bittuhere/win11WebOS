// Run through npm run release:feed after the build, before committing the GitHub feed.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'public/updates/feed.json');
const feed=JSON.parse(fs.readFileSync(source,'utf8'));
const built=JSON.parse(fs.readFileSync(path.join(root,'build/updates/feed.json'),'utf8'));
assert.equal(feed.latest.version,built.latest.version,'Build the matching release before synchronizing its feed');
assert.ok(Number.isSafeInteger(built.latest.size) && built.latest.size>0,'Missing generated offline payload size');
feed.latest.size=built.latest.size;
fs.writeFileSync(source,JSON.stringify(feed,null,2)+'\n');
console.log(`GitHub source feed v${feed.latest.version}: ${feed.latest.size} verified payload bytes. Review/commit this file; this command does not push or publish.`);
