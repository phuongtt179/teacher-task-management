// Đo lượt đọc từng thao tác trên app chạy với Firebase Emulator — xem scripts/emulator/README.md.
// node scripts/emulator/measure.mjs . [teacher|head|vp ...]
// Cần: npm i --no-save puppeteer-core ; Chrome cài sẵn (đường dẫn CHROME_PATH nếu khác mặc định).
import path from 'path'; import fs from 'fs'; import { createRequire } from 'module';
import puppeteer from 'puppeteer-core';
const APP = process.argv[2];
const only = process.argv.slice(3);
const require = createRequire(path.join(APP, 'package.json'));
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-ttm' });
const seedUsers = JSON.parse(fs.readFileSync(path.join(APP, 'scripts/emulator/seed-users.json'), 'utf8')).users;
const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = path.resolve(APP, 'scripts/emulator/.shots'); fs.mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run', '--window-size=1400,900'] });
const results = [];

async function session(user) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
  const settle = async () => { try { await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }); } catch {} await sleep(500); };
  const client = () => page.evaluate(() => ({ ...(window.__readTotals || { reads: 0, queries: 0 }) }));
  const server = async () => (await (await fetch(`${API}/dev/reads`)).json()).serverReads;
  let label = '';
  async function step(name, fn) {
    const c0 = await client().catch(() => ({ reads: 0, queries: 0 })); const s0 = await server();
    const l0 = await page.evaluate(() => (window.__readLog || []).length).catch(() => 0);
    await fn(); await settle();
    const c1 = await client().catch(() => ({ reads: 0, queries: 0 })); const s1 = await server();
    // trang tải lại → bộ đếm trình duyệt về 0, khi đó lấy c1 nguyên
    const cr = c1.reads >= c0.reads ? c1.reads - c0.reads : c1.reads;
    const cq = c1.queries >= c0.queries ? c1.queries - c0.queries : c1.queries;
    const row = { persona: label, step: name, client: cr, clientQueries: cq, server: s1 - s0 };
    const log = await page.evaluate((from) => (window.__readLog || []).slice(from), c1.reads >= c0.reads ? l0 : 0).catch(() => []);
    const by = {}; log.forEach((e) => { by[e.collection] = by[e.collection] || [0, 0]; by[e.collection][0] += e.reads; by[e.collection][1]++; });
    row.detail = Object.entries(by).sort((a, b) => b[1][0] - a[1][0]).map(([k, v]) => `${k} ${v[0]}/${v[1]}`).join(', ');
    results.push(row);
    console.log(`  ${label.padEnd(10)} ${name.padEnd(44)} trình duyệt ${String(cr).padStart(5)} (${cq} truy vấn) | server ${s1 - s0}`);
    if (row.detail) console.log('       ↳ ' + row.detail);
    await page.screenshot({ path: path.join(SHOTS, `${label}-${results.length}.png`) });
  }
  const nav = (to) => page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, to);
  const clickText = async (text, sel = 'button, a, span, div, p, li') => {
    const ok = await page.evaluate((t, s) => {
      const els = [...document.querySelectorAll(s)].filter((e) => e.offsetParent && e.textContent.trim() === t);
      const el = els[els.length - 1]; if (el) { el.click(); return true; } return false;
    }, text, sel);
    if (!ok) throw new Error('không thấy: ' + text);
  };
  async function login() {
    label = user.label;
    const token = await admin.auth().createCustomToken(user.uid);
    await page.goto(`${BASE}/login`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__devLogin === 'function');
    await page.evaluate((t) => window.__devLogin(t), token);
    await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 });
  }
  return { page, step, nav, clickText, login, ctx };
}

const byRole = (role, dept) => seedUsers.find((u) => u.role === role && (dept === undefined || u.dept === dept));
const teacher = { ...byRole('teacher', 'dept-1'), label: 'GV' };
const head = { ...byRole('department_head', 'dept-1'), label: 'TổTrưởng' };
const vp = { ...byRole('vice_principal'), label: 'BGH' };

async function runTeacher() {
  const s = await session(teacher);
  await s.step('đăng nhập lần đầu (máy chưa có bộ nhớ tạm)', s.login);
  await s.step('tải lại trang (đã có bộ nhớ tạm 3 giờ)', () => s.page.reload({ waitUntil: 'load' }));
  await s.step('mở Hồ sơ điện tử', () => s.nav('/documents'));
  await s.step('chọn Kế hoạch bài dạy', () => s.clickText('Kế hoạch bài dạy', 'button'));
  await s.step('chọn Tuần 7', () => s.clickText('Tuần 7', 'button'));
  await s.step('chọn Kế hoạch môn học', () => s.clickText('Kế hoạch môn học', 'button'));
  await s.step('quay lại Kế hoạch bài dạy', () => s.clickText('Kế hoạch bài dạy', 'button'));
  await s.step('chọn lại Tuần 7', () => s.clickText('Tuần 7', 'button'));
  await s.step('nộp 1 hồ sơ (1 file) vào Tuần 7', async () => {
    await s.clickText('Thêm hồ sơ', 'button');
    await sleep(400);
    const input = await s.page.$('input[type=file]');
    const f = path.join(SHOTS, 'khbd-test.docx'); fs.writeFileSync(f, 'test');
    await input.uploadFile(f);
    await s.page.type('input[placeholder^="VD: Kế hoạch"]', 'KHBD tuần 7 - thử');
    await s.clickText('Tải lên', 'button');
    await sleep(3000);
  });
  await s.step('mở Công việc của tôi', () => s.nav('/teacher/my-tasks'));
  await s.step('mở Điểm của tôi', () => s.nav('/teacher/my-scores'));
  await s.step('về Dashboard', () => s.nav('/'));
  await s.ctx.close();
}
async function runHead() {
  const s = await session(head);
  await s.step('đăng nhập lần đầu', s.login);
  await s.step('mở Theo dõi nộp hồ sơ', () => s.nav('/vp/submission-matrix'));
  await s.step('mở Hồ sơ điện tử', () => s.nav('/documents'));
  await s.step('chọn Kế hoạch bài dạy', () => s.clickText('Kế hoạch bài dạy', 'button'));
  await s.step('chọn Tuần 7', () => s.clickText('Tuần 7', 'button'));
  await s.ctx.close();
}
async function runVp() {
  const s = await session(vp);
  await s.step('đăng nhập lần đầu (Dashboard BGH)', s.login);
  await s.step('mở Thống kê', () => s.nav('/vp/statistics'));
  await s.step('mở Danh bạ giáo viên', () => s.nav('/vp/teacher-directory'));
  await s.step('mở Theo dõi nộp hồ sơ', () => s.nav('/vp/submission-matrix'));
  await s.step('mở lại Danh bạ giáo viên', () => s.nav('/vp/teacher-directory'));
  await s.step('mở Xếp hạng', () => s.nav('/rankings'));
  await s.step('mở Danh sách công việc', () => s.nav('/vp/tasks'));
  await s.ctx.close();
}

const all = { teacher: runTeacher, head: runHead, vp: runVp };
for (const [k, fn] of Object.entries(all)) {
  if (only.length && !only.includes(k)) continue;
  try { await fn(); } catch (e) { console.log(`  !! ${k}: ${e.message}`); }
}
fs.writeFileSync(path.join(SHOTS, 'measure-results.json'), JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
