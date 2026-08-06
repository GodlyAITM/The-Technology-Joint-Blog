import { readFileSync } from "node:fs";

for (const file of ["deployed-editor.html", "deployed-login.html", "deployed-dashboard.html"]) {
    const s = readFileSync(file, "utf8");
    console.log(`\n===== ${file} (${s.length} bytes) =====`);
    const keys = ["studio-auth", "data-studio-api", "data-site-base", "localStorage", "sessionStorage"];
    for (const k of keys) {
        let idx = s.indexOf(k);
        let count = 0;
        while (idx !== -1 && count < 6) {
            const start = Math.max(0, idx - 90);
            const snippet = s.slice(start, idx + 90).replace(/\s+/g, " ");
            console.log(`  [${k}] ...${snippet}...`);
            idx = s.indexOf(k, idx + 1);
            count++;
        }
        if (count === 0) console.log(`  [${k}] NOT FOUND`);
    }
}
