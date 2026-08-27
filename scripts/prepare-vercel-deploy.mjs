import crypto from "node:crypto";
import fs from "node:fs";

const envExample = fs.existsSync(".env.example") ? fs.readFileSync(".env.example", "utf8") : "";
const required = ["ADMIN_PASSWORD", "GEMINI_API_KEY", "AUTH_SECRET", "CRON_SECRET"];
const missingFromExample = required.filter((key) => !envExample.includes(`${key}=`));

console.log("Precision Mirror Finder production checklist\n");

if (missingFromExample.length) {
  console.log(`Missing from .env.example: ${missingFromExample.join(", ")}`);
  process.exitCode = 1;
}

console.log("1. Create a GitHub repo, then run:");
console.log("   git init");
console.log("   git add .");
console.log('   git commit -m "Prepare Vercel deployment"');
console.log("   git branch -M main");
console.log("   git remote add origin https://github.com/YOUR-USER/precision-mirror-finder.git");
console.log("   git push -u origin main\n");

console.log("2. In Vercel:");
console.log("   Add New Project -> Import the GitHub repo -> Framework Preset: Next.js");
console.log("   Storage -> Create/Connect Postgres, then attach it to this project.");
console.log("   Vercel will add POSTGRES_URL automatically.\n");

console.log("3. Add these Environment Variables in Vercel Project Settings:");
console.log("   ADMIN_PASSWORD=<your admin dashboard password>");
console.log("   GEMINI_API_KEY=<your Gemini API key>");
console.log(`   AUTH_SECRET=${crypto.randomBytes(32).toString("hex")}`);
console.log(`   CRON_SECRET=${crypto.randomBytes(32).toString("hex")}`);
console.log("   SALES_TAX_RATE=0.06625\n");

console.log("4. After Vercel has POSTGRES_URL, run this locally once to migrate production:");
console.log("   vercel env pull .env.vercel.local");
console.log("   node scripts/migrate-database.mjs --env-file=.env.vercel.local --postgres\n");

console.log("5. Deploy:");
console.log("   Push to main, or click Deploy/Redeploy in Vercel.");
