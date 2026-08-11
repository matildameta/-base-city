# 🏙️ Base City

هر آدرس روی Base یک ساختمان است. هرچه فعالیت on-chain بیشتر → ساختمان بزرگ‌تر و پیچیده‌تر.
یک Farcaster Mini App / Base App، آماده برای دیپلوی روی Vercel.

- **House** 🏠 → آدرس عادی با ETH/تراکنش کم
- **Shop** 🏪 → آدرس با تراکنش زیاد (trader)
- **Office** 🏢 → کانترکت بزرگ/پیچیده (شبیه DAO)
- **Tower** 🗼 → Whale (موجودی بالا)
- **Factory** 🏭 → کانترکت فعال (dapp)
- **Ruin** 🏚️ → کیف پول مرده (بدون موجودی/تراکنش)

داده‌ها مستقیم از RPC عمومی Base خوانده می‌شوند (رایگان، بدون نیاز به کلید).
شهر هر چند ثانیه رفرش می‌شود (نزدیک به real-time).

---

## 1) اجرای محلی

```bash
npm install
npm run dev
```

باز کن: http://localhost:3000

بدون هیچ env var هم کار می‌کند (RPC عمومی Base + حافظه‌ی موقت برای شهر).

---

## 2) دیپلوی روی Vercel

1. این پوشه رو push کن به یک ریپوی GitHub.
2. برو به vercel.com → New Project → ریپو رو انتخاب کن → Deploy.
3. بعد از اولین دیپلوی، در Vercel → Settings → Environment Variables این‌ها رو (حداقل مقدار اول) ست کن:
   - `NEXT_PUBLIC_APP_URL` = آدرس دیپلوی‌شده، مثلاً `https://base-city.vercel.app`
4. دوباره Redeploy کن تا env جدید اعمال بشه.

اختیاری ولی توصیه‌شده برای این‌که شهر بین همه‌ی کاربرها مشترک/پایدار بمونه (وگرنه روی Vercel serverless هر cold start ممکنه ریست بشه):
   - یک دیتابیس رایگان Upstash Redis بساز: https://upstash.com
   - `UPSTASH_REDIS_REST_URL` و `UPSTASH_REDIS_REST_TOKEN` رو از پنل Upstash کپی کن و در Vercel ست کن.

---

## 3) فعال کردن به‌عنوان Farcaster Mini App / Base App

1. آیکون/تصاویر بساز و در `public/` بذار: `icon.png` (1024x1024)، `og.png` (1200x630)، `splash.png` (200x200).
2. `public/.well-known/farcaster.json` رو باز کن و `homeUrl`, `iconUrl`, `imageUrl`, `splashImageUrl`, `webhookUrl` رو با دامنه‌ی واقعی Vercel خودت جایگزین کن.
3. برای `accountAssociation` (امضای مالکیت دامنه توسط اکانت فارکستر خودت):
   - در Warpcast برو به Settings → Developer → Mini Apps → "Create manifest" (یا از ابزار رسمی: https://miniapps.farcaster.xyz/docs/guides/publishing )
   - دامنه‌ی Vercel‌ت رو وارد کن، امضا کن، و مقادیر `header` / `payload` / `signature` رو در `farcaster.json` جایگزین کن.
4. Push و Redeploy کن.
5. لینک اپ رو داخل یک کست (cast) در فارکستر پیست کن — باید preview مینی‌اپ با دکمه‌ی "🏙️ Open Base City" نمایش داده بشه.

---

## 4) قرارداد ثبت مالکیت زمین (تراکنش واقعی روی Base)

فایل `contracts/BaseCityRegistry.sol` یک قرارداد خیلی ساده است: هر آدرس با فراخوانی `claimPlot()` مالکیت زمینِ خودش رو با یک تراکنش واقعی روی Base ثبت می‌کنه.

**ساده‌ترین راه دیپلوی (بدون نیاز به نصب چیزی، با Remix):**

1. برو به https://remix.ethereum.org
2. فایل `BaseCityRegistry.sol` رو کپی/پیست کن.
3. تب Solidity Compiler → Compile.
4. تب Deploy & Run → Environment رو بذار روی "Injected Provider" و کیف پولت رو به شبکه‌ی **Base Mainnet** (chainId 8453) وصل کن (یا برای تست، **Base Sepolia**).
5. Deploy بزن و تراکنش رو تأیید کن.
6. آدرس قرارداد دیپلوی‌شده رو کپی کن.
7. در Vercel، env var زیر رو ست کن و Redeploy کن:
   - `NEXT_PUBLIC_REGISTRY_ADDRESS = 0x...`

بعد از این، دکمه‌ی "🧾 ثبت مالکیت زمین" در اپ یک تراکنش واقعی روی Base می‌فرسته.

> برای production واقعی بهتره قرارداد رو با Foundry/Hardhat تست‌نویسی و روی Basescan verify کنی، ولی برای دمو/فارکستر همین کافیه.

---

## درباره‌ی API که فرستادی (EtherDrops)

اون کلید مال یک ربات تلگرامی EtherDrops هست (برای نوتیفیکیشن تراکنش)، نه یک API عمومی مستند برای این کاربرد؛ و چون یک شناسه‌ی خصوصی/کلید حساب توئه بهتره جایی پابلیک (مثل کد این ریپو) قرارش ندی. این پروژه بدون نیاز بهش کار می‌کنه چون مستقیم از RPC عمومی Base می‌خونه. اگه بعداً خواستی داده‌های غنی‌تر (مثل تشخیص دقیق‌تر DAO/Trader از روی تاریخچه‌ی توکن‌ها) اضافه کنی، گزینه‌های رایگان بهتر: Basescan API (رایگان، با API key) یا Alchemy free tier.

---

## ساختار پروژه

```
app/
  page.tsx           رابط کاربری اصلی + اتصال کیف پول
  layout.tsx          متادیتای Mini App / Open Graph
  api/analyze/route.ts   خواندن on-chain data یک آدرس و افزودن به شهر
  api/city/route.ts      برگرداندن کل ساختمان‌های شهر
components/CityCanvas.tsx  رندر procedural شهر روی canvas
lib/classify.ts         منطق تبدیل داده‌ی on-chain به نوع ساختمان
lib/store.ts             ذخیره‌سازی مشترک (Upstash یا حافظه‌ی موقت)
contracts/BaseCityRegistry.sol   قرارداد ثبت مالکیت زمین
public/.well-known/farcaster.json   مانیفست Mini App
```
