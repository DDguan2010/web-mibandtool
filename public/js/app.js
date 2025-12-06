// MiBandTool Web App - Main Application
// API Base URL
const API_BASE_URL = 'https://www.mibandtool.club:9073';

// Load devices configuration
let devicesConfig = {};

// App State
const appState = {
    currentPageName: 'home', // 当前页面名称
    currentDevice: localStorage.getItem('selectedDevice') || 'o66', // 从localStorage读取或默认小米手环10
    currentSort: 0,
    currentPage: 1, // 当前页码
    pageSize: 20,
    isLoading: false,
    hasMore: true,
    watchfaces: [],
    user: null,
    searchKeyword: ''
};

// ==================== */
// Initialization
// ==================== */
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面初始化开始');
    loadDevicesConfig();
    initializeApp();
    checkLoginStatus();
    
    // 确保页面状态正确设置
    appState.currentPageName = 'home';
    console.log('初始化完成，开始加载表盘');
    loadWatchfaces();
});

// Load devices configuration
async function loadDevicesConfig() {
    try {
        const response = await fetch('public/assets/devices.json');
        devicesConfig = await response.json();
        populateDeviceFilter();
        populateDeviceSelect();
    } catch (error) {
        console.error('Failed to load devices config:', error);
        showSnackbar('设备配置加载失败');
    }
}

// Show search dialog
function showSearchDialog() {
    // Create search dialog if it doesn't exist
    let searchDialog = document.getElementById('searchDialog');
    if (!searchDialog) {
        searchDialog = document.createElement('div');
        searchDialog.className = 'dialog-overlay';
        searchDialog.id = 'searchDialog';
        searchDialog.innerHTML = `
            <div class="dialog">
                <div class="dialog-header">
                    <h3>搜索表盘</h3>
                    <button class="icon-button" onclick="closeDialog('searchDialog')">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="dialog-content">
                    <div class="form-field">
                        <label for="searchInput">搜索关键词</label>
                        <input type="text" id="searchInput" placeholder="输入表盘名称或描述关键词">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="button-outlined" onclick="closeDialog('searchDialog')">取消</button>
                        <button type="button" class="button-filled" onclick="performSearch()">搜索</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(searchDialog);
    }

    // Clear previous search and focus input
    document.getElementById('searchInput').value = '';
    showDialog('searchDialog');

    // Add enter key support
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Focus input
    setTimeout(() => searchInput.focus(), 100);
}

// Perform search
async function performSearch() {
    const keyword = document.getElementById('searchInput').value.trim();
    if (!keyword) {
        showSnackbar('请输入搜索关键词');
        return;
    }

    closeDialog('searchDialog');
    appState.searchKeyword = keyword;
    appState.currentPage = 1;
    appState.watchfaces = [];

    // Navigate to home page and search
    navigateToPage('home');
    await searchWatchfaces();
}

// Search watchfaces
async function searchWatchfaces() {
    if (appState.isLoading) return;

    appState.isLoading = true;
    const grid = document.getElementById('watchfaceGrid');

    if (appState.currentPage === 1) {
        grid.innerHTML = `
            <div class="loading-container">
                <div class="circular-progress"></div>
                <p>搜索中...</p>
            </div>
        `;
    }

    try {
        const timestamp = new Date().getTime(); // Add timestamp to prevent caching
        console.log('搜索表盘，关键词:', appState.searchKeyword, '页码:', appState.currentPage);
        
        // Create form data for POST request
        const formData = new URLSearchParams();
        formData.append('keyword', appState.searchKeyword);
        formData.append('page', appState.currentPage.toString());
        
        const response = await fetch(`${API_BASE_URL}/watchface/searchForPage?t=${timestamp}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'type': appState.currentDevice,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            body: formData
        });

        const data = await response.json();
        console.log('搜索API响应:', data);

        if (data.code === 0) {
            const watchfaces = data.data || [];
            console.log('搜索获取到表盘数量:', watchfaces.length);

            if (appState.currentPage === 1) {
                appState.watchfaces = watchfaces;
                renderWatchfaces();
            } else {
                appState.watchfaces = [...appState.watchfaces, ...watchfaces];
                renderWatchfaces();
            }

            // Update load more button
            const loadMoreContainer = document.getElementById('loadMoreContainer');
            if (watchfaces.length === 0) {
                // 没有更多搜索结果
                appState.hasMore = false;
                loadMoreContainer.style.display = 'none';
                console.log('搜索没有更多内容了');
            } else {
                // 有搜索结果，显示加载更多按钮
                appState.hasMore = true;
                loadMoreContainer.innerHTML = `
                    <button class="button-outlined" id="loadMoreBtn">
                        <span>加载更多</span>
                    </button>
                `;
                loadMoreContainer.style.display = 'flex';
                
                // Re-attach click event to new button
                const newLoadMoreBtn = document.getElementById('loadMoreBtn');
                newLoadMoreBtn.addEventListener('click', () => {
                    appState.currentPage++;
                    searchWatchfaces();
                });
            }
        } else {
            showSnackbar('搜索失败：' + data.msg);
        }
    } catch (error) {
        console.error('Search watchfaces error:', error);
        showSnackbar('搜索失败，请重试');
    }

    appState.isLoading = false;
}

