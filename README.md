# 高三47班成绩查询

纯前端静态站点，可用 GitHub Pages 托管。学生用「姓名 + 身份证号」查询；身份证号在浏览器内做 SHA-256 后与 `data.json` 中的 `idHash` 比对，**站点文件不含明文身份证**。

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 页面结构 |
| `styles.css` | 样式（手机适配） |
| `app.js` | 查询、渲染、PNG 下载 |
| `data.json` | 成绩数据（仅哈希，无明文身份证） |

## 本地预览

在本目录启动任意静态服务，例如：

```bash
cd score-site
python3 -m http.server 8080
```

浏览器打开 http://127.0.0.1:8080/

> 请用 HTTP 打开，不要直接用 `file://`（`fetch('data.json')` 在部分浏览器会失败）。

## 发布到 GitHub Pages

1. 新建仓库，把本目录全部文件推到默认分支（如 `main`）。
2. 仓库 **Settings → Pages**：
   - Source：`Deploy from a branch`
   - Branch：`main` / `/ (root)`（或把文件放在 `docs/` 并选 `/docs`）
3. 保存后等待一两分钟，访问 `https://<用户名>.github.io/<仓库名>/`

也可使用 GitHub Actions 的静态站点工作流；本站无构建步骤，直接托管即可。

## 功能说明

- 首页输入姓名与身份证号查询
- 成功后展示：第二次综合考试成绩单（各科大号分数、级排、校方向进退步）+ 成绩履历表
- 进退步：进步绿色，退步红色加粗
- 「下载整页成绩图」将查询结果区域导出为 PNG（依赖 html2canvas CDN）

## 隐私

- `data.json` 仅存姓名与身份证 SHA-256（小写 hex）
- 禁止把明文身份证写入仓库或站点文件
