import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const URL = 'http://localhost:5174'
const OUT = './captures'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()

// 1. Login page
await page.goto(URL + '/login', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[type=email]')
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/01-login.png` })
console.log('Captured: 01-login.png')

// 2. Sign in
await page.fill('input[type=email]', 'developer@snre.io')
await page.fill('input[type=password]', 'demo-password')
await Promise.all([
  page.waitForURL('**/dashboard'),
  page.click('button[type=submit]'),
])

// Wait for KPI cards to render
await page.waitForSelector('text=/Notifications envoyées|Notifications sent/')
await page.waitForTimeout(800)

await page.screenshot({ path: `${OUT}/02-dashboard.png`, fullPage: false })
console.log('Captured: 02-dashboard.png (viewport 1440x900)')

await page.screenshot({ path: `${OUT}/03-dashboard-full.png`, fullPage: true })
console.log('Captured: 03-dashboard-full.png (full page)')

await browser.close()
console.log('Done.')
