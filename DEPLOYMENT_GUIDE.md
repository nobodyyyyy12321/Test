# 部署指南：Firebase 帳號資料遷移

本指南說明如何在部署後將帳號資料存入 Firebase Firestore。

## 部署前準備

### 1. 設定 Firebase 專案

參考 `FIREBASE_SETUP.md` 完成 Firebase 專案設定。

### 2. 準備環境變數

⚠️ **重要：必須設定以下環境變數！**

#### 必須設定的環境變數

**1. NextAuth 認證密鑰（必須）**

```bash
# 變數名稱：NEXTAUTH_SECRET（優先）或 AUTH_SECRET
# 用途：用於簽名和加密 JWT token，保護用戶會話安全

# 生成方式（選擇一種）：
# 方式 1：使用 OpenSSL
openssl rand -base64 32

# 方式 2：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 方式 3：使用線上工具
# https://generate-secret.vercel.app/32
```

**2. NextAuth URL（必須）**

```
NEXTAUTH_URL=https://testtttt.io
```

**3. Firebase 相關（如果使用 Firebase）**

⚠️ **重要：Firebase 服務帳號 JSON 檔案不應該直接部署！**

您需要從 Firebase 服務帳號 JSON 檔案中提取三個變數，並在 Vercel 中設定為環境變數。

**詳細步驟請參考：`VERCEL_FIREBASE_SETUP.md`**

快速步驟：
1. 從 Firebase Console 下載服務帳號 JSON 檔案
2. 提取以下三個值：
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
3. 在 Vercel Dashboard > Settings > Environment Variables 中設定

**完整環境變數清單請參考：`VERCEL_ENV_VARIABLES.md`**

## 部署方式

### 方式一：Vercel 部署

#### 步驟 1：設定環境變數

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 前往 **Settings** > **Environment Variables**
4. 新增以下環境變數：
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`（注意：需要完整包含 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`）

**重要提示：**
- `FIREBASE_PRIVATE_KEY` 在 Vercel 中設定時，如果有多行，請確保使用 `\n` 來表示換行
- 或者直接貼上完整的私鑰（包含換行），Vercel 會自動處理

#### 步驟 2：部署專案

```bash
# 如果使用 Vercel CLI
vercel --prod

# 或推送到 GitHub，Vercel 會自動部署
git push origin main
```

#### 步驟 3：遷移現有資料

部署完成後，有兩種方式遷移資料：

**選項 A：使用遷移腳本（推薦）**

1. 在本地執行遷移腳本（需要設定 `.env.local`）：

```bash
# 安裝 tsx（如果還沒安裝）
npm install -D tsx

# 執行遷移腳本
npx tsx scripts/migrate-users-to-firebase.ts
```

**選項 B：建立一次性 API 路由**

建立一個管理員 API 路由來執行遷移（僅在首次部署時使用）：

```typescript
// app/api/admin/migrate-users/route.ts
// 注意：此路由應該有身份驗證保護
```

### 方式二：其他平台部署

#### 設定環境變數

根據您的部署平台，在環境變數設定中新增 Firebase 相關變數：

- **Netlify**: Site settings > Environment variables
- **Railway**: Project > Variables
- **Render**: Environment > Environment Variables
- **其他平台**: 參考該平台的環境變數設定文件

#### 遷移資料

使用相同的遷移腳本或手動匯入資料。

## 遷移現有資料

### 如果沒有現有用戶資料

**這是正常的情況！** 如果您的專案是全新的，沒有 `data/users.json` 檔案或檔案是空的：

- ✅ **不需要執行遷移** - 新註冊的用戶會直接儲存在 Firebase 中
- ✅ 遷移腳本會自動檢測並顯示友好提示
- ✅ 應用程式會正常運作

### 方法 1：使用遷移腳本（本地執行）

1. 確保本地 `.env.local` 已設定 Firebase 環境變數
2. 執行遷移腳本：

```bash
npm run migrate:users
# 或
npx tsx scripts/migrate-users-to-firebase.ts
```

腳本會：
- 自動檢測 `data/users.json` 是否存在
- 如果檔案不存在或為空，會顯示友好提示並正常退出
- 讀取 `data/users.json` 中的所有用戶
- 檢查 Firestore 中是否已存在（根據 email）
- 將不存在的用戶遷移到 Firestore
- 顯示遷移結果統計

**沒有用戶資料時的輸出範例：**
```
開始遷移用戶資料到 Firebase...

ℹ️  提示：找不到 data/users.json
   這表示沒有本地用戶資料需要遷移。
   如果這是新專案，用戶資料將直接儲存在 Firebase 中。

✅ 遷移完成（無資料需要遷移）
```

### 方法 2：手動匯入（Firebase Console）

1. 前往 Firebase Console > Firestore Database
2. 建立 `users` 集合
3. 手動新增每個用戶文檔，使用用戶 ID 作為文檔 ID
4. 複製 `users.json` 中的資料欄位

### 方法 3：使用 Firebase CLI

```bash
# 安裝 Firebase CLI
npm install -g firebase-tools

# 登入 Firebase
firebase login

# 匯入資料（需要先準備好匯入格式）
firebase firestore:import ./backup.json
```

## 驗證遷移

### 檢查 Firestore 資料

1. 前往 Firebase Console > Firestore Database
2. 確認 `users` 集合已建立（如果沒有用戶，集合可能還不存在，這是正常的）
3. 如果有遷移資料，檢查用戶文檔是否正確匯入

### 測試應用程式

1. **新專案（無現有用戶）：**
   - 直接註冊新用戶
   - 確認用戶資料成功儲存到 Firestore
   - 嘗試登入新註冊的帳號

2. **有現有用戶：**
   - 嘗試登入已遷移的用戶帳號
   - 嘗試註冊新用戶
   - 檢查用戶資料是否正確顯示

## 部署後注意事項

### 1. 移除本地資料（可選）

遷移完成並確認無誤後，可以選擇：

- 保留 `data/users.json` 作為備份
- 或刪除本地檔案（已遷移到 Firestore）

### 2. 更新代碼

確保所有代碼都使用 Firebase 服務，不再讀取本地 JSON 檔案。

### 3. 監控和備份

- 定期備份 Firestore 資料
- 監控 Firebase 使用量和費用
- 設定 Firestore 安全規則

## 疑難排解

### 錯誤：Firebase Admin 配置缺失

確保所有環境變數都已正確設定在部署平台中。

### 錯誤：權限不足

檢查服務帳號是否有 Firestore 的讀寫權限。

### 遷移後無法登入

1. 檢查 `passwordHash` 是否正確遷移
2. 確認 `email` 欄位已轉換為小寫
3. 檢查 `emailVerified` 狀態

### 環境變數格式問題

在 Vercel 中設定 `FIREBASE_PRIVATE_KEY` 時：
- 確保包含完整的私鑰（包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`）
- 如果私鑰中有換行，使用 `\n` 或直接貼上多行（Vercel 會自動處理）

## 安全建議

1. **保護遷移腳本**：不要將包含敏感資訊的腳本提交到版本控制
2. **限制 API 存取**：如果有遷移 API 路由，確保有適當的身份驗證
3. **定期備份**：定期備份 Firestore 資料
4. **監控存取**：監控 Firebase 的使用情況和異常活動

