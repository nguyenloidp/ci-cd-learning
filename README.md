# Cổng thông tin nội bộ: dự án học CI/CD → DevOps

Một website nội bộ nhỏ (Node.js + Express), tự động **test → build → deploy** bằng GitHub Actions.
Repo này vừa là sản phẩm, vừa là **sổ tay học DevOps**: phần A ghi lại những gì đã làm được,
phần B là lộ trình nâng cao, có bài tập làm trực tiếp trên chính repo này.

```
 git push ──► CI (máy ảo của GitHub)      CD (chỉ nhánh main)
              ├─ npm test                 ├─ npm test
              └─ docker build + smoke     ├─ build & push image ─► ghcr.io
                                          └─ deploy ─► máy của bạn (self-hosted runner)
                                                        http://<ip-máy>:8080
```

**Mục lục**
- [Từ điển nhanh](#từ-điển-nhanh)
- [Phần A: Cấp 1, CI/CD cơ bản (đã hoàn thành ✅)](#phần-a-cấp-1-cicd-cơ-bản-đã-hoàn-thành-)
- [Phần B: Lộ trình nâng cao](#phần-b-lộ-trình-nâng-cao)
- [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)

---

## Từ điển nhanh

| Thuật ngữ | Hiểu đơn giản |
|---|---|
| **CI** (Continuous Integration) | Mỗi lần đẩy code, máy tự kiểm tra (test, build) để phát hiện lỗi sớm |
| **CD** (Continuous Delivery/Deployment) | Code đã qua kiểm tra thì máy tự đóng gói và đưa lên server |
| **Workflow** | Một file `.yml` trong `.github/workflows/`, mô tả quy trình tự động |
| **Trigger** (`on:`) | Sự kiện kích hoạt workflow: `push`, `pull_request`, bấm tay (`workflow_dispatch`)… |
| **Job** | Một nhóm bước chạy trên **một máy**. Các job có thể chạy song song hoặc nối tiếp (`needs:`) |
| **Step** | Một lệnh (`run:`) hoặc một action dựng sẵn (`uses:`) trong job |
| **Runner** | Máy thực thi job. `ubuntu-latest` là máy của GitHub, `self-hosted` là máy của bạn |
| **Image** | "Bản đóng gói" của app (code, Node.js, thư viện). Build một lần, chạy ở đâu cũng giống nhau |
| **Container** | Một image đang chạy |
| **Registry** | Kho chứa image, ví dụ `ghcr.io` (GitHub) hay Docker Hub |
| **Health check** | Một URL (ở đây là `/health`) để máy kiểm tra app còn sống không |

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

---

# Phần A: Cấp 1, CI/CD cơ bản (đã hoàn thành ✅)

Các bước dưới đây ghi lại quá trình đã làm, kèm **bài học rút ra** ở mỗi bước, để có thể tự làm lại từ đầu trên một máy khác.

## A1. Chạy app trên máy

```bash
npm install       # cài thư viện (đọc từ package.json)
npm test          # chạy test
npm run dev       # mở http://localhost:3000, tự khởi động lại khi sửa code
```

Chạy bằng Docker, giống hệt cách server sẽ chạy:

```bash
docker build -t portal .            # đóng gói thành image tên "portal"
docker run --rm -p 3000:3000 portal # chạy container: cổng máy 3000 → cổng container 3000
```

> 💡 **Bài học:** `-p <cổng máy>:<cổng container>`. App bên trong container luôn nghe ở cổng 3000,
> nhưng bên ngoài có thể đưa ra cổng nào cũng được (CD dùng 8080).

## A2. Đẩy code lên GitHub

```bash
git push -u origin main
```

- Khi được hỏi mật khẩu, dán **Personal Access Token**, không dùng mật khẩu GitHub.
- Token phải có quyền **`workflow`**, nếu không GitHub sẽ chặn push các file trong `.github/workflows/`.

Mở tab **Actions** trên GitHub để xem:
- **CI** chạy ngay và báo xanh.
- **CD** chạy `test` → `build-and-push`, còn job `deploy` sẽ **đứng chờ** ("Waiting for a runner")
  vì chưa có máy nào mang nhãn `self-hosted`. Bước A3 sẽ giải quyết việc này.

## A3. Cài self-hosted runner

Runner là chương trình nhỏ chạy trên máy của bạn. Nó liên tục hỏi GitHub "có việc gì cho tôi không?",
và khi có job `runs-on: self-hosted` thì nó nhận về chạy.

> ⚠️ **Hai lỗi đã gặp, cần nhớ:**
> 1. **Mỗi lệnh phải nằm trên MỘT dòng.** Trang GitHub tự xuống dòng các lệnh dài. Nếu copy thiếu,
>    sẽ gặp lỗi kiểu `curl: (2) no URL specified`. Nhấn Enter nghĩa là kết thúc lệnh.
> 2. **Không gõ dấu `$`**. Đó chỉ là ký hiệu dấu nhắc lệnh trong tài liệu.
>
> Dán vào terminal Ubuntu bằng **Ctrl + Shift + V**.

**Bước 0: Kiểm tra điều kiện.** Runner sẽ gọi `docker`, nên user phải dùng được Docker mà không cần sudo:
```bash
docker ps
# Nếu báo "permission denied": sudo usermod -aG docker $USER, rồi đăng xuất và đăng nhập lại
```

**Bước 1: Tạo thư mục riêng, NGOÀI thư mục dự án.**
```bash
cd ~
mkdir actions-runner && cd actions-runner
```
> 💡 Runner là công cụ, không phải code dự án. Để trong repo sẽ dễ lỡ `git add` cả runner.

**Bước 2: Tải runner.** Lấy link đúng phiên bản trên trang *Settings → Actions → Runners → New self-hosted runner*.
```bash
curl -o actions-runner-linux-x64-2.338.2.tar.gz -L https://github.com/actions/runner/releases/download/v2.338.2/actions-runner-linux-x64-2.338.2.tar.gz
```
> 💡 `curl -o <tên-file> -L <link>`: `-o` là lưu thành file, `-L` là đi theo chuyển hướng.

**Bước 3: Kiểm tra hash** để chắc chắn file không bị hỏng hay bị sửa. Ubuntu dùng `sha256sum`, không có `shasum`:
```bash
echo "<mã-hash-trên-trang-GitHub>  actions-runner-linux-x64-2.338.2.tar.gz" | sha256sum -c
# Kết quả đúng: ...tar.gz: OK
```

**Bước 4: Giải nén.**
```bash
tar xzf ./actions-runner-linux-x64-2.338.2.tar.gz   # x: giải nén, z: gzip, f: tên file
ls                                                  # thấy config.sh, run.sh, svc.sh
```

**Bước 5: Đăng ký runner với repo.**
```bash
./config.sh
```
Trả lời các câu hỏi:

| Câu hỏi | Trả lời |
|---|---|
| URL of your repository | `https://github.com/nguyenloidp/ci-cd-learning` |
| runner register token | Token trên trang GitHub (**hết hạn sau khoảng 1 giờ**) |
| runner group / name / labels / work folder | Nhấn Enter để giữ mặc định |

Kết quả đúng: `√ Runner successfully added` và `√ Settings Saved.`

> 💡 Có 2 cách cấu hình cho cùng kết quả: `./config.sh --url ... --token ...` (đưa tham số sẵn, hợp với viết script)
> hoặc `./config.sh` (hỏi từng câu). Rất nhiều công cụ CLI có hai kiểu dùng này.
>
> 💡 Nhãn mặc định là `self-hosted, Linux, X64`. Dòng `runs-on: self-hosted` trong `cd.yml` chính là để
> GitHub tìm runner có nhãn này.

**Bước 6: Chạy thử bằng tay.**
```bash
./run.sh
```
Log đã thấy khi làm thật:
```
Listening for Jobs                            ← runner bắt đầu chờ việc
Running job: deploy                           ← nhận ngay job deploy đang chờ từ bước A2
Job deploy completed with result: Succeeded   ← deploy thành công
```
> 💡 Runner **không tự thoát**. Nó đứng chờ job tiếp theo, việc này là bình thường.

**Bước 7: Cài thành service** để runner chạy nền và tự bật lại khi khởi động máy.
Nhấn **Ctrl + C** để dừng `run.sh`, sau đó chạy:
```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status          # thấy "active (running)" là xong
```
Lệnh quản lý hay dùng:
```bash
sudo ./svc.sh stop | start | status
journalctl -u 'actions.runner.*' -f     # xem log runner trực tiếp
```
> 💡 Dừng runner **không** làm tắt website. Container chạy độc lập, runner chỉ là "người đi deploy".

## A4. Kiểm tra cả quy trình

1. Sửa một thông báo trong `src/app.js`.
2. Chạy `git add . && git commit -m "Đổi thông báo" && git push`
3. Theo dõi tab **Actions**: `test` → `build-and-push` → `deploy` lần lượt chuyển xanh.
4. Tải lại http://localhost:8080. Dòng **Phiên bản** hiện mã commit mới.

Kiểm tra trên máy:
```bash
docker ps                                   # container internal-portal, cổng 0.0.0.0:8080->3000
curl localhost:8080/api/info                # xem version đang chạy
hostname -I                                 # IP để người cùng mạng truy cập http://<IP>:8080
```

## A5. Bảo mật (repo đang public)

Self-hosted runner chạy lệnh **trực tiếp trên máy của bạn**, nên:

- [ ] Không bao giờ dùng `runs-on: self-hosted` trong workflow có trigger `pull_request`
      (người lạ fork repo, tạo PR là có thể chạy lệnh trên máy bạn). Hiện `ci.yml` chỉ dùng `ubuntu-latest`.
- [ ] **Settings → Actions → General → Fork pull request workflows**: chọn *Require approval for all outside collaborators*.
- [ ] **Settings → Environments → production**: thêm *Required reviewers* để mỗi lần deploy phải có người duyệt.
- [ ] Cân nhắc chuyển repo sang **private**.

### ✅ Tự kiểm tra Cấp 1: trả lời được những câu này là đã nắm vững

1. Vì sao `ci.yml` chạy trên mọi nhánh, còn `cd.yml` chỉ chạy trên `main`?
2. `needs: test` trong job `build-and-push` có tác dụng gì? Nếu xóa đi thì sao?
3. Vì sao job `deploy` phải chạy trên `self-hosted`, còn `build-and-push` thì không cần?
4. Image tag `:latest` và `:<sha>` khác nhau thế nào? Vì sao deploy dùng `:<sha>`?
5. `secrets.GITHUB_TOKEN` từ đâu ra? Vì sao không cần tự tạo?

---

# Phần B: Lộ trình nâng cao

Mỗi cấp có **mục tiêu**, **bài tập trên repo này**, **gợi ý** và **tiêu chí hoàn thành**.
Nên làm mỗi bài trên một **nhánh riêng + Pull Request** để luyện luôn quy trình làm việc nhóm.

```
Cấp 1 ✅  Cấp 2       Cấp 3          Cấp 4        Cấp 5             Cấp 6        Cấp 7          Cấp 8
CI/CD  →  Chất lượng → Môi trường  → Bảo mật   → Hạ tầng dạng  → Kubernetes → Giám sát    → Triển khai
cơ bản    code & PR    & phát hành    pipeline     code (IaC)        & GitOps     (Observability) nâng cao
```

## Tiến độ

- [x] Cấp 1: CI/CD cơ bản
- [ ] Cấp 2: Chất lượng code & quy trình Pull Request
- [ ] Cấp 3: Môi trường, secrets & phát hành
- [ ] Cấp 4: Bảo mật pipeline (DevSecOps)
- [ ] Cấp 5: Hạ tầng dạng code (Docker Compose, Nginx, Ansible, Terraform)
- [ ] Cấp 6: Kubernetes & GitOps
- [ ] Cấp 7: Giám sát (Prometheus, Grafana, Loki)
- [ ] Cấp 8: Chiến lược triển khai & tái sử dụng pipeline

---

## Cấp 2: Chất lượng code & quy trình Pull Request

**Mục tiêu:** code lỗi hoặc viết ẩu không thể vào được `main`.

| # | Bài tập | Gợi ý | Hoàn thành khi |
|---|---|---|---|
| 2.1 | Thêm **ESLint** và bước `npm run lint` vào CI | `npm init @eslint/config@latest`, thêm script `"lint": "eslint ."`, thêm step trong job `test` | Code dùng biến chưa khai báo thì CI báo đỏ |
| 2.2 | **Bảo vệ nhánh main** | *Settings → Branches → Add rule*: bật *Require a pull request* và *Require status checks* (chọn `test`, `docker-build`) | Không push thẳng lên `main` được, PR có test đỏ thì nút Merge bị khóa |
| 2.3 | Làm một PR cố ý sai | Tạo nhánh `fix/test-sai`, sửa test cho fail, mở PR | Thấy CI đỏ ngay trong PR, sửa lại thì chuyển xanh |
| 2.4 | **Đo độ phủ test** (coverage) | `node --test --experimental-test-coverage` | Log CI có bảng % coverage |
| 2.5 | **Matrix build**: test trên Node 20, 22, 24 | `strategy: matrix: node: [20, 22, 24]`, rồi `node-version: ${{ matrix.node }}` | Một push chạy 3 job test song song |
| 2.6 | Thêm **badge** trạng thái CI vào đầu README | `![CI](https://github.com/nguyenloidp/ci-cd-learning/actions/workflows/ci.yml/badge.svg)` | README hiện huy hiệu xanh/đỏ |
| 2.7 | Viết thêm API `POST /api/announcements` **kèm test** | Dùng `express.json()`, viết test trước (TDD) | Test mới chạy trong CI |

📚 Đọc thêm: [GitHub Actions: workflow syntax](https://docs.github.com/actions/writing-workflows/workflow-syntax-for-github-actions), Conventional Commits.

---

## Cấp 3: Môi trường, secrets & phát hành

**Mục tiêu:** có **staging** để thử trước, có **duyệt tay** trước khi lên production, có thể **rollback** trong vài giây.

| # | Bài tập | Gợi ý | Hoàn thành khi |
|---|---|---|---|
| 3.1 | Tạo môi trường **staging** ở cổng 8081 | Thêm job `deploy-staging` (`environment: staging`, `HOST_PORT: 8081`); job production thêm `needs: deploy-staging` | Push lên main thì staging cập nhật trước, sau đó mới tới production |
| 3.2 | **Duyệt tay** trước production | *Settings → Environments → production → Required reviewers* | Pipeline dừng ở deploy production, chờ bạn bấm *Approve* |
| 3.3 | Dùng **biến môi trường & secret** | Tạo secret `ADMIN_PASSWORD` và variable `SITE_NAME` trong Environment, truyền vào `docker run -e` | Trang hiển thị `SITE_NAME` khác nhau giữa staging và production |
| 3.4 | Workflow **rollback** bằng một nút bấm | File `rollback.yml` với `workflow_dispatch` có `inputs: sha`, chạy lại `docker run` với image `:<sha>` | Chọn một SHA cũ, bấm Run, website quay về bản cũ |
| 3.5 | **Phát hành theo phiên bản** (semver) | Trigger `on: push: tags: ['v*']`, tag image `:v1.2.0`, tạo GitHub Release (`softprops/action-gh-release`) | `git tag v1.0.0 && git push --tags` tạo ra Release và image có version |
| 3.6 | **Thông báo** kết quả deploy | Gửi tin nhắn qua webhook Slack/Telegram/Teams ở cuối job (`if: always()`) | Nhận tin nhắn "Deploy thành công/thất bại" kèm SHA |

> 💡 **Khái niệm cần nắm:** *Continuous Delivery* (luôn sẵn sàng deploy, có người bấm duyệt) khác với
> *Continuous Deployment* (tự động hoàn toàn). Bài 3.2 biến pipeline của bạn từ loại sau thành loại trước.

---

## Cấp 4: Bảo mật pipeline (DevSecOps)

**Mục tiêu:** phát hiện lỗ hổng **trước khi** lên production, pipeline chỉ được cấp đúng quyền nó cần.

| # | Bài tập | Gợi ý | Hoàn thành khi |
|---|---|---|---|
| 4.1 | Bật **Dependabot** | Tạo `.github/dependabot.yml` cho `npm`, `docker`, `github-actions` | Dependabot tự mở PR nâng cấp thư viện |
| 4.2 | Quét code bằng **CodeQL** | *Security → Code scanning → Set up CodeQL* | Tab Security có kết quả quét |
| 4.3 | Quét image bằng **Trivy** | `aquasecurity/trivy-action` sau bước build, `severity: CRITICAL,HIGH`, `exit-code: 1` | Image có lỗ hổng nghiêm trọng thì CI đỏ |
| 4.4 | **Quyền tối thiểu** | Kiểm tra mọi workflow đều có khối `permissions:` và chỉ cấp đúng quyền cần dùng | Giải thích được từng quyền dùng để làm gì |
| 4.5 | **Pin action theo SHA** | Đổi `actions/checkout@v4` thành `actions/checkout@<commit-sha>`, để Dependabot tự cập nhật | Hiểu vì sao tag `@v4` có thể bị kẻ xấu thay đổi |
| 4.6 | Quét lộ **secret** trong code | Bật *Secret scanning* + *Push protection* trong Settings, hoặc dùng `gitleaks` | Thử commit một chuỗi giống token thì bị chặn |
| 4.7 | **Ký image** | `sigstore/cosign` ký image sau khi push, verify trước khi deploy | Deploy từ chối image không có chữ ký |

---

## Cấp 5: Hạ tầng dạng code (Infrastructure as Code)

**Mục tiêu:** mọi thứ trên server đều được mô tả bằng file, dựng lại từ đầu chỉ bằng một lệnh.

| # | Bài tập | Gợi ý | Hoàn thành khi |
|---|---|---|---|
| 5.1 | **Docker Compose**: app + PostgreSQL | `compose.yml` có 2 service, lưu thông báo vào database thay vì mảng trong code | `docker compose up -d` chạy cả hệ thống, restart không mất dữ liệu (volume) |
| 5.2 | **Nginx reverse proxy** | Thêm service `nginx` trong compose, trỏ `portal.local` → app | Truy cập bằng tên miền thay cho `:8080` |
| 5.3 | **HTTPS nội bộ** | Dùng `mkcert` tạo chứng chỉ cho `portal.local` | Trình duyệt hiện ổ khóa |
| 5.4 | CD deploy bằng compose | Job deploy chạy `docker compose pull && docker compose up -d` | Không còn lệnh `docker run` dài trong workflow |
| 5.5 | **Ansible**: cài máy chủ từ đầu | Playbook cài Docker, tạo user, cài runner, mở firewall | Máy ảo mới (Multipass/Vagrant) chạy playbook xong là sẵn sàng nhận deploy |
| 5.6 | **Terraform** | Bắt đầu với provider `docker` (tạo container bằng Terraform), sau đó thử cloud (AWS/GCP free tier) | Hiểu `terraform plan` / `apply` / `destroy` và file state |

---

## Cấp 6: Kubernetes & GitOps

**Mục tiêu:** chạy app trên Kubernetes. Deploy bằng cách **sửa file trong Git**, không gõ lệnh lên server.

| # | Bài tập | Gợi ý | Hoàn thành khi |
|---|---|---|---|
| 6.1 | Dựng cluster trên máy | `kind` hoặc `k3d` (chạy K8s trong Docker) | `kubectl get nodes` thấy node Ready |
| 6.2 | Viết **manifest** | Thư mục `k8s/` gồm `Deployment` (2 replicas, readiness/liveness probe trỏ `/health`), `Service`, `Ingress` | `kubectl apply -f k8s/`, mở được website |
| 6.3 | **ConfigMap & Secret** | Đưa `SITE_NAME`, mật khẩu DB ra khỏi image | Đổi cấu hình không cần build lại image |
| 6.4 | **Helm chart** | `helm create portal`, tham số hóa image tag và số replica | `helm upgrade --install portal ./chart --set image.tag=<sha>` |
| 6.5 | **GitOps với Argo CD** | Cài Argo CD vào cluster, trỏ vào thư mục `k8s/` của repo | CI chỉ cần **sửa image tag trong Git**, Argo CD tự đồng bộ lên cluster |
| 6.6 | **Autoscaling** | `HorizontalPodAutoscaler` theo CPU, tạo tải bằng `hey` hoặc `k6` | Thấy số pod tự tăng khi tải cao |

> 💡 Đây là bước chuyển tư duy quan trọng: từ **push** (pipeline đẩy lên server) sang
> **pull** (server tự kéo trạng thái mong muốn từ Git về).

---

## Cấp 7: Giám sát (Observability)

**Mục tiêu:** biết hệ thống đang khỏe hay yếu **trước khi người dùng báo lỗi**.

| # | Bài tập | Gợi ý | Hoàn thành khi |
|---|---|---|---|
| 7.1 | App xuất **metrics** | Thư viện `prom-client`, endpoint `/metrics` (số request, thời gian phản hồi) | `curl localhost:8080/metrics` ra dữ liệu |
| 7.2 | **Prometheus + Grafana** | Thêm vào `compose.yml` (hoặc `kube-prometheus-stack` trên K8s) | Dashboard có biểu đồ request/giây và độ trễ |
| 7.3 | **Log tập trung** | Ghi log dạng JSON (`pino`), gom log bằng Loki + Promtail | Tìm được log theo thời gian trên Grafana |
| 7.4 | **Cảnh báo** | Alert rule: `/health` lỗi quá 1 phút → gửi Telegram/Slack | Tắt container thử, nhận được cảnh báo |
| 7.5 | Đánh dấu **lần deploy** trên dashboard | Cuối job CD, gọi Grafana Annotations API | Biểu đồ có vạch đánh dấu mỗi lần deploy |
| 7.6 | Định nghĩa **SLO** | Ví dụ: 99,5% request trả về dưới 300ms | Viết được dashboard và alert theo SLO |

---

## Cấp 8: Chiến lược triển khai & tái sử dụng pipeline

**Mục tiêu:** deploy **không gián đoạn**, pipeline gọn và dùng lại được cho nhiều dự án.

| # | Bài tập | Gợi ý | Hoàn thành khi |
|---|---|---|---|
| 8.1 | **Blue/Green** | Chạy 2 container (blue: 8081, green: 8082), Nginx chuyển hướng sang bản mới sau khi health check đạt | Deploy mà không có giây nào website bị lỗi (chạy `while true; do curl ...` để kiểm chứng) |
| 8.2 | **Canary** | Nginx `split_clients` hoặc Argo Rollouts: 10% traffic vào bản mới | Tăng dần tỉ lệ, rollback tự động khi lỗi tăng |
| 8.3 | **Reusable workflow** | Tách phần build/push thành `.github/workflows/build.yml` với `on: workflow_call` | `ci.yml` và `cd.yml` gọi lại thay vì lặp code |
| 8.4 | **Composite action** | `.github/actions/deploy/action.yml` gói các bước deploy | Workflow deploy chỉ còn vài dòng |
| 8.5 | **Tăng tốc build** | Docker layer cache: `cache-from: type=gha`, `cache-to: type=gha,mode=max` | Lần build thứ 2 nhanh hơn rõ rệt |
| 8.6 | **Runner tạm thời** (ephemeral) | `./config.sh --ephemeral`, mỗi job chạy trên runner mới sạch sẽ | Hiểu vì sao runner dùng một lần an toàn hơn |
| 8.7 | **Database migration** trong pipeline | Chạy migration trước deploy, viết kế hoạch rollback cho DB | Deploy được thay đổi schema mà không mất dữ liệu |

---

## Gợi ý cách học

- **Mỗi bài một nhánh + một PR.** Viết mô tả PR: làm gì, vì sao, kiểm tra thế nào. Đây chính là thói quen ở công ty.
- **Cố tình làm hỏng:** sau khi một tính năng chạy, thử phá nó (sai cổng, sai quyền, sai token…) để đọc thông báo lỗi.
  Debug là kỹ năng quan trọng nhất của DevOps.
- **Ghi chép lại** vào README này mỗi khi xong một cấp: đã làm gì, gặp lỗi gì, sửa ra sao (như Phần A).
- **Đọc log** trước khi tìm kiếm: GitHub Actions log, `docker logs <container>`, `journalctl`.
- Khi đã vững, thử lấy chứng chỉ: **GitHub Actions Certification**, **CKA/CKAD** (Kubernetes), **Terraform Associate**.

---

## Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân / Cách xử lý |
|---|---|
| `curl: (2) no URL specified` | Lệnh bị cắt khi copy. Dán lại **trọn một dòng** |
| `shasum: command not found` | Ubuntu dùng `sha256sum -c` |
| `config.sh`: `NotFound` / token sai | Token hết hạn (khoảng 1 giờ). Lấy token mới ở *Settings → Actions → Runners → New self-hosted runner* |
| Job `deploy` cứ "Waiting for a runner" | Runner chưa chạy: `sudo ./svc.sh status` trong `~/actions-runner` |
| `permission denied ... docker.sock` | User chưa thuộc nhóm `docker`: `sudo usermod -aG docker $USER`, đăng nhập lại, restart runner |
| `docker pull` báo `denied` | *Settings → Actions → General → Workflow permissions*: chọn *Read and write* |
| Push bị từ chối vì file workflow | Personal Access Token thiếu quyền `workflow` |
| Website không đổi sau khi push | Xem tab Actions xem job nào đỏ, rồi `docker ps` và `docker logs internal-portal` |
| Cổng 8080 đã bị chiếm | `sudo ss -ltnp \| grep 8080` để tìm tiến trình, hoặc đổi `HOST_PORT` trong `cd.yml` |