// Initialize app
function initializeApp() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    themeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    // Navigation drawer toggle
    const menuBtn = document.getElementById('menuBtn');
    const navDrawer = document.getElementById('navDrawer');
    const backdrop = document.getElementById('backdrop');

    menuBtn.addEventListener('click', () => {
        navDrawer.classList.toggle('open');
        backdrop.classList.toggle('show');
    });

    backdrop.addEventListener('click', () => {
        navDrawer.classList.remove('open');
        backdrop.classList.remove('show');
    });

    // Navigation items
    const drawerItems = document.querySelectorAll('.drawer-item');
    drawerItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            navigateToPage(page);

            // Close drawer on mobile
            if (window.innerWidth < 1024) {
                navDrawer.classList.remove('open');
                backdrop.classList.remove('show');
            }
        });
    });

    // User button
    const userBtn = document.getElementById('userBtn');
    userBtn.addEventListener('click', () => {
        if (appState.user) {
            navigateToPage('userProfile');
        } else {
            showDialog('loginDialog');
        }
    });

    // Search button
    const searchBtn = document.getElementById('searchBtn');
    searchBtn.addEventListener('click', () => {
        showSearchDialog();
    });

    // FAB
    const uploadFab = document.getElementById('uploadFab');
    uploadFab.addEventListener('click', () => {
        if (!appState.user) {
            showSnackbar('请先登录');
            showDialog('loginDialog');
            return;
        }
        navigateToPage('upload');
    });

    // Device filter chips
    document.getElementById('deviceFilter').addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;

        const selectedDevice = chip.getAttribute('data-device');
        
        // Don't do anything if clicking the already selected device
        if (selectedDevice === appState.currentDevice) {
            showSnackbar('当前已经是 ' + chip.textContent.trim());
            return;
        }

        // Remove active from all chips
        document.querySelectorAll('#deviceFilter .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        // Save search state before clearing
        const wasSearching = appState.searchKeyword;
        const searchKeyword = appState.searchKeyword;
        
        // Clear all caches and saved data
        clearAllCaches();
        
        // Save to localStorage
        localStorage.setItem('selectedDevice', selectedDevice);
        appState.currentDevice = selectedDevice;
        
        // Restore search state after clearing
        if (wasSearching) {
            appState.searchKeyword = searchKeyword;
        }
        
        // Show confirmation and reload
        showSnackbar(`已切换到 ${chip.textContent.trim()}，正在刷新页面...`);
        
        // Force reload with cache busting
        setTimeout(() => {
            const timestamp = new Date().getTime();
            window.location.href = window.location.pathname + '?t=' + timestamp;
        }, 1000);
    });

    // Sort tabs
    document.querySelectorAll('.sort-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const wasSearching = appState.searchKeyword;
            const searchKeyword = appState.searchKeyword;
            
            appState.currentSort = parseInt(tab.getAttribute('data-sort'));
            appState.currentPage = 1;
            appState.watchfaces = [];
            
            // Preserve search state if there was one
            if (wasSearching) {
                appState.searchKeyword = searchKeyword;
                searchWatchfaces();
            } else {
                appState.searchKeyword = '';
                loadWatchfaces();
            }
        });
    });

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    loadMoreBtn.addEventListener('click', () => {
        appState.currentPage++;
        if (appState.searchKeyword) {
            searchWatchfaces();
        } else {
            loadWatchfaces();
        }
    });

    // Infinite scroll for loading more content
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        // Only enable infinite scroll on home page
        if (appState.currentPageName !== 'home' || appState.isLoading) {
            return;
        }

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Debug scroll position
        const scrollPercentage = (scrollTop + windowHeight) / documentHeight;
        console.log('滚动位置:', {
            currentPageName: appState.currentPageName,
            isLoading: appState.isLoading,
            hasMore: appState.hasMore,
            currentPage: appState.currentPage,
            scrollPercentage: scrollPercentage.toFixed(3),
            distanceFromBottom: documentHeight - (scrollTop + windowHeight)
        });

        // Load more when user scrolls to bottom (100px from bottom)
        if (scrollTop + windowHeight >= documentHeight - 100) {
            console.log('满足滚动加载条件');
            
            // Debounce scroll events to prevent multiple calls
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                console.log('执行滚动加载，当前页码:', appState.currentPage);
                
                // Only proceed if we haven't reached the end
                if (appState.hasMore) {
                    appState.currentPage++;
                    
                    // Show loading indicator at bottom
                    const loadMoreContainer = document.getElementById('loadMoreContainer');
                    if (loadMoreContainer) {
                        loadMoreContainer.style.display = 'flex';
                        loadMoreContainer.innerHTML = `
                            <div class="loading-container">
                                <div class="circular-progress"></div>
                                <p>加载更多...</p>
                            </div>
                        `;
                    }
                    
                    if (appState.searchKeyword) {
                        searchWatchfaces();
                    } else {
                        loadWatchfaces();
                    }
                } else {
                    console.log('已经没有更多内容可以加载');
                }
            }, 200);
        }
    });

    // Upload form
    initializeUploadForm();

    // Login
    const mitanLoginBtn = document.getElementById('mitanLoginBtn');
    mitanLoginBtn.addEventListener('click', () => {
        loginWithMitan();
    });

    const copyLoginLinkBtn = document.getElementById('copyLoginLinkBtn');
    copyLoginLinkBtn.addEventListener('click', async () => {
        await copyLoginLink();
    });

    const submitCodeBtn = document.getElementById('submitCodeBtn');
    submitCodeBtn.addEventListener('click', async () => {
        const code = document.getElementById('authCodeInput').value.trim();
        if (!code) {
            showSnackbar('请输入授权码');
            return;
        }
        await processLogin(code);
    });

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logout();
        });
    }
}

