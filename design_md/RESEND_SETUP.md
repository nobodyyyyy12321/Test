# Resend 郵件服務設定指南

## 為什麼需要設定 Resend？

如果沒有設定 Resend（或 SMTP），註冊時會顯示驗證連結在頁面上，而不是發送郵件。設定 Resend 後，驗證郵件會自動發送到用戶的電子郵件地址。

## 設定步驟

### 1. 註冊 Resend 帳號

1. 前往 [Resend](https://resend.com/)
2. 註冊免費帳號（每月 3,000 封郵件免費額度）
3. 完成帳號驗證

### 2. 取得 API Key

1. 登入 Resend Dashboard
2. 前往 **API Keys** 頁面
3. 點擊 **Create API Key**
4. 輸入名稱（例如：`sapiens-camp-production`）
5. 選擇權限（選擇 **Sending access**）
6. 複製 API Key（只會顯示一次，請妥善保存）

### 3. 設定發送域名（可選，但建議）

**使用預設域名（快速開始）：**

**設定自訂域名（生產環境推薦）：**
1. 在 Resend Dashboard 前往 **Domains**
2. 點擊 **Add Domain**
3. 輸入您的域名（例如：`testtttt.io`）
4. 按照指示設定 DNS 記錄（SPF、DKIM、DMARC）
5. 等待驗證完成（通常幾分鐘內）

### 4. 設定環境變數

#### 本地開發（.env.local）

在專案根目錄建立或編輯 `.env.local` 檔案：

```env
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# 發送者郵件地址（可選）
# 如果使用自訂域名：MAIL_FROM=noreply@yourdomain.com
# 如果使用預設域名：MAIL_FROM=onboarding@resend.dev
MAIL_FROM=onboarding@resend.dev
```

#### Vercel 部署

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 前往 **Settings** > **Environment Variables**
4. 新增環境變數：
   - **Key**: `RESEND_API_KEY`
   - **Value**: 您的 Resend API Key
   - **Environment**: 選擇 `Production`, `Preview`, `Development`（或全部）
5. 可選：新增 `MAIL_FROM` 環境變數

### 5. 重新啟動開發伺服器

設定環境變數後，需要重新啟動開發伺服器：

```bash
# 停止當前伺服器（Ctrl+C）
# 重新啟動
npm run dev
```

## 驗證設定

1. 前往註冊頁面
2. 註冊一個新帳號
3. 檢查：
   - ✅ 如果看到「註冊成功並已寄出信件」→ Resend 設定成功
   - ❌ 如果看到「註冊成功，請點擊下方的驗證連結」→ Resend 未設定或設定錯誤

4. 檢查郵件收件箱（包括垃圾郵件夾）

## 常見問題

### Q: 為什麼郵件沒有收到？

**可能原因：**
1. 檢查垃圾郵件夾
2. 確認 `RESEND_API_KEY` 環境變數已正確設定
3. 檢查 Resend Dashboard 的 **Logs** 頁面，查看發送狀態
4. 確認郵件地址正確

### Q: 可以使用其他郵件服務嗎？

**可以！** 除了 Resend，您也可以使用 SMTP：

在 `.env.local` 中設定：
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false
MAIL_FROM=your-email@gmail.com
```

### Q: Resend 免費額度夠用嗎？

- 免費方案：每月 3,000 封郵件
- 對於小型專案通常足夠
- 如果超過，可以升級到付費方案

### Q: 如何查看郵件發送記錄？

1. 登入 Resend Dashboard
2. 前往 **Logs** 頁面
3. 查看所有郵件發送記錄和狀態

### Q: 本地開發時一定要設定嗎？

**不一定。** 如果沒有設定：
- 註冊時會顯示驗證連結在頁面上
- 可以手動點擊連結完成驗證
- 適合快速測試，但不適合生產環境

## 安全建議

1. ✅ **不要**將 API Key 提交到 Git
2. ✅ **使用**環境變數儲存 API Key
3. ✅ **定期**輪換 API Key
4. ✅ **限制**API Key 權限（只給予發送權限）
5. ✅ **監控**郵件發送量和異常活動

## 下一步

設定完成後，您的應用程式將能夠：
- ✅ 自動發送驗證郵件
- ✅ 發送密碼重設郵件（如果實作）
- ✅ 發送通知郵件（如果實作）

享受自動化的郵件服務！📧

