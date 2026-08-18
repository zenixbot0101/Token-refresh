# Hướng Dẫn Sử Dụng - GCloud Token Auth Manager

## Cài Đặt Tự Động Hoàn Toàn

Tool này đã được cải tiến để tự động hóa **TẤT CẢ** các bước, bạn không cần tạo file thủ công.

### Yêu Cầu

- ✅ Hệ điều hành Linux (Ubuntu/Debian)
- ✅ Quyền sudo
- ✅ Kết nối internet

### Cài Đặt

```bash
cd ~/Token-refresh
npm install
```

### Chạy Setup

```bash
npm run setup
```

## Setup Sẽ Tự Động

1. **Kiểm tra Node.js**
   - Nếu chưa có Node.js → Tự động cài Node.js 20.x
   - Nếu phiên bản cũ → Đề xuất cài bản mới

2. **Kiểm tra Google Cloud CLI**
   - Nếu chưa có → Tự động cài gcloud CLI
   - Tự động cấu hình và verify

3. **Cấu hình Firebase**
   - Bạn chỉ cần nhập 4 thông tin:
     * **Firebase Project ID**
     * **Firebase Database URL** (ví dụ: https://your-project.firebaseio.com)
     * **Firebase Client Email** (ví dụ: firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com)
     * **Firebase Private Key** (paste toàn bộ key bao gồm -----BEGIN/END PRIVATE KEY-----)
   - Tool tự động tạo service account object
   - **KHÔNG CẦN** tạo file firebase-key.json

4. **Tạo User ID**
   - Tự động generate ID ngẫu nhiên
   - Hoặc bạn có thể nhập custom ID

5. **Mã hóa Token**
   - Tự động generate encryption key
   - Mã hóa token trước khi lưu Firebase

6. **Đăng nhập Google Cloud**
   - Trình duyệt tự động mở
   - Bạn đăng nhập Google account
   - Tool tự động verify

7. **Khởi động Worker**
   - Tùy chọn start ngay hoặc để sau

## Lấy Thông Tin Firebase

### Bước 1: Vào Firebase Console
```
https://console.firebase.google.com/
```

### Bước 2: Chọn Project của bạn

### Bước 3: Project Settings → Service Accounts

### Bước 4: Lấy thông tin

1. **Project ID**: Hiển thị ở đầu trang
2. **Database URL**: 
   - Vào "Realtime Database"
   - Copy URL (ví dụ: https://your-project.firebaseio.com)
3. **Client Email & Private Key**:
   - Ở tab "Service accounts"
   - Click "Generate new private key"
   - Mở file JSON vừa download
   - Copy `client_email` và `private_key`

## Ví Dụ Thông Tin Cần Nhập

```
Firebase Project ID: my-project-abc123

Firebase Database URL: https://my-project-abc123.firebaseio.com

Firebase Client Email: firebase-adminsdk-ab12c@my-project-abc123.iam.gserviceaccount.com

Firebase Private Key: 
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQChnoymsAU2khUX
...
(nhiều dòng)
...
RLmdOJKZi/FWHoQ52ULg2g==
-----END PRIVATE KEY-----
```

**LƯU Ý**: Paste toàn bộ private key bao gồm dòng BEGIN và END.

## Sau Khi Setup

### Khởi động Worker

```bash
npm start
```

Worker sẽ:
- Refresh token mỗi 30 phút
- Mã hóa token
- Lưu vào Firebase
- Tự động retry nếu lỗi

### Kiểm tra Status

```bash
npm run status
```

### Dừng Worker

```bash
Ctrl+C
```

hoặc:

```bash
gcloud-token-manager stop
```

## Các Lệnh Khác

```bash
# Đăng nhập lại Google Cloud
gcloud-token-manager login

# Đăng xuất Google Cloud
gcloud-token-manager logout

# Chạy setup lại
npm run setup
```

## Chạy Worker Nền (Background Service)

### Tạo systemd service

```bash
sudo nano /etc/systemd/system/gcloud-token-manager.service
```

Nội dung:

```ini
[Unit]
Description=GCloud Token Auth Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Token-refresh
ExecStart=/usr/bin/node /root/Token-refresh/src/index.js start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Kích hoạt service

```bash
sudo systemctl daemon-reload
sudo systemctl enable gcloud-token-manager
sudo systemctl start gcloud-token-manager
sudo systemctl status gcloud-token-manager
```

### Xem logs

```bash
sudo journalctl -u gcloud-token-manager -f
```

## Troubleshooting

### Lỗi: Node.js không tìm thấy

Tool sẽ tự động đề xuất cài đặt. Chọn Yes để cài tự động.

### Lỗi: Firebase connection failed

1. Kiểm tra lại Project ID
2. Kiểm tra Database URL (phải có https://)
3. Kiểm tra Client Email (phải có @...iam.gserviceaccount.com)
4. Kiểm tra Private Key (phải có BEGIN và END PRIVATE KEY)

### Lỗi: Authentication failed

```bash
gcloud-token-manager login
```

### Xem logs chi tiết

```bash
cat ~/.gcloud-token-manager/logs/app-*.log
```

## Ưu Điểm Của Phiên Bản Mới

✅ **Không cần tạo file thủ công** - Tool tự tạo tất cả

✅ **Tự động cài Node.js** - Nếu chưa có hoặc phiên bản cũ

✅ **Tự động cài Google Cloud CLI** - Không cần cài manual

✅ **Nhập trực tiếp credentials** - Không cần download file JSON riêng

✅ **Tự động mã hóa token** - Bảo mật tối đa

✅ **Setup 1 lần chạy mãi mãi** - Tự động retry và recovery

## Bảo Mật

🔒 Tất cả credentials được lưu tại:
```
~/.gcloud-token-manager/config.json
```

File này được bảo vệ và không bao giờ commit lên Git.

Token được mã hóa AES-256-GCM trước khi lưu Firebase.

## Hỗ Trợ

Nếu gặp vấn đề:
1. Chạy `npm run status` để kiểm tra
2. Xem logs tại `~/.gcloud-token-manager/logs/`
3. Chạy lại setup: `npm run setup`

---

**Đã đơn giản hóa tối đa - Chỉ cần nhập 4 thông tin Firebase là xong!** 🚀
