# QuicKey 项目架构图

## 系统架构图

```mermaid
graph TB
    subgraph "Chrome Extension Environment"
        BG[Background Script<br/>后台脚本]
        POPUP[Popup Window<br/>弹出窗口]
        OPTIONS[Options Page<br/>选项页面]
        CONTENT[Content Scripts<br/>内容脚本]
    end

    subgraph "Browser APIs"
        TABS[Tabs API<br/>标签页管理]
        BOOKMARKS[Bookmarks API<br/>书签管理]
        HISTORY[History API<br/>历史记录]
        STORAGE[Storage API<br/>本地存储]
    end
    
    subgraph "User Interface"
        SEARCH[Search Box<br/>搜索框]
        RESULTS[Results List<br/>结果列表]
        SETTINGS[Settings Panel<br/>设置面板]
    end
    
    subgraph "Core Modules"
        SCORE[QuickScore<br/>搜索算法]
        RECENTS[Recent Tabs<br/>最近标签页]
        SHORTCUTS[Shortcuts<br/>快捷键管理]
        STORAGE_MGR[Storage Manager<br/>存储管理]
    end
    
    BG --> TABS
    BG --> BOOKMARKS
    BG --> HISTORY
    BG --> STORAGE
    
    POPUP --> SEARCH
    POPUP --> RESULTS
    POPUP --> BG
    
    OPTIONS --> SETTINGS
    OPTIONS --> BG
    
    SEARCH --> SCORE
    RESULTS --> RECENTS
    
    BG --> SCORE
    BG --> RECENTS
    BG --> SHORTCUTS
    BG --> STORAGE_MGR
    
    style BG fill:#e1f5fe
    style POPUP fill:#f3e5f5
    style OPTIONS fill:#e8f5e8
    style SCORE fill:#fff3e0
    style RECENTS fill:#fce4ec
```

## 数据流程图

```mermaid
flowchart TD
    A[用户输入搜索词] --> B{搜索模式判断}
    B -->|默认| C[标签页搜索]
    B -->|/b | D[书签搜索]
    B -->|/h | E[历史记录搜索]
    
    C --> F[获取所有标签页数据]
    D --> G[获取书签数据]
    E --> H[获取历史记录数据]
    
    F --> I[应用QuickScore算法]
    G --> I
    H --> I
    
    I --> J[按评分排序结果]
    J --> K[显示搜索结果]
    K --> L{用户选择操作}
    
    L -->|切换标签页| M[激活目标标签页]
    L -->|打开新标签页| N[创建新标签页]
    L -->|关闭标签页| O[关闭目标标签页]
    L -->|复制URL| P[复制到剪贴板]
    
    M --> Q[更新最近使用记录]
    N --> Q
    O --> R[更新标签页列表]
    P --> S[完成操作]
    Q --> S
    R --> S
```

## 组件关系图

```mermaid
graph LR
    subgraph "Background Script Modules"
        A1[background.js<br/>主后台脚本]
        A2[recent-tabs.js<br/>最近标签页管理]
        A3[settings.js<br/>设置管理]
        A4[storage.js<br/>存储管理]
        A5[popup-window.js<br/>弹出窗口管理]
    end
    
    subgraph "Popup Modules"
        B1[app.js<br/>主应用逻辑]
        B2[search-box.js<br/>搜索框组件]
        B3[results-list.js<br/>结果列表组件]
        B4[score/quick-score.js<br/>搜索算法]
        B5[shortcuts/popup-shortcuts.js<br/>快捷键处理]
    end
    
    subgraph "Common Modules"
        C1[constants.js<br/>常量定义]
        C2[debounce.js<br/>防抖函数]
        C3[utils.js<br/>工具函数]
    end
    
    A1 --> A2
    A1 --> A3
    A1 --> A4
    A1 --> A5
    
    B1 --> B2
    B1 --> B3
    B1 --> B4
    B1 --> B5
    
    A1 --> B1
    A5 --> B1
    
    A1 --> C1
    B1 --> C1
    A1 --> C2
    B1 --> C2
    A1 --> C3
    B1 --> C3
    
    style A1 fill:#e1f5fe
    style B1 fill:#f3e5f5
    style C1 fill:#e8f5e8
```

## 搜索算法流程图

```mermaid
flowchart TD
    A[输入搜索词] --> B[分词处理]
    B --> C[遍历所有候选项目]
    C --> D{应用QuickScore算法}
    
    subgraph "QuickScore算法流程"
        D --> E[检查连续匹配]
        E --> F[计算基础分数]
        F --> G[应用位置惩罚]
        G --> H[应用密度惩罚]
        H --> I[应用大写字母奖励]
        I --> J[应用单词开头奖励]
        J --> K[最终评分]
    end
    
    K --> L[对所有项目评分]
    L --> M[按分数排序]
    M --> N[过滤低分项目]
    N --> O[显示前10个结果]
    
    style D fill:#fff3e0
    style K fill:#e8f5e8
```

