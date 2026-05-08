# Singbada Factory Info Helper (依云排单助手)

这是一个Chrome浏览器扩展，专为 `yy.singbada.cn` 排单系统设计。它可以自动识别页面上的订单号，并一键查询对应的加工厂信息。

## 功能特性

1.  **自动集成**：在排单详情页面的"订单编号"旁自动添加"获取排单信息"按钮。
2.  **一键查询**：点击按钮即可调用后台API获取详细数据。
3.  **结果展示**：以悬浮面板形式清晰展示加工方（Producer）名称。
4.  **跨域支持**：通过后台脚本处理API请求，解决跨域问题。

## 安装步骤

1.  下载本项目源代码。
2.  打开 Chrome 浏览器，访问 `chrome://extensions/`。
3.  开启右上角的 **"开发者模式" (Developer mode)**。
4.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
5.  选择本项目所在的 `singbada-extension` 文件夹。
6.  安装完成后，刷新 `yy.singbada.cn` 页面即可使用。

## 使用说明

1.  登录依云排单系统 (`https://yy.singbada.cn/productionSchedulings`)。
2.  打开任意一个订单的详情弹窗或页面。
3.  在"订单编号"旁边会看到一个蓝色的 **"获取排单信息"** 按钮。
4.  点击按钮，右上方会弹出该订单对应的加工方信息。

## 文件结构

*   `manifest.json`: 扩展配置文件 (Manifest V3)。
*   `content.js`: 页面脚本，负责识别订单号、注入按钮和显示结果。
*   `background.js`: 后台服务 Worker，负责处理 API 网络请求。
*   `styles.css`: 界面样式表。

## 注意事项

*   如果页面结构发生重大变化（如"订单编号"文本消失），可能需要更新选择器逻辑。
*   API 地址 `https://ntmapi.singbada.cn/common/getOriginal` 需要保持可用。