// Update theme icon
function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle .material-icons');
    icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
}

// ==================== */
// Navigation
// ==================== */
function navigateToPage(pageName) {
    // Update active page
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Update active drawer item
    document.querySelectorAll('.drawer-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.drawer-item[data-page="${pageName}"]`)?.classList.add('active');

    appState.currentPageName = pageName;

    // Load page data
    if (pageName === 'myResources') {
        if (!appState.user) {
            showSnackbar('请先登录');
            showDialog('loginDialog');
            navigateToPage('home');
            return;
        }
        loadMyResources();
    } else if (pageName === 'userProfile') {
        if (!appState.user) {
            navigateToPage('home');
            return;
        }
        updateUserUI();
    } else if (pageName === 'home') {
        // Check if we should preserve search state
        const preserveSearch = appState.searchKeyword && appState.currentPageName === 'home';
        
        if (!preserveSearch) {
            // Only reset if not in search mode or coming from other page
            appState.currentPage = 1;
            appState.watchfaces = [];
            appState.hasMore = true;
            appState.searchKeyword = '';
            loadWatchfaces();
        } else {
            // Preserve search state, just refresh current search results
            console.log('保持搜索状态，关键词:', appState.searchKeyword);
            appState.currentPage = 1;
            appState.watchfaces = [];
            appState.hasMore = true;
            searchWatchfaces();
        }
    }
}

// ==================== */
// Device Filter
// ==================== */
function populateDeviceFilter() {
    const deviceFilter = document.getElementById('deviceFilter');
    deviceFilter.innerHTML = ''; // Clear existing chips

    // Group devices by codename
    const devicesByCodename = {};
    for (const [modelId, device] of Object.entries(devicesConfig)) {
        const codename = device.codename;
        if (!devicesByCodename[codename]) {
            devicesByCodename[codename] = device.name;
        }
    }

    // Add chips for each unique device (no "all" option)
    for (const [codename, name] of Object.entries(devicesByCodename)) {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.setAttribute('data-device', codename);
        chip.setAttribute('title', `点击切换到 ${name} 并刷新页面`);

        // Check if this is the saved device
        if (codename === appState.currentDevice) {
            chip.classList.add('active');
        }

        chip.innerHTML = `<span>${name}</span>`;
        deviceFilter.appendChild(chip);
    }

    // Add visual indicator for current selection
    const activeChip = deviceFilter.querySelector('.chip.active');
    if (activeChip) {
        activeChip.setAttribute('title', `${activeChip.textContent.trim()} (当前选择)`);
    }
}

function populateDeviceSelect() {
    const select = document.getElementById('watchfaceType');

    // Group devices by codename
    const devicesByCodename = {};
    for (const [modelId, device] of Object.entries(devicesConfig)) {
        const codename = device.codename;
        if (!devicesByCodename[codename]) {
            devicesByCodename[codename] = device.name;
        }
    }

    for (const [codename, name] of Object.entries(devicesByCodename)) {
        const option = document.createElement('option');
        option.value = codename;
        option.textContent = name;
        // Set as selected if it matches the saved device
        if (codename === appState.currentDevice) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

// ==================== */
// API Functions
// ==================== */

// Check login status
function checkLoginStatus() {
    const openid = localStorage.getItem('openid');
    const validtoken = localStorage.getItem('validtoken');
    const nickname = localStorage.getItem('nickname');
    const avatar = localStorage.getItem('avatar');

    if (openid && validtoken) {
        appState.user = {
            openid,
            validtoken,
            nickname: nickname || 'User',
            avatar: avatar || ''
        };
        updateUserUI();
    }
}

// Update user UI
function updateUserUI() {
    const userBtn = document.getElementById('userBtn');
    if (appState.user) {
        userBtn.innerHTML = `<img src="${appState.user.avatar || ''}" alt="${appState.user.nickname}" style="width: 32px; height: 32px; border-radius: 50%;" onerror="this.outerHTML='<span class=&quot;material-icons&quot;>account_circle</span>'">`;
        userBtn.title = appState.user.nickname;

        // Update profile page if elements exist
        const profileAvatar = document.getElementById('profileAvatar');
        const profileNickname = document.getElementById('profileNickname');
        const profileOpenId = document.getElementById('profileOpenId');

        if (profileAvatar) profileAvatar.src = appState.user.avatar || '';
        if (profileNickname) profileNickname.textContent = appState.user.nickname;
        if (profileOpenId) profileOpenId.textContent = 'ID: ' + appState.user.openid;
    } else {
        userBtn.innerHTML = '<span class="material-icons">account_circle</span>';
        userBtn.title = '用户';
    }
}

// Logout
function logout() {
    appState.user = null;
    localStorage.removeItem('openid');
    localStorage.removeItem('validtoken');
    localStorage.removeItem('nickname');
    localStorage.removeItem('avatar');
    updateUserUI();
    showSnackbar('已退出登录');
    navigateToPage('home');
}

// Login with Mitan
function loginWithMitan() {
    const authUrl = 'https://www.bandbbs.cn/oauth2/authorize?type=authorization_code&client_id=6253518017122039&redirect_uri=https://api.bandbbs.cn/wftools/bandbbs.html&response_type=code&scope=user:read user:write resource_check:read resource:read&state=web';

    // Open in new window
    const authWindow = window.open(authUrl, 'MitanAuth', 'width=600,height=700');

    // Listen for OAuth callback
    window.addEventListener('message', async (event) => {
        if (event.data && event.data.code) {
            authWindow.close();
            await processLogin(event.data.code);
        }
    });

    showSnackbar('请在新窗口中完成登录');
}

// Copy login link to clipboard
async function copyLoginLink() {
    const authUrl = 'https://www.bandbbs.cn/oauth2/authorize?type=authorization_code&client_id=6253518017122039&redirect_uri=https://api.bandbbs.cn/wftools/bandbbs.html&response_type=code&scope=user:read user:write resource_check:read resource:read&state=web';
    
    try {
        await navigator.clipboard.writeText(authUrl);
        
        // Show success message
        const copyStatus = document.getElementById('copyStatus');
        copyStatus.style.display = 'block';
        
        setTimeout(() => {
            copyStatus.style.display = 'none';
        }, 3000);
        
        showSnackbar('登录链接已复制到剪贴板');
    } catch (error) {
        console.error('复制失败:', error);
        // Fallback method
        fallbackCopy(authUrl);
    }
}

// Fallback copy method
function fallbackCopy(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            const copyStatus = document.getElementById('copyStatus');
            copyStatus.style.display = 'block';
            
            setTimeout(() => {
                copyStatus.style.display = 'none';
            }, 3000);
            
            showSnackbar('登录链接已复制到剪贴板');
        } else {
            showSnackbar('复制失败，请手动复制链接');
        }
    } catch (error) {
        console.error('降级复制失败:', error);
        showSnackbar('复制失败，请手动复制链接');
    }
}

// Process login
async function processLogin(code) {
    try {
        const response = await fetch(`${API_BASE_URL}/watchface/my/loginByMitanTokenNew2?code=${code}`, {
            method: 'POST',
            headers: {
                'version': '3079',
                'type': 'o66',
                'did': '4CD7A852D06218A46BD971E90983834A7A5E203C50EBF8492C9FD735A6693FFA0F654497A8DFD1B8C71C9D8D888A3FBAD03D6324DAB6E6913A6878FEC55C9F4C'
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            appState.user = {
                openid: data.data.openid,
                validtoken: data.data.valid_token,
                nickname: data.data.nickname,
                avatar: data.data.figureurl_qq
            };

            // Save to localStorage
            localStorage.setItem('openid', data.data.openid);
            localStorage.setItem('validtoken', data.data.valid_token);
            localStorage.setItem('nickname', data.data.nickname);
            localStorage.setItem('avatar', data.data.figureurl_qq || '');

            updateUserUI();
            closeDialog('loginDialog');
            showSnackbar('登录成功！');
        } else {
            showSnackbar('登录失败：' + data.msg);
        }
    } catch (error) {
        console.error('Login error:', error);
        showSnackbar('登录失败，请重试');
    }
}

// Load watchfaces
async function loadWatchfaces() {
    if (appState.isLoading) return;

    console.log('开始加载表盘，页码:', appState.currentPage, '设备:', appState.currentDevice);
    appState.isLoading = true;
    const grid = document.getElementById('watchfaceGrid');

    if (appState.currentPage === 1) {
        grid.innerHTML = `
            <div class="loading-container">
                <div class="circular-progress"></div>
                <p>加载中...</p>
            </div>
        `;
    }

    try {
        // Use current device codename for API header
        const deviceCodename = appState.currentDevice;
        const timestamp = new Date().getTime(); // Add timestamp to prevent caching
        
        // 根据API文档构建正确的URL
        const apiUrl = `${API_BASE_URL}/watchface/listbytag/${appState.currentSort}/${appState.currentPage}/${appState.pageSize}/9999?t=${timestamp}`;
        console.log('请求URL:', apiUrl);
        console.log('请求头 type:', deviceCodename);
        
        const response = await fetch(apiUrl, {
            headers: {
                'type': deviceCodename,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        const data = await response.json();
        console.log('API响应:', data);

        if (data.code === 0) {
            const watchfaces = data.data;
            console.log('获取到表盘数量:', watchfaces.length);

            if (appState.currentPage === 1) {
                // 第一页：直接显示所有数据
                appState.watchfaces = watchfaces;
                renderWatchfaces();
            } else {
                // 后续页：将新数据添加到现有数据
                appState.watchfaces = [...appState.watchfaces, ...watchfaces];
                renderWatchfaces();
            }

            // 根据API文档，判断是否还有更多内容
            // 如果返回的数据数量等于pageSize，说明可能还有更多
            const loadMoreContainer = document.getElementById('loadMoreContainer');
            if (watchfaces.length === 0) {
                // 没有数据了
                appState.hasMore = false;
                loadMoreContainer.style.display = 'none';
                console.log('没有更多内容了 - 无数据返回');
            } else {
                // 有数据，显示加载更多按钮
                appState.hasMore = true;
                loadMoreContainer.innerHTML = `
                    <button class="button-outlined" id="loadMoreBtn">
                        <span>加载更多</span>
                    </button>
                `;
                loadMoreContainer.style.display = 'flex';
                
                // Re-attach click event to new button
                const newLoadMoreBtn = document.getElementById('loadMoreBtn');
                newLoadMoreBtn.addEventListener('click', () => {
                    appState.currentPage++;
                    loadWatchfaces();
                });
            }
        } else {
            console.error('API错误:', data.msg);
            showSnackbar('加载失败：' + data.msg);
        }
    } catch (error) {
        console.error('Load watchfaces error:', error);
        showSnackbar('加载失败，请重试');
    }

    appState.isLoading = false;
}

// Render watchfaces
function renderWatchfaces() {
    const grid = document.getElementById('watchfaceGrid');

    if (appState.watchfaces.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">watch</span>
                <h3>暂无表盘</h3>
                <p>暂时没有找到表盘资源</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = appState.watchfaces.map(watchface => createWatchfaceCard(watchface)).join('');

    // Add click listeners
    grid.querySelectorAll('.watchface-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            const watchface = appState.watchfaces.find(w => w.id == id);
            showWatchfaceDetail(watchface);
        });
    });
}

// Create watchface card HTML
function createWatchfaceCard(watchface) {
    return `
        <div class="watchface-card" data-id="${watchface.id}">
            <img src="${watchface.preview}" alt="${watchface.name}" class="watchface-card-image" loading="lazy">
            <div class="watchface-card-content">
                <h3 class="watchface-card-title">${watchface.name}</h3>
                <p class="watchface-card-author">作者: ${watchface.nickname}</p>
                <p class="watchface-card-desc">${watchface.desc || '暂无描述'}</p>
                <div class="watchface-card-stats">
                    <div class="watchface-card-stat">
                        <span class="material-icons">download</span>
                        <span>${watchface.downloadTimes}</span>
                    </div>
                    <div class="watchface-card-stat">
                        <span class="material-icons">visibility</span>
                        <span>${watchface.views}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Show watchface detail
async function showWatchfaceDetail(watchface) {
    const dialog = document.getElementById('detailDialog');
    const title = document.getElementById('detailTitle');
    const content = document.getElementById('detailContent');

    title.textContent = watchface.name;

    content.innerHTML = `
        <div class="detail-preview">
            <img src="${watchface.preview}" alt="${watchface.name}">
        </div>
        <div class="detail-info">
            <div class="detail-info-row">
                <div class="detail-info-label">作者</div>
                <div class="detail-info-value">${watchface.nickname}</div>
            </div>
            <div class="detail-info-row">
                <div class="detail-info-label">下载次数</div>
                <div class="detail-info-value">${watchface.downloadTimes}</div>
            </div>
            <div class="detail-info-row">
                <div class="detail-info-label">观看次数</div>
                <div class="detail-info-value">${watchface.views}</div>
            </div>
            <div class="detail-info-row">
                <div class="detail-info-label">文件大小</div>
                <div class="detail-info-value">${formatFileSize(watchface.filesize)}</div>
            </div>
            <div class="detail-info-row">
                <div class="detail-info-label">设备类型</div>
                <div class="detail-info-value">${watchface.type}</div>
            </div>
            <div class="detail-info-row">
                <div class="detail-info-label">米坛帖子</div>
                <div class="detail-info-value">${watchface.mitantid===""?"无":(watchface.mitantype==="r"?"https://www.bandbbs.cn/resources/":"https://www.bandbbs.cn/threads/")+watchface.mitantid}</div>
            </div>
            <div class="detail-info-row">
                <div class="detail-info-label">描述</div>
                <div class="detail-info-value">${watchface.desc || '暂无描述'}</div>
            </div>
        </div>
        <div class="detail-actions">
            <button class="button-filled" onclick="downloadWatchface(${watchface.id})">
                <span class="material-icons">download</span>
                下载表盘
            </button>
        </div>
        <div class="comments-section">
            <h4>评论</h4>
            <div class="comment-form" id="commentForm">
                <textarea placeholder="发表评论..." rows="2" id="commentInput"></textarea>
                <button class="button-filled" onclick="addComment(${watchface.id})">发布</button>
            </div>
            <div id="commentsList">
                <div class="loading-container">
                    <div class="circular-progress"></div>
                </div>
            </div>
        </div>
    `;

    showDialog('detailDialog');

    // Load comments
    loadComments(watchface.id);

    // Track view
    trackView(watchface.id);
}

// Track view
async function trackView(id) {
    try {
        await fetch(`${API_BASE_URL}/watchface/add/views?id=${id}`);
    } catch (error) {
        console.error('Track view error:', error);
    }
}

// Download watchface
async function downloadWatchface(id) {
    try {
        showSnackbar('正在获取下载链接...');
        const timestamp = new Date().getTime(); // Add timestamp to prevent caching

        const response = await fetch(`${API_BASE_URL}/watchface/downloadUsr?id=${id}&t=${timestamp}`, {
            method: 'POST',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            // Create download link
            const link = document.createElement('a');
            link.href = data.data;
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSnackbar('下载已开始');
        } else {
            showSnackbar('获取下载链接失败：' + data.msg);
        }
    } catch (error) {
        console.error('Download error:', error);
        showSnackbar('下载失败，请重试');
    }
}

// Load comments
async function loadComments(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/comment/get?relationid=${id}&type=wf&page=1`, {
            method: 'POST',
            headers: {
                'openId': appState.user ? appState.user.openid : ''
            }
        });

        const data = await response.json();

        const commentsList = document.getElementById('commentsList');

        if (data.code === 0 && data.data.length > 0) {
            commentsList.innerHTML = data.data.map(comment => createCommentHTML(comment)).join('');
        } else {
            commentsList.innerHTML = `
                <div class="empty-state">
                    <p>暂无评论</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load comments error:', error);
        document.getElementById('commentsList').innerHTML = `
            <div class="empty-state">
                <p>评论加载失败</p>
            </div>
        `;
    }
}

// Create comment HTML
function createCommentHTML(comment) {
    const canDelete = appState.user && comment.delflag;

    return `
        <div class="comment-item">
            <div class="comment-avatar">
                <img src="${comment.avator}" alt="${comment.nickname}" onerror="this.style.display='none'">
            </div>
            <div class="comment-content">
                <div class="comment-header">
                    <span class="comment-author">${comment.nickname}</span>
                    <span class="comment-time">${formatTime(comment.time)}</span>
                </div>
                <p class="comment-text">${comment.content}</p>
            </div>
            ${canDelete ? `
                <button class="icon-button comment-delete" onclick="deleteComment(${comment.id})">
                    <span class="material-icons">delete</span>
                </button>
            ` : ''}
        </div>
    `;
}

// Add comment
async function addComment(watchfaceId) {
    if (!appState.user) {
        showSnackbar('请先登录');
        showDialog('loginDialog');
        return;
    }

    const input = document.getElementById('commentInput');
    const content = input.value.trim();

    if (!content) {
        showSnackbar('请输入评论内容');
        return;
    }

    try {
        const params = new URLSearchParams({
            relationid: watchfaceId,
            type: 'wf',
            openid: appState.user.openid,
            nickname: appState.user.nickname,
            content: content,
            avator: appState.user.avatar || ''
        });

        const response = await fetch(`${API_BASE_URL}/comment/add?${params}`, {
            method: 'POST',
            headers: {
                'validtoken': appState.user.validtoken
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            input.value = '';
            showSnackbar('评论发布成功');
            loadComments(watchfaceId);
        } else {
            showSnackbar('评论发布失败：' + data.msg);
        }
    } catch (error) {
        console.error('Add comment error:', error);
        showSnackbar('评论发布失败，请重试');
    }
}

// Delete comment
async function deleteComment(commentId) {
    if (!appState.user) return;

    if (!confirm('确定删除这条评论吗？')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/comment/del?id=${commentId}`, {
            method: 'POST',
            headers: {
                'type': 'o66',
                'validtoken': appState.user.validtoken,
                'openId': appState.user.openid
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            showSnackbar('评论已删除');
            // Reload comments
            const detailContent = document.getElementById('detailContent');
            const watchfaceId = detailContent.querySelector('[onclick*="addComment"]').getAttribute('onclick').match(/\d+/)[0];
            loadComments(watchfaceId);
        } else {
            showSnackbar('删除失败：' + data.msg);
        }
    } catch (error) {
        console.error('Delete comment error:', error);
        showSnackbar('删除失败，请重试');
    }
}

// ==================== */
// Upload Functions
// ==================== */

function initializeUploadForm() {
    const uploadArea = document.getElementById('uploadArea');
    const binFileInput = document.getElementById('binFileInput');
    const uploadForm = document.getElementById('uploadForm');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0 && (files[0].name.endsWith('.bin')||files[0].name.endsWith('.rpk'))) {
            binFileInput.files = files;
            updateUploadAreaText(files[0].name);
        } else {
            showSnackbar('请选择 .bin或.rpk 文件');
        }
    });

    binFileInput.addEventListener('change', () => {
        if (binFileInput.files.length > 0) {
            updateUploadAreaText(binFileInput.files[0].name);
        }
    });

    // Preview images
    setupPreviewUpload('previewImg', 'previewImgPlaceholder');
    setupPreviewUpload('previewImgAod', 'previewImgAodPlaceholder');
    setupPreviewUpload('previewImgAod2', 'previewImgAod2Placeholder');
    setupPreviewUpload('previewImgAod3', 'previewImgAod3Placeholder');

    // Form submit
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitUpload();
    });

    cancelUploadBtn.addEventListener('click', () => {
        uploadForm.reset();
        resetUploadArea();
        // Reset page title
        document.querySelector('#uploadPage .page-title').textContent = '上传表盘';
        // Hide edit info
        document.getElementById('editInfo').style.display = 'none';
        // Remove update ID field if exists
        const updateIdField = document.getElementById('updateId');
        if (updateIdField) {
            updateIdField.remove();
        }
        navigateToPage('home');
    });
}

