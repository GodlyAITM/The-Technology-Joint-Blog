import { readFileSync } from "node:fs";

const deployed = readFileSync("deployed-editor.js", "utf8");

function probe(label, needle, haystack = deployed) {
    const idx = haystack.indexOf(needle);
    console.log(`${idx === -1 ? "NOT-FOUND" : `FOUND @${idx}`}  ${label}`);
    return idx;
}

console.log("========== DEPLOYED editor bundle analysis ==========");
console.log(`size: ${deployed.length}`);

// 1. setStatus declaration form
const fnSet = probe('"function setStatus(" (hoisted) present');
const constSet = probe('"const setStatus=" (TDZ-prone const) present');
const arrowSet = probe('"const setStatus=" (arrow) present');
const fnSetIdx = deployed.indexOf("function setStatus(");
const constSetIdx = deployed.indexOf("setStatus=");

// 2. order of loadArticleFromUrl invocation vs setStatus declaration
const invokeIdx = deployed.indexOf("loadArticleFromUrl()");
console.log(`\nloadArticleFromUrl() invoked at @${invokeIdx}`);
if (fnSetIdx !== -1) {
    console.log(
        `function setStatus declared @${fnSetIdx} → ${
            fnSetIdx > invokeIdx
                ? "AFTER invocation (still safe, function decls are hoisted)"
                : "BEFORE invocation (safe)"
        }`,
    );
}
if (constSetIdx !== -1) {
    console.log(
        `const setStatus initialized @${constSetIdx} → ${
            constSetIdx > invokeIdx
                ? "AFTER invocation ⇒ TDZ ReferenceError at runtime (BROKEN)"
                : "BEFORE invocation (safe)"
        }`,
    );
}

// 3. storage key used for studio-auth
probe('sessionStorage "studio-auth" (new)');
probe('localStorage "studio-auth" (old)');

// 4. other recent fixes
probe('normalizeDateTime (datetime fix)');
probe('blockScalar === "|" (literal block scalar fix)');
probe('"Loading article from GitHub" status text');
probe('getStudioConfig()');
probe('studio-github-config');
probe('"GitHub is not connected" error text');
probe('window.location.search', "read slug via search params");

console.log("\n========== slice around setStatus declaration ==========");
if (fnSetIdx !== -1) {
    console.log(deployed.slice(Math.max(0, fnSetIdx - 120), fnSetIdx + 160));
} else if (constSetIdx !== -1) {
    console.log(deployed.slice(Math.max(0, constSetIdx - 120), constSetIdx + 160));
}

console.log("\n========== slice around loadArticleFromUrl invocation ==========");
console.log(deployed.slice(Math.max(0, invokeIdx - 200), invokeIdx + 120));
