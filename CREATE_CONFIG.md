# Tạo Config File Thủ Công

Nếu setup tự động gặp vấn đề với private key, bạn có thể tạo config file thủ công.

## Cách 1: Sử Dụng File JSON Gốc Từ Firebase

### Bước 1: Download Firebase Service Account Key

1. Vào https://console.firebase.google.com/
2. Chọn project
3. Project Settings → Service Accounts
4. Click "Generate new private key"
5. Download file JSON (ví dụ: `my-project-firebase-adminsdk-xxxxx.json`)

### Bước 2: Upload File Lên Server

```bash
# Từ máy local
scp ~/Downloads/my-project-firebase-adminsdk-*.json root@your-server:~/firebase-key.json
```

### Bước 3: Tạo Config

```bash
cd ~/Token-refresh
node create-config-from-json.js ~/firebase-key.json
```

Script này sẽ tự động tạo config đúng định dạng.

---

## Cách 2: Copy Paste Thủ Công (Khuyên Dùng)

### Bước 1: Tạo Thư Mục Config

```bash
mkdir -p ~/.gcloud-token-manager
```

### Bước 2: Tạo File Config

```bash
nano ~/.gcloud-token-manager/config.json
```

### Bước 3: Paste Nội Dung

**QUAN TRỌNG:** Khi paste private key, phải giữ nguyên các dòng xuống dòng. **KHÔNG** thay thế `\n` bằng ký tự xuống dòng thật.

```json
{
  "firebase": {
    "projectId": "YOUR_PROJECT_ID",
    "databaseURL": "https://YOUR_PROJECT.firebaseio.com",
    "serviceAccount": {
      "type": "service_account",
      "project_id": "YOUR_PROJECT_ID",
      "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC...\n...\n...FULL_KEY_HERE...\n...\nRLmdOJKZi/FWHoQ52ULg2g==\n-----END PRIVATE KEY-----\n",
      "client_email": "firebase-adminsdk-xxxxx@YOUR_PROJECT.iam.gserviceaccount.com",
      "token_uri": "https://oauth2.googleapis.com/token",
      "universe_domain": "googleapis.com"
    }
  },
  "user": {
    "id": "unique-user-id-here"
  },
  "worker": {
    "intervalMinutes": 30,
    "retryDelays": [30, 60, 120, 300]
  },
  "security": {
    "encryptTokens": true,
    "encryptionKey": "your-32-byte-encryption-key-here"
  }
}
```

### Lấy Thông Tin Từ File JSON Firebase

Mở file JSON từ Firebase, copy các trường sau:

```json
{
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",          ← Copy vào projectId và project_id
  "private_key_id": "...",
  "private_key": "-----BEGIN...",           ← Copy NGUYÊN VẸN vào private_key
  "client_email": "firebase-adminsdk...",   ← Copy vào client_email
  ...
}
```

**LƯU Ý QUAN TRỌNG về private_key:**

Private key trong file JSON có dạng:
```
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n...\n-----END PRIVATE KEY-----\n"
```

Các ký tự `\n` là **literal string**, không phải ký tự xuống dòng thật. Khi paste vào config, **PHẢI GIỮ NGUYÊN** format này.

### Bước 4: Generate User ID và Encryption Key

```bash
# Generate User ID (32 hex characters)
openssl rand -hex 16

# Generate Encryption Key (64 hex characters for 32 bytes)
openssl rand -hex 32
```

### Bước 5: Lưu File

Trong nano:
- Nhấn `Ctrl+O` để save
- Nhấn `Enter` để confirm
- Nhấn `Ctrl+X` để thoát

### Bước 6: Verify Config

```bash
cat ~/.gcloud-token-manager/config.json | python3 -m json.tool
```

Nếu không có lỗi → Config hợp lệ

### Bước 7: Test Config

```bash
cd ~/Token-refresh
node test-config.js
```

---

## Cách 3: Sử Dụng Script Tự Động

### Bước 1: Upload Firebase JSON File

```bash
scp ~/Downloads/firebase-key.json root@server:~/firebase-key.json
```

### Bước 2: Chạy Script

```bash
cd ~/Token-refresh
chmod +x create-config-from-json.js
node create-config-from-json.js ~/firebase-key.json
```

Script sẽ tự động:
- Đọc file JSON
- Generate User ID
- Generate Encryption Key
- Tạo config file đúng format
- Test kết nối Firebase

### Bước 3: Start Worker

```bash
npm start
```

---

## Troubleshooting

### Lỗi: "Invalid PEM formatted message"

**Nguyên nhân:** Private key không đúng format

**Giải pháp:**

1. **Kiểm tra private key:**
   ```bash
   node test-firebase-key.js ~/firebase-key.json
   ```

2. **Private key PHẢI có `\n` literal:**
   ```json
   "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
   ```

3. **KHÔNG được là:**
   ```json
   "private_key": "-----BEGIN PRIVATE KEY-----
   MIIEv...
   -----END PRIVATE KEY-----"
   ```

### Lỗi: "Cannot parse config file"

```bash
# Validate JSON
cat ~/.gcloud-token-manager/config.json | python3 -m json.tool

# Nếu có lỗi, tạo lại file
rm ~/.gcloud-token-manager/config.json
nano ~/.gcloud-token-manager/config.json
```

### Lỗi: "Firebase connection failed"

1. Kiểm tra Project ID
2. Kiểm tra Database URL (https://PROJECT.firebaseio.com)
3. Kiểm tra Client Email
4. Test private key format

---

## Quick Reference

### Database URL Format

```
https://PROJECT-ID.firebaseio.com
https://PROJECT-ID-default-rtdb.firebaseio.com  (for default)
https://PROJECT-ID-default-rtdb.asia-southeast1.firebasedatabase.app  (for regions)
```

Lấy từ: Firebase Console → Realtime Database → Copy URL

### Client Email Format

```
firebase-adminsdk-xxxxx@PROJECT-ID.iam.gserviceaccount.com
```

Lấy từ: Service Account JSON file

### Private Key Format

```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBA...(nhiều dòng)...2ULg2g==\n-----END PRIVATE KEY-----\n"
```

**Chú ý:** `\n` là 2 ký tự (backslash + n), không phải ký tự xuống dòng thật!

---

## Sau Khi Tạo Config

```bash
# Login Google Cloud
gcloud auth login

# Start worker
cd ~/Token-refresh
npm start
```

Xong! 🎉