function updateUploadAreaText(filename) {
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.querySelector('h3').textContent = filename;
    uploadArea.querySelector('p').textContent = '文件已选择';
}

function resetUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.querySelector('h3').textContent = '拖拽表盘文件到这里';
    document.getElementById('uploadAreaText').textContent = '或点击选择文件';
    document.getElementById('selectFileBtn').textContent = '选择文件';
}

function setupPreviewUpload(inputId, placeholderId) {
    const input = document.getElementById(inputId);
    const placeholder = document.getElementById(placeholderId);

    input.addEventListener('change', () => {
        if (input.files.length > 0) {
            const file = input.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                placeholder.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };

            reader.readAsDataURL(file);
        }
    });
}

async function submitUpload() {
    if (!appState.user) {
        showSnackbar('请先登录');
        showDialog('loginDialog');
        return;
    }

    const binFile = document.getElementById('binFileInput').files[0];
    const name = document.getElementById('watchfaceName').value;
    const desc = document.getElementById('watchfaceDesc').value;
    const type = document.getElementById('watchfaceType').value;
    const staticPng = document.getElementById('staticPng').checked;
    const updateId = document.getElementById('updateId')?.value || '';
    const mitantype = document.getElementById('mitantype')?.value;
    const mitantid = document.getElementById('mitantid')?.value || '';

    if (!name || !type) {
        showSnackbar('请填写必填字段');
        return;
    }

    // 如果是编辑模式且没有选择新文件，允许不重新上传文件
    if (updateId && !binFile) {
        if (!confirm('您没有选择新的表盘文件，是否只更新表盘信息？')) {
            return;
        }
    } else if (!updateId && !binFile) {
        // 新上传时必须选择文件
        showSnackbar('请选择表盘文件');
        return;
    }

    showSnackbar(updateId ? '正在更新...' : '正在上传...');

    try {
        // Upload preview images first
        const previewImg = await uploadPreviewImage('previewImg');
        const previewImgAod = await uploadPreviewImage('previewImgAod');
        const previewImgAod2 = await uploadPreviewImage('previewImgAod2');
        const previewImgAod3 = await uploadPreviewImage('previewImgAod3');

        /*if (!previewImg) {
            showSnackbar('请上传主预览图');
            return;
        }*/

        // Upload watchface
        const formData = new FormData();

        // 只有在选择新文件时才添加文件
        if (binFile) {
            formData.append('file', binFile);
        }

        formData.append('name', name);
        formData.append('desc', desc);
        formData.append('type', type);
        formData.append('staticPng', staticPng);
        
        formData.append('updateId', updateId);
        formData.append('mitantid', mitantid);
        formData.append('mitantype', mitantype);

        if (previewImgAod) formData.append('previewImg', previewImg);
        if (previewImgAod) formData.append('previewImgAod', previewImgAod);
        if (previewImgAod2) formData.append('previewImgAod2', previewImgAod2);
        if (previewImgAod3) formData.append('previewImgAod3', previewImgAod3);

        const response = await fetch(`${API_BASE_URL}/watchface/uploadBinSelfMi7`, {
            method: 'POST',
            headers: {
                'openId': appState.user.openid,
                'validtoken': appState.user.validtoken,
                'type': type
            },
            body: formData
        });

        const data = await response.json();

        if (data.code === 0) {
            showSnackbar(updateId ? '更新成功！' : '上传成功！');
            document.getElementById('uploadForm').reset();
            resetUploadArea();
            // Reset page title
            document.querySelector('#uploadPage .page-title').textContent = '上传表盘';
            // Hide edit info
            document.getElementById('editInfo').style.display = 'none';
            // Remove update ID field if exists
            const updateIdField = document.getElementById('updateId');
            if (updateIdField) {
                updateIdField.remove();
            }
            navigateToPage('myResources');
        } else {
            showSnackbar((updateId ? '更新' : '上传') + '失败：' + data.msg);
        }
    } catch (error) {
        console.error('Upload error:', error);
        showSnackbar((updateId ? '更新' : '上传') + '失败，请重试');
    }
}