## 事件处理流程图

```mermaid
flowchart TD
    A[用户按下快捷键] --> B{快捷键类型判断}
    
    B -->|Alt+Q| C[打开弹出窗口]
    B -->|Alt+Z| D[切换最近标签页]
    B -->|Alt+A/S| E[导航最近标签页列表]
    B -->|Ctrl+Tab| F[模拟Alt+Tab行为]
    
    C --> G[显示搜索界面]
    D --> H[切换两个最近标签页]
    E --> I[在最近标签页列表中导航]
    F --> J[显示标签页切换菜单]
    
    G --> K[等待用户输入]
    H --> L[更新最近使用记录]
    I --> M[高亮选中标签页]
    J --> N[用户选择标签页]
    
    K --> O{用户操作}
    O -->|输入搜索词| P[执行搜索]
    O -->|选择结果| Q[执行对应操作]
    O -->|ESC键| R[关闭弹出窗口]
    
    P --> S[显示搜索结果]
    Q --> T[执行标签页操作]
    R --> U[保存状态]
    
    style B fill:#e1f5fe
    style O fill:#f3e5f5
```

## 技术栈架构图

```mermaid
graph TB
    subgraph "前端框架层"
        A1[React 18.3.1]
        A2[React Router 6.23.1]
        A3[React Virtualized 9.22.5]
    end
    
    subgraph "构建工具层"
        B1[Webpack 5.91.0]
        B2[Babel]
        B3[HTML Webpack Plugin]
    end
    
    subgraph "样式处理层"
        C1[Goober 2.1.14]
        C2[SCSS]
        C3[CSS Modules]
    end
    
    subgraph "工具库层"
        D1[Lodash]
        D2[Fast Memoize 2.5.2]
        D3[Pinyin 3.1.0]
    end
    
    subgraph "浏览器API层"
        E1[Chrome Extension API]
        E2[Tabs API]
        E3[Bookmarks API]
        E4[History API]
        E5[Storage API]
    end
    
    A1 --> B1
    A2 --> B1
    A3 --> B1
    
    B1 --> C1
    B1 --> C2
    B1 --> C3
    
    B1 --> D1
    B1 --> D2
    B1 --> D3
    
    B1 --> E1
    E1 --> E2
    E1 --> E3
    E1 --> E4
    E1 --> E5
    
    style A1 fill:#e1f5fe
    style B1 fill:#f3e5f5
    style C1 fill:#e8f5e8
    style D1 fill:#fff3e0
    style E1 fill:#fce4ec
```

## 项目文件结构图

```mermaid
graph TD
    A[QuicKey项目根目录] --> B[src/]
    A --> C[docs/]
    A --> D[package.json]
    A --> E[README.md]
    
    B --> F[js/]
    B --> G[css/]
    B --> H[img/]
    
    F --> I[background/]
    F --> J[popup/]
    F --> K[options/]
    F --> L[common/]
    
    I --> M[background.js]
    I --> N[recent-tabs.js]
    I --> O[settings.js]
    I --> P[storage.js]
    
    J --> Q[app.js]
    J --> R[search-box.js]
    J --> S[results-list.js]
    J --> T[score/]
    J --> U[data/]
    
    T --> V[quick-score.js]
    T --> W[array-score.js]
    T --> X[search.js]
    
    U --> Y[get-bookmarks.js]
    U --> Z[get-history.js]
    U --> AA[init-tabs.js]
    
    K --> BB[app.js]
    K --> CC[general-section.js]
    K --> DD[shortcuts-section.js]
    
    G --> EE[options.css]
    G --> FF[popup.css]
    G --> GG[rv-styles.css]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style F fill:#e8f5e8
    style I fill:#fff3e0
    style J fill:#fce4ec
```

这些图表从不同角度展示了QuicKey项目的架构设计，包括：

1. **系统架构图** - 展示Chrome扩展各组件之间的关系
2. **数据流程图** - 展示搜索和操作的数据流向
3. **组件关系图** - 展示代码模块间的依赖关系
4. **搜索算法流程图** - 展示QuickScore算法的执行流程
5. **事件处理流程图** - 展示用户交互的事件处理流程
6. **技术栈架构图** - 展示项目使用的技术栈层次结构
7. **项目文件结构图** - 展示项目的目录组织结构

这些图表可以帮助开发者更好地理解项目的整体架构和实现细节。