# Cổng thông tin nội bộ: dự án học CI/CD

Một website nội bộ nhỏ (Node.js + Express), tự động **test → build → deploy** bằng GitHub Actions.

```
 git push ──► CI (GitHub cloud)          CD (chỉ nhánh main)
              ├─ npm test                 ├─ npm test
              └─ docker build + smoke     ├─ build & push image ─► ghcr.io
                                          └─ deploy ─► máy của bạn (self-hosted runner)
                                                        http://<ip-máy>:8080
```

## Cấu trúc thư mục

| Đường dẫn | Vai trò |
|---|---|
| `src/app.js` | Các route của website (`/health`, `/api/info`, …) |
| `src/server.js` | Khởi động server |
| `public/index.html` | Giao diện trang chủ |
| `test/app.test.js` | Test tự động (dùng `node:test` có sẵn trong Node) |
| `Dockerfile` | Đóng gói app thành Docker image |
| `.github/workflows/ci.yml` | Pipeline **CI**: chạy với mọi lần push / PR |
| `.github/workflows/cd.yml` | Pipeline **CD**: chạy khi push lên `main`, deploy lên máy nội bộ |

## 1. Chạy thử trên máy

```bash
npm install
npm test          # chạy test
npm run dev       # mở http://localhost:3000
```

Chạy bằng Docker:

```bash
docker build -t portal .
docker run --rm -p 3000:3000 portal
```

## 2. Đẩy code lên GitHub

```bash
git push -u origin main
```

Vào tab **Actions** của repo: workflow **CI** sẽ chạy ngay. Workflow **CD** cũng chạy,
nhưng job `deploy` sẽ đứng chờ vì chưa có runner. Bước 3 sẽ xử lý việc này.

## 3. Cài self-hosted runner (máy sẽ chạy website nội bộ)

Runner là chương trình nhỏ chạy trên máy của bạn, nhận lệnh từ GitHub để deploy.
Máy này cần có **Docker** và **curl**.

1. Trên GitHub: **Settings → Actions → Runners → New self-hosted runner** → chọn **Linux**.
2. Copy và chạy các lệnh GitHub hiển thị (download, `./config.sh --url ... --token ...`).
3. Cho user chạy runner dùng được Docker mà không cần sudo:
   ```bash
   sudo usermod -aG docker $USER   # sau đó đăng xuất / đăng nhập lại
   ```
4. Cài runner thành service để tự chạy lại khi khởi động máy:
   ```bash
   sudo ./svc.sh install && sudo ./svc.sh start
   ```

Sau đó vào **Actions → CD → Re-run jobs**. Khi xong, mở `http://<ip-máy>:8080`.
Dòng "Phiên bản" trên trang sẽ hiển thị commit SHA vừa deploy.

## 4. Bảo mật (quan trọng vì repo đang public)

Self-hosted runner chạy code trực tiếp trên máy của bạn. Với repo public:

- Workflow `ci.yml` chỉ dùng `ubuntu-latest`, nên PR từ người lạ **không** chạy trên máy bạn.
  Đừng thêm `runs-on: self-hosted` vào workflow nào có trigger `pull_request`.
- **Settings → Actions → General → Fork pull request workflows**: chọn
  *Require approval for all outside collaborators*.
- (Nên làm) **Settings → Environments → production**: thêm *Required reviewers*.
  Khi đó mỗi lần deploy cần bạn bấm duyệt, giống quy trình thật ở công ty.
- Nếu được, hãy chuyển repo sang **private**. Website nội bộ thì code cũng nên để nội bộ.

## 5. Bài tập để luyện

1. **Thấy CD hoạt động:** sửa một thông báo trong `src/app.js`, push lên `main`, đợi vài phút rồi tải lại trang.
2. **Làm CI báo lỗi:** sửa test cho sai, push lên một nhánh mới, tạo Pull Request. CI sẽ báo đỏ.
3. **Chặn merge khi test lỗi:** **Settings → Branches → Add rule** cho `main`, bật
   *Require status checks to pass* và chọn job `test`.
4. **Rollback:** deploy lại một phiên bản cũ bằng tay:
   `docker rm -f internal-portal && docker run -d --name internal-portal -p 8080:3000 ghcr.io/nguyenloidp/ci-cd-learning:<sha-cũ>`
5. **Mở rộng:** thêm bước lint (ESLint), thêm môi trường `staging` chạy ở cổng khác.