async function uploadPreviewImage(inputId) {
    const input = document.getElementById(inputId);
    if (!input.files.length) return null;

    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE_URL}/watchface/uploadPreviewImgMi7`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.code === 0) {
            return data.data;
        } else {
            console.error('Preview upload failed:', data.msg);
            return null;
        }
    } catch (error) {
        console.error('Preview upload error:', error);
        return null;
    }
}

// ==================== */
// My Resources
// ==================== */

async function loadMyResources() {
    if (!appState.user) return;

    const grid = document.getElementById('myResourcesGrid');
    grid.innerHTML = `
        <div class="loading-container">
            <div class="circular-progress"></div>
            <p>加载中...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/watchface/my/share/list/1/100`, {
            headers: {
                'openId': appState.user.openid,
                'validtoken': appState.user.validtoken
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            if (data.data.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <span class="material-icons">folder_open</span>
                        <h3>暂无资源</h3>
                        <p>你还没有上传任何表盘</p>
                    </div>
                `;
            } else {
                grid.innerHTML = data.data.map(watchface => createMyResourceCard(watchface)).join('');
            }
        } else {
            showSnackbar('加载失败：' + data.msg);
        }
    } catch (error) {
        console.error('Load my resources error:', error);
        showSnackbar('加载失败，请重试');
    }
}

