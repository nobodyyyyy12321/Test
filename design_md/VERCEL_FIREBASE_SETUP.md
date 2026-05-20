# Vercel 部署：Firebase 環境變數設定指南

## 重要說明

⚠️ **Firebase 服務帳號 JSON 檔案不應該直接部署到 Vercel！**

您需要將 JSON 檔案中的三個變數提取出來，分別設定為 Vercel 的環境變數。

## 步驟 1：取得 Firebase 服務帳號 JSON

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇您的專案
3. 前往 **專案設定** > **服務帳戶**
4. 點擊 **產生新的私密金鑰**
5. 下載 JSON 檔案（例如：`firebase-service-account.json`）

## 步驟 2：從 JSON 檔案提取變數

下載的 JSON 檔案格式如下：

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

您需要提取以下三個值：

| JSON 欄位 | Vercel 環境變數名稱 | 說明 |
|-----------|-------------------|------|
| `project_id` | `FIREBASE_PROJECT_ID` | Firebase 專案 ID |
| `client_email` | `FIREBASE_CLIENT_EMAIL` | 服務帳號電子郵件 |
| `private_key` | `FIREBASE_PRIVATE_KEY` | 私鑰（完整包含 BEGIN/END 標記） |

## 步驟 3：在 Vercel 設定環境變數

### 方法 A：透過 Vercel Dashboard（推薦）

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 點擊 **Settings** > **Environment Variables**
4. 新增以下三個環境變數：

#### 變數 1：FIREBASE_PROJECT_ID
- **Key**: `FIREBASE_PROJECT_ID`
- **Value**: 從 JSON 的 `project_id` 欄位複製
- **Environment**: 選擇 `Production`, `Preview`, `Development`（或全部）

#### 變數 2：FIREBASE_CLIENT_EMAIL
- **Key**: `FIREBASE_CLIENT_EMAIL`
- **Value**: 從 JSON 的 `client_email` 欄位複製
- **Environment**: 選擇 `Production`, `Preview`, `Development`（或全部）

#### 變數 3：FIREBASE_PRIVATE_KEY（最重要！）
- **Key**: `FIREBASE_PRIVATE_KEY`
- **Value**: 從 JSON 的 `private_key` 欄位複製，**必須包含完整的私鑰**：
  ```
  -----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
  ...（多行內容）...
  -----END PRIVATE KEY-----
  ```
- **Environment**: 選擇 `Production`, `Preview`, `Development`（或全部）

**重要提示：**
- Vercel 會自動處理換行符，所以您可以：
  - **選項 1**：直接貼上完整的私鑰（包含換行），Vercel 會自動處理
  - **選項 2**：將換行符替換為 `\n`（例如：`-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n`）

### 方法 B：透過 Vercel CLI

```bash
# 設定環境變數
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY

# 或一次性設定（需要互動式輸入）
vercel env pull .env.local
```

### 方法 C：使用 vercel.json（不推薦）

雖然可以在 `vercel.json` 中設定環境變數，但**不建議**這樣做，因為：
- 會將敏感資訊提交到版本控制
- 違反安全最佳實踐

## 步驟 4：重新部署

設定環境變數後，需要重新部署專案：

1. **自動部署**：推送到 GitHub，Vercel 會自動部署
2. **手動部署**：
   ```bash
   vercel --prod
   ```

## 驗證設定

部署完成後，檢查應用程式是否正常運作：

1. 嘗試註冊新用戶
2. 檢查 Firebase Console > Firestore Database，確認資料已寫入
3. 查看 Vercel 部署日誌，確認沒有 Firebase 相關錯誤

## 常見問題

### Q: JSON 檔案可以直接上傳到 Vercel 嗎？

**A: 不可以！** 您需要將 JSON 中的三個變數分別設定為環境變數。

### Q: 為什麼不能直接使用 JSON 檔案？

**A:**
1. 安全考量：JSON 檔案包含敏感資訊，不應該提交到版本控制
2. Vercel 環境變數設計：Vercel 使用環境變數系統，不是檔案系統
3. 最佳實踐：環境變數可以針對不同環境（Production/Preview/Development）設定不同值

### Q: private_key 在 Vercel 中如何正確設定？

**A:** 有兩種方式：

**方式 1：直接貼上（推薦）**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
（完整的多行私鑰）
-----END PRIVATE KEY-----
```
Vercel 會自動處理換行符。

**方式 2：使用 \n**
```
-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n
```

### Q: 環境變數設定後立即生效嗎？

**A:** 需要重新部署才會生效。設定環境變數後，Vercel 會提示您重新部署。

### Q: 如何確認環境變數已正確設定？

**A:**
1. 在 Vercel Dashboard > Settings > Environment Variables 中檢查
2. 在部署日誌中查看（不會顯示實際值，但會顯示變數名稱）
3. 測試應用程式功能（註冊用戶、寫入 Firestore）

## 安全建議

1. ✅ **不要**將 Firebase JSON 檔案提交到 Git
2. ✅ **不要**在程式碼中硬編碼私鑰
3. ✅ **使用** Vercel 的環境變數系統
4. ✅ **定期**輪換服務帳號金鑰
5. ✅ **限制**服務帳號權限（只給予必要的 Firestore 權限）

## 本地開發設定

在本地開發時，建立 `.env.local` 檔案：

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**注意：** `.env.local` 應該在 `.gitignore` 中，不會被提交到版本控制。

