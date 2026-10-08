# VideoDL Overseas V9 — Browser-assisted + Netlify Functions

跨平台：iPhone Safari、Android 浏览器、电脑浏览器。无第三方解析 API、无支付宝、无淘宝 AppKey。

## 为什么增加浏览器辅助提取
Netlify Functions 只能读取服务器可访问的页面，无法自动继承用户浏览器里的登录态，也不会执行淘宝/Facebook 完整的客户端播放逻辑。V9 增加可复制的 bookmarklet（书签脚本），由用户在已打开的商品页面上运行，扫描当前页面的 video/source/meta 元素、Performance 资源列表及已加载页面文本，再让用户复制候选视频 URL 到本工具。

## 部署（重要：Functions 需要构建部署）
**不要只把 ZIP 解压后的 `public` 文件夹拖到 Netlify Drop。** 这种静态拖放部署常常只上传网页文件，不会构建/部署 `netlify/functions`，于是 `/api/parse-video` 会返回 HTTP 404。

推荐方式：
1. 解压整个 ZIP，保留项目根目录的 `netlify.toml`、`public/` 和 `netlify/functions/`。
2. 将整个项目上传到 GitHub 仓库。
3. 在 Netlify 选择 **Add new site → Import an existing project**，连接这个 GitHub 仓库。
4. Build command 留空，Publish directory 填 `public`；Functions 目录保持 `netlify/functions`。
5. 触发一次新的 Deploy。部署日志里应能看到 `parse-video` Function 被打包/部署。
6. 先打开 `https://你的站点.netlify.app/api/parse-video` 测试：GET 请求应返回 JSON 错误“只接受 POST 请求”，而不是 Netlify 404。这说明函数路由已经生效。
7. 再打开网站，使用“手机 / 电脑辅助提取”步骤。

也可以使用 Netlify CLI 在项目根目录执行 `netlify deploy --build --prod`；不要用纯静态拖放代替 Functions 构建部署。

## API 路径
`POST /api/parse-video` 与旧路径 `/api/resolve` 都通过 `netlify.toml` 重写到 `/.netlify/functions/parse-video`。Function 会尝试读取公开页面，或接受用户复制出的直接视频 URL。

## 限制
- 书签脚本只检查当前页面已加载的数据，不会绕过登录、验证码、隐私权限、付费或 DRM。
- 有些播放器使用 `blob:` 地址、MSE 分段、临时签名或加密流；这些不一定能转换成可下载的 MP4。
- iPhone/Android 浏览器可能限制 bookmarklet；请用普通浏览器打开淘宝页面，而不是在淘宝 App 内运行。不同浏览器的书签管理界面不同。
- Netlify Functions 不保证可以直接请求所有平台域名；出现 403/429 或没有媒体 URL 时应如实提示。
- iOS/Android 网页不能静默写入相册；实际保存步骤由系统浏览器决定。

只保存你有权访问和保存的内容。
