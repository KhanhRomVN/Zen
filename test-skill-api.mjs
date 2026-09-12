/**
 * Test script for mcp.directory skill APIs
 * Chạy: node test-skill-api.mjs
 * Mục đích: Xác định API có hoạt động không khi không có CORS (Node.js)
 */

const BASE_URL = "https://mcp.directory";

function parseLeaderboardRSC(text) {
  try {
    const match = text.match(/"initialSkills"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/);
    if (!match) return [];
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("  [parse error]", err.message);
    return [];
  }
}

function parseSkillDetailRSC(text) {
  try {
    const blockMatch = text.match(/T\d+,---\n/);
    if (!blockMatch) {
      console.log("  [parse] Không tìm thấy block T<number>---, thử fallback JSON...");
      return parseSkillDetailFallback(text);
    }
    const blockStart = blockMatch.index;
    const blockHeader = blockMatch[0];
    const frontmatterStart = blockStart + blockHeader.length;

    const frontmatterClose = text.indexOf("\n---\n", frontmatterStart);
    if (frontmatterClose === -1) {
      console.log("  [parse] Không tìm thấy frontmatter close, thử fallback JSON...");
      return parseSkillDetailFallback(text);
    }

    const frontmatter = text.substring(frontmatterStart, frontmatterClose);
    const nameMatch = frontmatter.match(/name:\s*(.+?)(?:\n|$)/);
    const descMatch = frontmatter.match(/description:\s*(.+?)(?:\n|$)/);
    if (!nameMatch) {
      console.log("  [parse] Không tìm thấy name trong frontmatter, thử fallback JSON...");
      return parseSkillDetailFallback(text);
    }
    const name = nameMatch[1].trim();
    const description = descMatch?.[1]?.trim() || "";

    const contentStart = frontmatterClose + 5;

    const remaining = text.substring(contentStart);
    const nextBlockMatch = remaining.match(/\n[0-9a-f]+:(?:[A-Z]|[{$\"\\[])/);
    const contentEnd = nextBlockMatch
      ? contentStart + nextBlockMatch.index + 1
      : text.length;

    const content = text.substring(contentStart, contentEnd).trim();

    console.log("  [parse] content length:", content.length);
    return { name, description, content };
  } catch (err) {
    console.error("  [parse error]", err.message);
    return null;
  }
}

function parseSkillDetailFallback(text) {
  console.log("  [fallback] Tìm JSON skill info trong RSC payload...");
  try {
    // Thử 2 pattern: non-escaped và escaped
    const patterns = [
      /"name":"([^"]+)","author":"[^"]+","description":"((?:[^"\\]|\\.)*)"/,
      /\\"name\\":\\"([^\\]+)\\",\\"author\\":\\"[^\\]+\\",\\"description\\":\\"((?:[^\\"]|\\.)*?)\\/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        const description = match[2]
          .replace(/\\\"/g, '"')
          .replace(/\\\\/g, "\\")
          .replace(/\\n/g, "\n");
        console.log("  [fallback] Parsed:", { name, descriptionLength: description.length });
        return { name, description, content: description };
      }
    }

    console.log("  [fallback] Không tìm thấy skill info");
    return null;
  } catch (err) {
    console.error("  [fallback] Parse error:", err.message);
    return null;
  }
}

async function testLeaderboard() {
  console.log("=== Test 1: Leaderboard ===");
  console.log("URL:", `${BASE_URL}/skills`);
  try {
    const res = await fetch(`${BASE_URL}/skills`, {
      method: "GET",
      headers: { rsc: "1" },
      cache: "no-store",
    });
    console.log("  Status:", res.status);
    console.log("  Content-Type:", res.headers.get("content-type"));
    const text = await res.text();
    console.log("  Response length:", text.length);
    console.log("  First 500 chars:", JSON.stringify(text.substring(0, 500)));
    const skills = parseLeaderboardRSC(text);
    console.log("  Parsed skills:", skills.length);
    if (skills.length > 0) {
      console.log("  First skill:", JSON.stringify(skills[0], null, 2));
    } else {
      console.log("  !! No initialSkills found");
      // In ra các keyword để debug
      const keywords = ["initialSkills", "featured", "trending", "recent"];
      for (const kw of keywords) {
        const idx = text.indexOf(kw);
        console.log(`  indexOf("${kw}"):`, idx);
        if (idx > 0) {
          console.log(`  context:`, JSON.stringify(text.substring(idx - 20, idx + 200)));
        }
      }
    }
  } catch (err) {
    console.error("  ERROR:", err.name, "-", err.message);
    console.error("  cause:", err.cause);
    console.error("  stack:", err.stack);
  }
  console.log("");
}

