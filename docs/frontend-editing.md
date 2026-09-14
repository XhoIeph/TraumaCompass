# 修改前端文案与样式

## 常用位置

| 内容 | 文件 |
| --- | --- |
| 右上角关于项目、投稿说明、图例与位置说明 | `components/map/MapApp.tsx` |
| 品牌副标题、心理援助提示、侧栏栏目名称 | `components/map/Sidebar.tsx` |
| 医院侧栏摘要、定位和详情按钮 | `components/map/HospitalDetail.tsx` |
| 省份摘要 | `components/map/ProvinceDetail.tsx` |
| 医生分组、搜索提示和空结果提示 | `components/map/DoctorExplorer.tsx` |
| 机构筛选、卡片及按钮 | `components/HospitalExplorer.tsx` |
| 线索筛选 | `components/ReportExplorer.tsx` |
| 单条线索的标签、来源与按钮 | `components/ReportCard.tsx` |
| 医院完整详情页面 | `app/(site)/hospitals/[id]/page.tsx` |
| 颜色、字号、间距、按钮布局 | `app/globals.css` |
| 搜索同义词与多关键词规则 | `lib/search.ts` |

在编辑器中全局搜索当前页面上的一句文字，找到对应的 `.tsx` 文件，修改标签之间的文本即可。

```tsx
<button type="button" className="tc-button" onClick={onLocate}>
  在地图上定位
</button>
```

例如只将「在地图上定位」改成「定位」，不改 `onClick`、`className` 等属性。`{hospital.name}` 等大括号内容是动态数据，不是固定说明文字。

线索原文、医院名称等真实资料来自 `data/curated/`，不要为了调整页面文案改动原帖摘录。病症界面标签使用数据 ID 的英文大写简称，不改原文引用。

## 预览与检查

- 开发预览：`npm run dev`，在终端显示的地址打开。保存后自动更新。
- 类型检查：`npm run typecheck`。
- 仅构建前端：`npx next build`。不运行会重新生成聚合数据的 `prebuild`。
- 当前 `http://localhost:4173/` 是 `out/` 静态预览，必须构建后刷新才能看见修改。

密钥只放 `.env.local`。高德 Web 服务 key 使用 `AMAP_WEB_SERVICE_KEY`，不可加 `NEXT_PUBLIC_` 前缀或写入组件；它应仅用于服务端或本地数据脚本。

最终审查通过之前，不提交或推送本轮界面修改。
