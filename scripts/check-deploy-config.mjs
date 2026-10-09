import { readFileSync, existsSync } from "node:fs";

const config = JSON.parse(readFileSync("wrangler.json", "utf8"));
const database = config.d1_databases?.find((item) => item.binding === "DB");
if (!database?.database_id || database.database_id === "00000000-0000-4000-8000-000000000000") {
  console.error("Cloudflare D1에서 dancingknight-db를 만든 뒤, wrangler.json의 database_id를 실제 Database ID로 바꿔 주세요. README.md의 2번을 참고하세요.");
  process.exit(1);
}
if (!existsSync("dist/server/wrangler.json")) {
  console.error("먼저 pnpm run build를 실행해 주세요.");
  process.exit(1);
}
const built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
const builtDatabase = built.d1_databases?.find((item) => item.binding === "DB");
if (built.name !== config.name || builtDatabase?.database_id !== database.database_id) {
  console.error("배포 설정이 빌드 이후에 변경되었습니다. pnpm run build를 다시 실행해 주세요.");
  process.exit(1);
}
