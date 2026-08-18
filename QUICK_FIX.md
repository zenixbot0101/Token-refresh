# Quick Fix - Lỗi Private Key Format

## Vấn Đề

```
Error: Failed to parse private key: Error: Invalid PEM formatted message.
```

## Giải Pháp Nhanh Nhất

### Option 1: Dùng Script Tự Động (Khuyên Dùng)

```bash
cd ~/Token-refresh
git pull

# Upload file JSON từ Firebase lên server
# Trên máy local:
scp ~/Downloads/your-firebase-key.json root@your-server:~/firebase-key.json

# Trên server:
node create-config-from-json.js ~/firebase-key.json
```

Script sẽ tự động:
- Đọc file JSON đúng cách
- Xử lý private key đúng format
- Generate User ID & Encryption Key
- Tạo config file
- Test kết nối

Sau đó:
```bash
gcloud auth login
npm start
```

---

### Option 2: Tạo Config Thủ Công

```bash
cd ~/Token-refresh
git pull

# Tạo config directory
mkdir -p ~/.gcloud-token-manager

# Tạo config file
nano ~/.gcloud-token-manager/config.json
```

**Paste nội dung sau** (thay thế các giá trị YOUR_*):

```json
{
  "firebase": {
    "projectId": "YOUR_PROJECT_ID",
    "databaseURL": "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    "serviceAccount": {
      "type": "service_account",
      "project_id": "YOUR_PROJECT_ID",
      "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC...\n...\nRLmdOJKZi/FWHoQ52ULg2g==\n-----END PRIVATE KEY-----\n",
      "client_email": "firebase-adminsdk-xxxxx@YOUR_PROJECT_ID.iam.gserviceaccount.com",
      "token_uri": "https://oauth2.googleapis.com/token",
      "universe_domain": "googleapis.com"
    }
  },
  "user": {
    "id": "GENERATED_USER_ID"
  },
  "worker": {
    "intervalMinutes": 30,
    "retryDelays": [30, 60, 120, 300]
  },
  "security": {
    "encryptTokens": true,
    "encryptionKey": "GENERATED_32_BYTE_KEY"
  }
}
```

**Generate IDs:**
```bash
# User ID
openssl rand -hex 16

# Encryption Key
openssl rand -hex 32
```

**Quan trọng:** Khi copy private_key từ Firebase JSON:
- Giữ nguyên `\n` (backslash + n)
- Không thay thế bằng dòng xuống thật
- Copy toàn bộ từ "-----BEGIN đến END-----\n"

**Lưu file:**
- Ctrl+O → Enter → Ctrl+X

**Test:**
```bash
cat ~/.gcloud-token-manager/config.json | python3 -m json.tool
```

**Start:**
```bash
gcloud auth login
npm start
```

---

### Option 3: Paste Trực Tiếp Private Key

Nếu bạn có private key dạng nhiều dòng (từ file .pem):

```bash
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC...
...nhiều dòng...
RLmdOJKZi/FWHoQ52ULg2g==
-----END PRIVATE KEY-----
```

Cần convert sang 1 dòng với `\n`:

```bash
# Convert multiline to single line with \n
cat private-key.pem | awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}'
```

Sau đó copy kết quả vào config.

---

## Lấy Thông Tin Từ Firebase Console

### 1. Project ID
- Firebase Console → Project Settings
- Hoặc từ URL: `https://console.firebase.google.com/project/YOUR_PROJECT_ID`

### 2. Database URL  
- Firebase Console → Realtime Database
- Copy URL hiển thị trên page
- Format: `https://YOUR_PROJECT-default-rtdb.firebaseio.com`

### 3. Client Email & Private Key
- Project Settings → Service Accounts
- Click "Generate new private key"
- Download file JSON
- Mở file, copy `client_email` và `private_key`

---

## Test Config

```bash
# Validate JSON syntax
cat ~/.gcloud-token-manager/config.json | python3 -m json.tool

# Test private key format
node test-firebase-key.js ~/firebase-key.json

# Test full config
node -e "
const config = require(process.env.HOME + '/.gcloud-token-manager/config.json');
console.log('Project:', config.firebase.projectId);
console.log('Email:', config.firebase.serviceAccount.client_email);
console.log('Key length:', config.firebase.serviceAccount.private_key.length);
"
```

---

## Nếu Vẫn Lỗi

1. **Check private key có đúng format không:**
   - Phải bắt đầu: `-----BEGIN PRIVATE KEY-----\n`
   - Phải kết thúc: `\n-----END PRIVATE KEY-----\n`
   - `\n` là literal (2 ký tự), không phải ký tự xuống dòng thật

2. **Xem log chi tiết:**
   ```bash
   DEBUG=true npm start
   ```

3. **Test với Firebase Admin trực tiếp:**
   ```bash
   node test-firebase-key.js ~/firebase-key.json
   ```

4. **Recreate config từ đầu:**
   ```bash
   rm ~/.gcloud-token-manager/config.json
   node create-config-from-json.js ~/firebase-key.json
   ```

---

## Sau Khi Fix

```bash
# Login Google Cloud
gcloud auth login

# Start worker
cd ~/Token-refresh  
npm start
```

Worker sẽ:
- ✓ Connect Firebase
- ✓ Verify Google Cloud auth
- ✓ Refresh token every 30 min
- ✓ Encrypt & save to Firebase

Done! 🎉