function createMyResourceCard(watchface) {
    return `
        <div class="watchface-card" data-id="${watchface.id}" onclick="editWatchface(${watchface.id})">
            <img src="${watchface.preview}" alt="${watchface.name}" class="watchface-card-image">
            <div class="watchface-card-content">
                <h3 class="watchface-card-title">${watchface.name}</h3>
                <p class="watchface-card-desc">${watchface.desc || '暂无描述'}</p>
                <div class="watchface-card-stats">
                    <div class="watchface-card-stat">
                        <span class="material-icons">download</span>
                        <span>${watchface.downloadTimes}</span>
                    </div>
                    <div class="watchface-card-stat">
                        <span class="material-icons">visibility</span>
                        <span>${watchface.views}</span>
                    </div>
                </div>
            </div>
            <div class="resource-card-actions" onclick="event.stopPropagation()">
                <button class="button-filled" onclick="downloadMyResource(${watchface.id})" style="margin-right: 8px;">
                    <span class="material-icons">download</span>
                    下载
                </button>
                <button class="button-text" onclick="toggleShare(${watchface.id}, ${watchface.isShare})">
                    ${watchface.isShare ? '设为不公开' : '设为公开'}
                </button>
                <button class="button-text" style="color: var(--md-sys-color-error);" onclick="deleteResource(${watchface.id})">
                    删除
                </button>
            </div>
        </div>
    `;
}