async function testSearch() {
  console.log("=== Test 2: Search ===");
  const url = `${BASE_URL}/api/v1/skills?q=ui&limit=5&offset=0`;
  console.log("URL:", url);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    console.log("  Status:", res.status);
    console.log("  Content-Type:", res.headers.get("content-type"));
    const data = await res.json();
    console.log("  Total:", data.total);
    console.log("  Skills count:", data.skills?.length);
    console.log("  First skill:", JSON.stringify(data.skills?.[0], null, 2));
  } catch (err) {
    console.error("  ERROR:", err.name, "-", err.message);
    console.error("  cause:", err.cause);
    console.error("  stack:", err.stack);
  }
  console.log("");
}

async function testDetail() {
  console.log("=== Test 3: Detail ===");
  const url = `${BASE_URL}/skills/svg-precision`;
  console.log("URL:", url);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { rsc: "1" },
      cache: "no-store",
    });
    console.log("  Status:", res.status);
    console.log("  Content-Type:", res.headers.get("content-type"));
    const text = await res.text();
    console.log("  Response length:", text.length);

    console.log("\n  -- Debug: Tim tat ca block T<number> ---");
    const tMatches = text.match(/T\d+,"?---"?/g);
    console.log("  So block T<number>---:", tMatches?.length || 0);
    if (tMatches) {
      console.log("  Cac block:", JSON.stringify(tMatches.slice(0, 20)));
    }

    console.log("\n  -- Debug: Tim vi tri 'name:' ---");
    const nameIndices = [];
    let nameIdx = text.indexOf("name:");
    while (nameIdx !== -1 && nameIndices.length < 10) {
      nameIndices.push(nameIdx);
      nameIdx = text.indexOf("name:", nameIdx + 1);
    }
    console.log("  Vi tri 'name:':", JSON.stringify(nameIndices));

    console.log("\n  -- Debug: Tim 'svg-precision' ---");
    const slugIndices = [];
    let slugIdx = text.indexOf("svg-precision");
    while (slugIdx !== -1 && slugIndices.length < 10) {
      slugIndices.push(slugIdx);
      slugIdx = text.indexOf("svg-precision", slugIdx + 1);
    }
    console.log("  Vi tri 'svg-precision':", JSON.stringify(slugIndices));

    for (const idx of slugIndices.slice(0, 3)) {
      console.log(`\n  -- Context quanh vi tri ${idx} (+-300 chars) ---`);
      console.log(JSON.stringify(text.substring(Math.max(0, idx - 300), idx + 300)));
    }

    const detail = parseSkillDetailRSC(text);
    if (detail) {
      console.log("\n  -- Ket qua parse hien tai ---");
      console.log("  Parsed name:", detail.name);
      console.log("  Parsed description:", detail.description);
      console.log("  Content length:", detail.content.length);
      console.log("  Content:", JSON.stringify(detail.content.substring(0, 500)));
    }

    console.log("\n  -- Debug: Tim dau '---' ---");
    const dashIndices = [];
    let dashIdx = text.indexOf("---");
    while (dashIdx !== -1 && dashIndices.length < 15) {
      dashIndices.push(dashIdx);
      dashIdx = text.indexOf("---", dashIdx + 1);
    }
    console.log("  Vi tri '---':", JSON.stringify(dashIndices));

    for (const idx of dashIndices.slice(0, 10)) {
      console.log(`\n  -- Context quanh '---' tai ${idx} (+-100 chars) ---`);
      console.log(JSON.stringify(text.substring(Math.max(0, idx - 100), idx + 100)));
    }

    // ── Debug: xem nội dung sau frontmatter close (vị trí 27658)
    console.log("\n  -- Debug: Noi dung sau frontmatter close (vi tri 27658) ---");
    console.log("  Tu 27658 den 27658+2000:");
    console.log(JSON.stringify(text.substring(27658, 27658 + 2000)));

    // ── Debug: tìm block RSC tiếp theo sau markdown content
    console.log("\n  -- Debug: Tim block RSC tiep theo ---");
    const afterContent = text.substring(27658);
    const nextBlockMatch = afterContent.match(/\n[0-9a-f]+:[A-Z{$\"T]/);
    if (nextBlockMatch) {
      console.log("  Block tiep theo:", JSON.stringify(nextBlockMatch[0]));
      console.log("  Vi tri:", 27658 + nextBlockMatch.index);
      console.log("  Context:", JSON.stringify(text.substring(27658 + nextBlockMatch.index - 50, 27658 + nextBlockMatch.index + 200)));
    } else {
      console.log("  Khong tim thay block tiep theo");
    }
  } catch (err) {
    console.error("  ERROR:", err.name, "-", err.message);
    console.error("  cause:", err.cause);
    console.error("  stack:", err.stack);
  }
  console.log("");
}

async function testDetailUI() {
  console.log("=== Test 4: Detail (ui) ===");
  const url = `${BASE_URL}/skills/ui`;
  console.log("URL:", url);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { rsc: "1" },
      cache: "no-store",
    });
    console.log("  Status:", res.status);
    console.log("  Content-Type:", res.headers.get("content-type"));
    const text = await res.text();
    console.log("  Response length:", text.length);

    const tMatches = text.match(/T\d+,---/g);
    console.log("  So block T<number>---:", tMatches?.length || 0);
    if (tMatches) {
      console.log("  Cac block:", JSON.stringify(tMatches.slice(0, 20)));
    }

    const nameIndices = [];
    let nameIdx = text.indexOf("name:");
    while (nameIdx !== -1 && nameIndices.length < 15) {
      nameIndices.push(nameIdx);
      nameIdx = text.indexOf("name:", nameIdx + 1);
    }
    console.log("  Vi tri 'name:':", JSON.stringify(nameIndices));

    const slugIndices = [];
    let slugIdx = text.indexOf('"ui"');
    while (slugIdx !== -1 && slugIndices.length < 15) {
      slugIndices.push(slugIdx);
      slugIdx = text.indexOf('"ui"', slugIdx + 1);
    }
    console.log("  Vi tri '\"ui\"':", JSON.stringify(slugIndices));

    // In context quanh các vị trí "ui"
    for (const idx of slugIndices.slice(0, 4)) {
      console.log(`\n  -- Context quanh "ui" tai ${idx} (+-400 chars) ---`);
      console.log(JSON.stringify(text.substring(Math.max(0, idx - 400), idx + 400)));
    }

    // Tìm content field trong RSC payload
    console.log("\n  -- Debug: Tim 'content' field ---");
    const contentIndices = [];
    let contentIdx = text.indexOf('"content"');
    while (contentIdx !== -1 && contentIndices.length < 10) {
      contentIndices.push(contentIdx);
      contentIdx = text.indexOf('"content"', contentIdx + 1);
    }
    console.log("  Vi tri '\"content\"':", JSON.stringify(contentIndices));

    for (const idx of contentIndices.slice(0, 3)) {
      console.log(`\n  -- Context quanh "content" tai ${idx} (+-300 chars) ---`);
      console.log(JSON.stringify(text.substring(Math.max(0, idx - 100), idx + 500)));
    }

    const detail = parseSkillDetailRSC(text);
    if (detail) {
      console.log("  Parsed name:", detail.name);
      console.log("  Parsed description:", detail.description);
      console.log("  Content length:", detail.content.length);
      console.log("  Content:", JSON.stringify(detail.content.substring(0, 300)));
    } else {
      console.log("  !! Parse FAILED");
      if (tMatches) {
        for (const tMatch of tMatches.slice(0, 5)) {
          const idx = text.indexOf(tMatch);
          console.log(`\n  -- Context quanh "${tMatch}" tai ${idx} (+-100 chars) ---`);
          console.log(JSON.stringify(text.substring(Math.max(0, idx - 100), idx + 500)));
        }
      }
    }
  } catch (err) {
    console.error("  ERROR:", err.name, "-", err.message);
    console.error("  cause:", err.cause);
    console.error("  stack:", err.stack);
  }
  console.log("");
}

async function main() {
  console.log("Node version:", process.version);
  console.log("Testing mcp.directory APIs...\n");
  await testLeaderboard();
  await testSearch();
  await testDetail();
  await testDetailUI();
  console.log("Done.");
}

main();