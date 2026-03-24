# Vercel 環境變數完整清單

本文件列出所有需要在 Vercel 設定的環境變數。

## 🔐 必須設定的環境變數

### 1. NextAuth 認證密鑰

**變數名稱：** `NEXTAUTH_SECRET`（優先）或 `AUTH_SECRET`

**用途：** 用於簽名和加密 JWT token，保護用戶會話安全

**如何生成：**
```bash
# 使用 OpenSSL
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 或使用線上工具
# https://generate-secret.vercel.app/32
```

**設定位置：** Vercel Dashboard > Settings > Environment Variables

**重要提示：**
- ✅ **必須設定**，否則生產環境的認證可能無法正常工作
- ✅ 使用長度至少 32 字元的隨機字串
- ✅ 不同環境（Production/Preview/Development）可以使用相同的值
- ✅ 不要將此值提交到 Git

---

### 2. NextAuth URL

**變數名稱：** `NEXTAUTH_URL`

**用途：** 應用程式的完整 URL，用於生成認證回調 URL

**值範例：**
- 生產環境：`https://testtttt.io`
- 預覽環境：`https://your-preview-url.vercel.app`
- 本地開發：`http://localhost:3000`

**設定位置：** Vercel Dashboard > Settings > Environment Variables

**重要提示：**
- ✅ **必須設定**，否則認證回調可能失敗
- ✅ 生產環境必須使用完整的 HTTPS URL
- ✅ 不要包含結尾斜線

---

## 🔥 Firebase 相關（如果使用 Firebase）

### 3. Firebase Project ID

**變數名稱：** `FIREBASE_PROJECT_ID`

**值範例：** `your-firebase-project-id`

### 4. Firebase Client Email

**變數名稱：** `FIREBASE_CLIENT_EMAIL`

**值範例：** `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`

### 5. Firebase Private Key

**變數名稱：** `FIREBASE_PRIVATE_KEY`

**值範例：** 
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
（完整的多行私鑰）
-----END PRIVATE KEY-----
```

**詳細說明：** 參考 `VERCEL_FIREBASE_SETUP.md`

---

## 📧 郵件服務（如果使用 Resend）

### 6. Resend API Key

**變數名稱：** `RESEND_API_KEY`

**值範例：** `re_xxxxxxxxxxxxxxxxxxxxx`

**詳細說明：** 參考 `RESEND_SETUP.md`

### 7. 郵件發送者地址（可選）

**變數名稱：** `MAIL_FROM`

**值範例：** 
- 使用 Resend 預設：`onboarding@resend.dev`
- 使用自訂域名：`noreply@testtttt.io`

### 8. 意見回饋收件地址（建議）

**變數名稱：** `FEEDBACK_TO_EMAIL`

**用途：** 網站「意見回饋」表單的收件信箱

**值範例：** `support@testtttt.io`

---

## 🔑 GitHub OAuth（如果使用 GitHub 登入）

### 9. GitHub Client ID

**變數名稱：** `GITHUB_ID`

**值範例：** `Iv1.xxxxxxxxxxxxx`

### 10. GitHub Client Secret

**變數名稱：** `GITHUB_SECRET`

**值範例：** `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## 📋 完整環境變數清單（快速參考）

在 Vercel Dashboard > Settings > Environment Variables 中設定：

| 變數名稱 | 必須 | 說明 |
|---------|------|------|
| `NEXTAUTH_SECRET` | ✅ 是 | NextAuth 認證密鑰 |
| `NEXTAUTH_URL` | ✅ 是 | 應用程式完整 URL |
| `FIREBASE_PROJECT_ID` | ⚠️ 如果使用 Firebase | Firebase 專案 ID |
| `FIREBASE_CLIENT_EMAIL` | ⚠️ 如果使用 Firebase | Firebase 服務帳號郵件 |
| `FIREBASE_PRIVATE_KEY` | ⚠️ 如果使用 Firebase | Firebase 私鑰 |
| `RESEND_API_KEY` | ⚠️ 如果使用 Resend | Resend API 金鑰 |
| `MAIL_FROM` | ❌ 可選 | 郵件發送者地址 |
| `FEEDBACK_TO_EMAIL` | ❌ 建議 | 意見回饋收件信箱 |
| `GITHUB_ID` | ❌ 可選 | GitHub OAuth Client ID |
| `GITHUB_SECRET` | ❌ 可選 | GitHub OAuth Client Secret |

---

## 🚀 設定步驟

### 方法 1：透過 Vercel Dashboard（推薦）

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 點擊 **Settings** > **Environment Variables**
4. 點擊 **Add New**
5. 輸入變數名稱和值
6. 選擇環境（Production/Preview/Development）
7. 點擊 **Save**
8. **重新部署**專案（環境變數變更後需要重新部署）

### 方法 2：透過 Vercel CLI

```bash
# 設定單個環境變數
vercel env add NEXTAUTH_SECRET

# 或使用 .env 檔案
vercel env pull .env.local
```

---

## ✅ 驗證設定

部署後，檢查以下項目：

1. **認證功能：**
   - 嘗試註冊新帳號
   - 嘗試登入
   - 確認會話正常運作

2. **Firebase（如果使用）：**
   - 檢查 Firestore Console，確認資料寫入正常

3. **郵件服務（如果使用）：**
   - 註冊新帳號，確認收到驗證郵件

4. **查看部署日誌：**
   - 在 Vercel Dashboard > Deployments > 選擇部署 > Logs
   - 檢查是否有環境變數相關錯誤

---

## 🔒 安全建議

1. ✅ **不要**將環境變數提交到 Git
2. ✅ **使用**強隨機字串作為密鑰
3. ✅ **定期**輪換敏感環境變數
4. ✅ **限制**環境變數的存取權限
5. ✅ **監控**環境變數的使用情況

---

## 📝 本地開發設定

在專案根目錄建立 `.env.local` 檔案：

```env
# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Firebase（如果使用）
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Resend（如果使用）
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
MAIL_FROM=onboarding@resend.dev
FEEDBACK_TO_EMAIL=support@testtttt.io

# GitHub OAuth（如果使用）
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
```

**注意：** `.env.local` 應該在 `.gitignore` 中，不會被提交到版本控制。