async function toggleShare(id, currentStatus) {
    if (!appState.user) return;

    try {
        // API中：0为公开，1为不公开
        const newStatus = currentStatus ? 1 : 0;

        const response = await fetch(`${API_BASE_URL}/watchface/my/share/set?id=${id}&isShare=${newStatus}`, {
            method: 'POST',
            headers: {
                'openId': appState.user.openid,
                'validtoken': appState.user.validtoken
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            showSnackbar(newStatus ? '已设为不公开' : '已设为公开');
            loadMyResources();
        } else {
            showSnackbar('操作失败：' + data.msg);
        }
    } catch (error) {
        console.error('Toggle share error:', error);
        showSnackbar('操作失败，请重试');
    }
}

async function deleteResource(id) {
    if (!appState.user) return;

    if (!confirm('确定删除这个表盘吗？此操作不可恢复！')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/watchface/my/share/delete?id=${id}`, {
            method: 'POST',
            headers: {
                'openId': appState.user.openid,
                'validtoken': appState.user.validtoken
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            showSnackbar('删除成功');
            loadMyResources();
        } else {
            showSnackbar('删除失败：' + data.msg);
        }
    } catch (error) {
        console.error('Delete resource error:', error);
        showSnackbar('删除失败，请重试');
    }
}

// Download my resource
async function downloadMyResource(id) {
    if (!appState.user) return;

    try {
        showSnackbar('正在获取下载链接...');
        const timestamp = new Date().getTime(); // Add timestamp to prevent caching

        const response = await fetch(`${API_BASE_URL}/watchface/downloadUsr?id=${id}&t=${timestamp}`, {
            method: 'POST',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            // Create download link
            const link = document.createElement('a');
            link.href = data.data;
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSnackbar('下载已开始');
        } else {
            showSnackbar('获取下载链接失败：' + data.msg);
        }
    } catch (error) {
        console.error('Download my resource error:', error);
        showSnackbar('下载失败，请重试');
    }
}

// ==================== */
// Utility Functions
// ==================== */

function showDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    dialog.classList.add('show');
}

function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    dialog.classList.remove('show');
}

function showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    const messageEl = document.getElementById('snackbarMessage');

    messageEl.textContent = message;
    snackbar.classList.add('show');

    setTimeout(() => {
        snackbar.classList.remove('show');
    }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;

    return date.toLocaleDateString('zh-CN');
}

// Clear all caches and stored data
function clearAllCaches() {
    // Clear application state (but preserve search keyword)
    appState.watchfaces = [];
    appState.currentPage = 1;
    appState.hasMore = true;
    // Don't clear searchKeyword - it will be restored after clearing
    
    // Clear localStorage caches (except user preferences and search state)
    const keysToKeep = ['selectedDevice', 'theme', 'openid', 'validtoken', 'nickname', 'avatar'];
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
            localStorage.removeItem(key);
        }
    });
    
    // Clear session storage
    sessionStorage.clear();
    
    console.log('All caches cleared (search state preserved)');
}

// Edit watchface - load existing data into upload form
async function editWatchface(watchfaceId) {
    if (!appState.user) {
        showSnackbar('请先登录');
        showDialog('loginDialog');
        return;
    }

    // Find the watchface data from my resources
    try {
        const response = await fetch(`${API_BASE_URL}/watchface/my/share/list/1/100`, {
            headers: {
                'openId': appState.user.openid,
                'validtoken': appState.user.validtoken
            }
        });

        const data = await response.json();

        if (data.code === 0) {
            const watchface = data.data.find(w => w.id == watchfaceId);
            if (watchface) {
                // Navigate to upload page
                navigateToPage('upload');

                // Wait for page transition
                setTimeout(() => {
                    // Fill form with existing data
                    document.getElementById('watchfaceName').value = watchface.name;
                    document.getElementById('watchfaceDesc').value = watchface.desc || '';
                    document.getElementById('watchfaceType').value = watchface.type;
                    document.getElementById('mitantype').value = watchface.mitantype;
                    document.getElementById('mitantid').value = watchface.mitantid;
                    document.getElementById('staticPng').checked = watchface.previewAod ? true : false;

                    // Add update ID hidden field
                    let updateIdField = document.getElementById('updateId');
                    if (!updateIdField) {
                        updateIdField = document.createElement('input');
                        updateIdField.type = 'hidden';
                        updateIdField.id = 'updateId';
                        updateIdField.name = 'updateId';
                        document.getElementById('uploadForm').appendChild(updateIdField);
                    }
                    updateIdField.value = watchfaceId;

                    // Update page title
                    document.querySelector('#uploadPage .page-title').textContent = '编辑表盘';

                    // Show edit info with resource ID
                    document.getElementById('editInfo').style.display = 'block';
                    document.getElementById('editingResourceId').textContent = watchfaceId;

                    // Update upload area text for edit mode
                    document.getElementById('uploadAreaText').textContent = '可重新选择文件或保持原文件';
                    document.getElementById('selectFileBtn').textContent = '重新选择文件';

                    // Load preview images
                    if (watchface.preview) {
                        const previewImg = document.getElementById('previewImgPlaceholder');
                        previewImg.innerHTML = `<img src="${watchface.preview}" alt="Preview">`;
                    }

                    if (watchface.previewAod) {
                        const previewImgAod = document.getElementById('previewImgAodPlaceholder');
                        previewImgAod.innerHTML = `<img src="${watchface.previewAod}" alt="AOD Preview">`;
                    }

                    showSnackbar('正在编辑表盘，可选择重新上传文件或仅更新信息');
                }, 100);
            }
        }
    } catch (error) {
        console.error('Edit watchface error:', error);
        showSnackbar('加载表盘信息失败，请重试');
    }
}
